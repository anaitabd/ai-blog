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
  const displayName = 'WealthBeginners'

  const greeting   = name && name.trim() ? `Hi ${name.split(' ')[0]},` : 'Hi there,'
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
<body style="margin:0;padding:0;background:#EDEBE6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- PREVIEW TEXT -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#EDEBE6;">
    ${postExcerpt.slice(0, 130)}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEBE6;padding:40px 16px;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- ── HEADER ─────────────────────────────────────────── -->
      <tr>
        <td style="background:#0B1628;border-radius:14px 14px 0 0;padding:26px 40px 22px;text-align:center;">
          <p style="margin:0 0 4px;color:#C9A84C;font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">WEALTHBEGINNERS</p>
          <p style="margin:0;color:rgba(255,255,255,0.38);font-size:11px;letter-spacing:0.06em;">Smart money · simplified</p>
        </td>
      </tr>
      <!-- gold accent line -->
      <tr><td style="background:linear-gradient(90deg,#C9A84C 0%,#E8C96B 50%,#C9A84C 100%);height:3px;"></td></tr>

      <!-- ── BODY ────────────────────────────────────────────── -->
      <tr>
        <td style="background:#FFFFFF;padding:40px 40px 32px;">

          <!-- "New Article" badge -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="background:#FEF9EC;border:1px solid #F0D97A;border-radius:20px;padding:5px 14px;">
                <span style="color:#92712A;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">✦ New Article</span>
              </td>
            </tr>
          </table>

          <!-- Greeting -->
          <p style="color:#374151;font-size:15px;margin:0 0 6px;font-weight:600;">${greeting}</p>
          <p style="color:#6B7280;font-size:14px;line-height:1.65;margin:0 0 28px;">We just published a new guide. Here's everything you need to know:</p>

          <!-- ── Article Card ───────────────────────────────────── -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7F4;border:1px solid #E5E2DC;border-left:4px solid #C9A84C;border-radius:0 10px 10px 0;margin-bottom:28px;">
            <tr>
              <td style="padding:24px 26px 20px;">
                <!-- Category + read time pill row -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                  <tr>
                    <td style="background:#0B1628;border-radius:4px;padding:3px 10px;margin-right:8px;">
                      <span style="color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${catLabel}</span>
                    </td>
                    <td width="10"></td>
                    <td style="background:#F0EDE8;border-radius:4px;padding:3px 10px;">
                      <span style="color:#6B7280;font-size:10px;font-weight:600;letter-spacing:0.06em;">⏱ ${readLabel}</span>
                    </td>
                  </tr>
                </table>
                <!-- Title -->
                <h1 style="color:#0B1628;font-size:21px;font-weight:700;line-height:1.3;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;">${postTitle}</h1>
                <!-- Excerpt -->
                <p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0;">${postExcerpt}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 26px 24px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#0B1628;border-radius:8px;">
                      <a href="${postUrl}" style="display:block;color:#C9A84C;font-size:13px;font-weight:700;text-decoration:none;padding:11px 24px;letter-spacing:0.03em;">Read the Full Guide →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- ── "What you'll learn" callout ───────────────────── -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF0;border:1px solid #F3E8C0;border-radius:10px;margin-bottom:28px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="color:#92712A;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">In this guide</p>
                <p style="color:#5C4A1E;font-size:13px;line-height:1.65;margin:0;">Practical, step-by-step strategies with real numbers you can act on today — written for beginners, no financial jargon.</p>
              </td>
            </tr>
          </table>

          <p style="color:#D1CFC9;font-size:11px;text-align:center;margin:0;">You received this because you subscribed to WealthBeginners updates.</p>
        </td>
      </tr>

      <!-- ── FOOTER ──────────────────────────────────────────── -->
      <tr>
        <td style="background:#0B1628;border-radius:0 0 14px 14px;padding:22px 40px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-bottom:10px;">
                <a href="${siteUrl}" style="color:#C9A84C;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;margin:0 12px;">Visit Website</a>
                <span style="color:rgba(255,255,255,0.2);font-size:11px;">|</span>
                <a href="${siteUrl}/blog" style="color:rgba(255,255,255,0.45);font-size:11px;text-decoration:none;margin:0 12px;">All Articles</a>
                <span style="color:rgba(255,255,255,0.2);font-size:11px;">|</span>
                <a href="${unsubUrl}" style="color:rgba(255,255,255,0.35);font-size:11px;text-decoration:underline;margin:0 12px;">Unsubscribe</a>
              </td>
            </tr>
            <tr>
              <td align="center">
                <p style="color:rgba(255,255,255,0.25);font-size:10px;margin:0;letter-spacing:0.04em;">© ${year} WealthBeginners.com · This email was sent from a no-reply address.</p>
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
    `${postTitle}`,
    ``,
    `${catLabel} · ${readLabel}`,
    ``,
    postExcerpt,
    ``,
    `Read the full guide: ${postUrl}`,
    ``,
    `─────────────────────────────`,
    `WealthBeginners.com`,
    `This email was sent from a no-reply address.`,
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n')

  const input: SendEmailCommandInput = {
    Source: `${displayName} <${noreply}>`,
    ReplyToAddresses: [noreply],
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: `New on WealthBeginners: ${postTitle}`, Charset: 'UTF-8' },
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

