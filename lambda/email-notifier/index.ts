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
  postId:      string
  postTitle:   string
  postUrl:     string
  postExcerpt: string
}

interface Subscriber {
  id:    string
  email: string
  name:  string
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: NotifierEvent) => {
  const { postId, postTitle, postUrl, postExcerpt } = event

  log({ lambda: 'email-notifier', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, postTitle } })

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
            to:          sub.email,
            fromEmail,
            postTitle,
            postExcerpt,
            postUrl,
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
  to:          string
  fromEmail:   string
  postTitle:   string
  postExcerpt: string
  postUrl:     string
}): Promise<void> {
  const { to, fromEmail, postTitle, postExcerpt, postUrl } = opts
  const siteUrl  = 'https://wealthbeginners.com'
  const unsubUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(to)}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${postTitle}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B1628;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="padding:32px 40px 20px;background:#162035;text-align:center;">
            <img src="${siteUrl}/brand/logo-primary.svg" alt="Wealth Beginners" width="160" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <span style="background:#C9A84C;color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:4px 12px;border-radius:20px;">New Post</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 32px;">
            <h1 style="color:#FAF8F3;font-size:24px;font-weight:700;margin:0 0 12px;font-family:Georgia,serif;line-height:1.3;">${postTitle}</h1>
            <p style="color:rgba(250,248,243,0.7);font-size:15px;line-height:1.6;margin:0 0 28px;">${postExcerpt}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#C9A84C;border-radius:10px;padding:13px 28px;">
                  <a href="${postUrl}" style="color:#0B1628;font-size:14px;font-weight:700;text-decoration:none;display:block;">Read Full Post →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
            <p style="color:rgba(250,248,243,0.4);font-size:12px;margin:0;">
              Wealth Beginners · wealthbeginners.com<br>
              <a href="${unsubUrl}" style="color:#C9A84C;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const input: SendEmailCommandInput = {
    Source: `Wealth Beginners <${fromEmail}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: `New: ${postTitle}`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        Text: { Data: `${postTitle}\n\n${postExcerpt}\n\nRead more: ${postUrl}\n\nUnsubscribe: ${unsubUrl}`, Charset: 'UTF-8' },
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

