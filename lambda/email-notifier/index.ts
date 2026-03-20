// ─────────────────────────────────────────────────────────────────────────────
//  Email Notifier Lambda
//  Triggered by Step Functions after a post is successfully published.
//  Fetches all active subscribers via the internal Next.js API and sends
//  each one a "new post" email via AWS SES in batches of 50.
//
//  TODO: Request SES production access at console.aws.amazon.com/ses
//        before deploying to prod — sandbox only allows verified addresses.
// ─────────────────────────────────────────────────────────────────────────────

import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { log } from '../shared/logger'

// ─── AWS clients ──────────────────────────────────────────────────────────────
const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

// ─── Constants ───────────────────────────────────────────────────────────────
const BATCH_SIZE     = 50
const BATCH_DELAY_MS = 3_500   // 3.5 seconds — respect SES 14/s rate limit

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotifierEvent {
  postId:          string
  postTitle:       string
  postUrl:         string
  postExcerpt:     string
  postStatus?:     string   // 'PUBLISHED' | 'REVIEW' — skip if not PUBLISHED
  postCategory?:   string
  postReadingTime?: number
}

interface Subscriber {
  id:    string
  email: string
  name:  string
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: NotifierEvent) => {
  const { postId, postTitle, postUrl, postExcerpt, postStatus, postCategory, postReadingTime } = event

  log({ lambda: 'email-notifier', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, postTitle, postStatus } })

  // Only notify subscribers when the post is actually PUBLISHED
  if (postStatus && postStatus !== 'PUBLISHED') {
    log({ lambda: 'email-notifier', step: 'skip-review', status: 'skip', pct: 100,
      meta: { postId, postStatus } })
    return { sent: 0, skipped: `post is ${postStatus} — awaiting manual review` }
  }

  try {
    // ── Load SSM params ────────────────────────────────────────────────────
    const fromEmail    = await getParam('/wealthbeginners/ses/from-email')
    const nextjsUrl    = process.env.NEXTJS_SITE_URL!
    const internalSecret = process.env.INTERNAL_SECRET!

    // ── Fetch active subscribers via internal Next.js API ──────────────────
    log({ lambda: 'email-notifier', step: 'fetch-subscribers', status: 'start', pct: 5 })

    const subscribers = await fetchActiveSubscribers(nextjsUrl, internalSecret)

    log({ lambda: 'email-notifier', step: 'fetch-subscribers', status: 'complete', pct: 10,
      meta: { count: subscribers.length } })

    if (subscribers.length === 0) {
      log({ lambda: 'email-notifier', step: 'no-subscribers', status: 'skip', pct: 100 })
      return { sent: 0, failed: 0 }
    }

    // ── Send in batches of 50 ─────────────────────────────────────────────
    const batches   = chunk(subscribers, BATCH_SIZE)
    let totalSent   = 0
    let totalFailed = 0

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch    = batches[batchIdx]
      const batchPct = 10 + Math.floor((batchIdx / batches.length) * 85)

      log({ lambda: 'email-notifier', step: 'batch-send', status: 'start', pct: batchPct,
        meta: { batch: batchIdx + 1, of: batches.length, size: batch.length } })

      const results = await Promise.allSettled(
        batch.map((sub) =>
          sendPostNotification({
            to:              sub.email,
            name:            sub.name,
            fromEmail,
            postTitle,
            postExcerpt,
            postUrl,
            postCategory:    postCategory ?? '',
            postReadingTime: postReadingTime ?? 0,
          }),
        ),
      )

      const batchSent   = results.filter((r) => r.status === 'fulfilled').length
      const batchFailed = results.filter((r) => r.status === 'rejected').length
      totalSent   += batchSent
      totalFailed += batchFailed

      // Log individual failures
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          log({ lambda: 'email-notifier', step: 'send-failure', status: 'warn', pct: batchPct,
            meta: { email: batch[i].email, error: String((r as PromiseRejectedResult).reason) } })
        }
      })

      log({ lambda: 'email-notifier', step: 'batch-send', status: 'complete', pct: batchPct,
        meta: { batch: batchIdx + 1, sent: batchSent, failed: batchFailed } })

      // Delay between batches except after the last one
      if (batchIdx < batches.length - 1) {
        await sleep(BATCH_DELAY_MS)
      }
    }

    log({ lambda: 'email-notifier', step: 'handler-complete', status: 'complete', pct: 100,
      meta: { postId, totalSent, totalFailed } })

    return { sent: totalSent, failed: totalFailed }
  } catch (err) {
    log({ lambda: 'email-notifier', step: 'handler-error', status: 'error', pct: 0,
      meta: { error: String(err), postId } })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fetch subscribers from Next.js internal API
// ─────────────────────────────────────────────────────────────────────────────
async function fetchActiveSubscribers(baseUrl: string, secret: string): Promise<Subscriber[]> {
  const res = await fetch(`${baseUrl}/api/admin/subscribers`, {
    headers: { 'x-internal-secret': secret },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch subscribers: ${res.status} ${await res.text()}`)
  }
  const json = await res.json() as { subscribers: Subscriber[] }
  return json.subscribers
}

// ─────────────────────────────────────────────────────────────────────────────
//  Send a single new-post notification
// ─────────────────────────────────────────────────────────────────────────────
async function sendPostNotification(opts: {
  to:              string
  name:            string
  fromEmail:       string
  postTitle:       string
  postExcerpt:     string
  postUrl:         string
  postCategory:    string
  postReadingTime: number
}): Promise<void> {
  const { to, name, fromEmail, postTitle, postExcerpt, postUrl, postCategory, postReadingTime } = opts
  const siteUrl  = 'https://wealthbeginners.com'
  const unsubUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(to)}`

  // Use no-reply@ on the verified domain so recipients can't reply
  const domain      = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'wealthbeginners.com'
  const noreply     = `noreply@${domain}`
  const displayName = 'No Reply · WealthBeginners'

  const firstName  = name && name.trim() ? name.split(' ')[0] : ''
  const readLabel  = postReadingTime > 0 ? `${postReadingTime} min read` : '7 min read'
  const catLabel   = postCategory   || 'Personal Finance'
  const year       = new Date().getFullYear()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${postTitle}</title>
</head>
<body style="margin:0;padding:0;background:#F0EDE8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- ░░░ PREVIEW TEXT ░░░ -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F0EDE8;">
    ${postExcerpt.slice(0, 130)}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE8;padding:32px 16px 48px;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- ══════════════════════════════════════════════
         TOP LABEL
    ══════════════════════════════════════════════════ -->
    <tr>
      <td align="center" style="padding-bottom:18px;">
        <p style="margin:0;color:#8A7E6E;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">
          WealthBeginners &nbsp;·&nbsp; New Article
        </p>
      </td>
    </tr>

    <!-- ══════════════════════════════════════════════
         HEADER  (dark card)
    ══════════════════════════════════════════════════ -->
    <tr>
      <td style="background:#0B1628;border-radius:20px 20px 0 0;padding:36px 44px 0;text-align:center;">

        <!-- Wordmark -->
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:28px;">
          <tr>
            <td style="border:2px solid rgba(201,168,76,0.35);border-radius:10px;padding:10px 22px;">
              <span style="color:#C9A84C;font-size:15px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">WEALTHBEGINNERS</span>
            </td>
          </tr>
        </table>

        <!-- Hero title area -->
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(201,168,76,0.2);border-radius:14px 14px 0 0;padding:32px 32px 36px;margin:0 -4px;">
          <!-- Category + read-time pills -->
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:20px;">
            <tr>
              <td style="background:#C9A84C;border-radius:20px;padding:4px 14px;">
                <span style="color:#0B1628;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${catLabel}</span>
              </td>
              <td width="10"></td>
              <td style="background:rgba(255,255,255,0.1);border-radius:20px;padding:4px 14px;">
                <span style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:600;letter-spacing:0.08em;">⏱&nbsp;${readLabel}</span>
              </td>
            </tr>
          </table>

          <!-- Post title -->
          <h1 style="color:#FFFFFF;font-size:26px;font-weight:700;line-height:1.3;margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;text-align:center;">${postTitle}</h1>

          <!-- Excerpt -->
          <p style="color:rgba(255,255,255,0.65);font-size:14px;line-height:1.75;margin:0;text-align:center;">${postExcerpt}</p>
        </div>

      </td>
    </tr>

    <!-- Gold divider line -->
    <tr><td style="background:linear-gradient(90deg,transparent,#C9A84C 20%,#E8C96B 50%,#C9A84C 80%,transparent);height:2px;"></td></tr>

    <!-- ══════════════════════════════════════════════
         BODY  (white card)
    ══════════════════════════════════════════════════ -->
    <tr>
      <td style="background:#FFFFFF;padding:0 44px 40px;">

        <!-- Personal greeting -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:36px 0 24px;border-bottom:1px solid #F0EDE8;">
              <p style="margin:0 0 8px;color:#0B1628;font-size:16px;font-weight:700;">
                ${firstName ? `Hey ${firstName} 👋` : 'Hey there 👋'}
              </p>
              <p style="margin:0;color:#6B7280;font-size:14px;line-height:1.7;">
                We just dropped a brand-new guide for you. Here's a quick look at what's inside — and why it's worth your time today.
              </p>
            </td>
          </tr>
        </table>

        <!-- ── 3 value-prop icons ──────────────────────────── -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
          <tr>
            <td width="33%" style="text-align:center;padding:0 8px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:24px;margin:0 0 8px;">📖</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">In-Depth</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Comprehensive, beginner-friendly</p>
              </div>
            </td>
            <td width="33%" style="text-align:center;padding:0 8px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:24px;margin:0 0 8px;">💡</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Actionable</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Real steps, real numbers</p>
              </div>
            </td>
            <td width="33%" style="text-align:center;padding:0 8px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:24px;margin:0 0 8px;">🎯</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">No Jargon</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Plain English, always</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- ── "In this guide" highlight box ──────────────── -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="background:linear-gradient(135deg,#FFFBEF 0%,#FEF6DC 100%);border:1px solid #EDD98A;border-left:4px solid #C9A84C;border-radius:0 12px 12px 0;padding:20px 24px;">
              <p style="color:#92712A;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 8px;">✦ &nbsp;In this guide</p>
              <p style="color:#5C4A1E;font-size:14px;line-height:1.7;margin:0;">
                Practical, step-by-step strategies with real numbers you can act on today — written for beginners, zero financial jargon required.
              </p>
            </td>
          </tr>
        </table>

        <!-- ── Primary CTA button ─────────────────────────── -->
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;">
          <tr>
            <td style="background:#0B1628;border-radius:12px;box-shadow:0 4px 14px rgba(11,22,40,0.25);">
              <a href="${postUrl}"
                 style="display:block;color:#C9A84C;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;letter-spacing:0.04em;text-align:center;">
                Read the Full Guide &nbsp;→
              </a>
            </td>
          </tr>
        </table>

        <!-- Secondary link -->
        <p style="text-align:center;margin:0 0 36px;">
          <a href="${postUrl}" style="color:#9CA3AF;font-size:12px;text-decoration:underline;">${postUrl.replace('https://', '')}</a>
        </p>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="border-top:1px solid #F0EDE8;"></td></tr>
        </table>

        <!-- Subscription note -->
        <p style="color:#C5C0BA;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          You're receiving this because you subscribed to WealthBeginners.<br>
          This message was sent from a no-reply address — please do not reply.
        </p>

      </td>
    </tr>

    <!-- ══════════════════════════════════════════════
         FOOTER  (dark card)
    ══════════════════════════════════════════════════ -->
    <tr>
      <td style="background:#0B1628;border-radius:0 0 20px 20px;padding:28px 44px;text-align:center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <!-- Nav links -->
          <tr>
            <td align="center" style="padding-bottom:14px;">
              <a href="${siteUrl}" style="color:#C9A84C;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;margin:0 10px;">Website</a>
              <span style="color:rgba(255,255,255,0.15);font-size:11px;">|</span>
              <a href="${siteUrl}/blog" style="color:rgba(255,255,255,0.5);font-size:11px;text-decoration:none;margin:0 10px;">All Articles</a>
              <span style="color:rgba(255,255,255,0.15);font-size:11px;">|</span>
              <a href="${unsubUrl}" style="color:rgba(255,255,255,0.35);font-size:11px;text-decoration:underline;margin:0 10px;">Unsubscribe</a>
            </td>
          </tr>
          <!-- Legal -->
          <tr>
            <td align="center">
              <p style="color:rgba(255,255,255,0.22);font-size:10px;margin:0;letter-spacing:0.04em;line-height:1.6;">
                © ${year} WealthBeginners.com &nbsp;·&nbsp; All rights reserved.<br>
                Sent from a no-reply address — replies will not be received.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
  </td></tr>
  </table>
</body>
</html>`

  const plainText = [
    `══════════════════════════════`,
    `  WEALTHBEGINNERS — New Guide`,
    `══════════════════════════════`,
    ``,
    postTitle,
    `${catLabel} · ${readLabel}`,
    ``,
    postExcerpt,
    ``,
    `▶  Read the full guide:`,
    `   ${postUrl}`,
    ``,
    `──────────────────────────────`,
    `WealthBeginners.com`,
    `This is a no-reply address — please do not reply to this email.`,
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n')

  const input: SendEmailCommandInput = {
    Source: `${displayName} <${noreply}>`,
    ReplyToAddresses: [noreply],
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: `✦ New Guide: ${postTitle}`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html,      Charset: 'UTF-8' },
        Text: { Data: plainText, Charset: 'UTF-8' },
      },
    },
  }

  await ses.send(new SendEmailCommand(input))
}

// ─────────────────────────────────────────────────────────────────────────────
//  SSM helper
// ─────────────────────────────────────────────────────────────────────────────
async function getParam(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))
  return res.Parameter?.Value ?? ''
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

