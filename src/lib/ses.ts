// ─────────────────────────────────────────────────────────────────────────────
//  Email helper — Resend (primary) → AWS SES (fallback)
//
//  Resend:  set RESEND_API_KEY  in .env → https://resend.com (free, no sandbox)
//  SES:     set APP_KEY_ID / APP_KEY_SECRET + SES_FROM_EMAIL  (sandbox until
//           AWS approves production access)
// ─────────────────────────────────────────────────────────────────────────────

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { Resend } from 'resend'

// ── Resend client (lazy — only created when key is present) ───────────────────
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

// ── SES client ────────────────────────────────────────────────────────────────
const _region = process.env.REGION ?? process.env.AWS_REGION ?? 'us-east-1'
const _sesCredentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const ses = new SESClient({ region: _region, ...(_sesCredentials && { credentials: _sesCredentials }) })

export const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'hello@wealthbeginners.com'
export const SITE_URL   = 'https://www.wealthbeginners.com'

// ─────────────────────────────────────────────────────────────────────────────
//  Low-level send wrapper — tries Resend first, falls back to SES
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmail(opts: {
  to:       string | string[]
  from?:    string
  subject:  string
  html:     string
  text?:    string
}): Promise<void> {
  const toAddresses = Array.isArray(opts.to) ? opts.to : [opts.to]
  const from        = opts.from ?? `WealthBeginners <${FROM_EMAIL}>`

  // ── Try Resend first (no sandbox, free tier, instant) ─────────────────────
  const resend = getResend()
  if (resend) {
    const { error } = await resend.emails.send({
      from,
      to:      toAddresses,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text ?? stripHtml(opts.html),
    })
    if (!error) return // success
    console.warn('[email] Resend failed, falling back to SES:', error.message)
  }

  // ── Fall back to SES ───────────────────────────────────────────────────────
  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: opts.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: opts.html,            Charset: 'UTF-8' },
          Text: { Data: opts.text ?? stripHtml(opts.html), Charset: 'UTF-8' },
        },
      },
    }),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Welcome email  (newsletter subscriber)
// ─────────────────────────────────────────────────────────────────────────────
export function welcomeEmailHtml(email: string): string {
  const unsubUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Wealth Beginners</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B1628;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:40px 40px 24px;text-align:center;background:#162035;">
            <img src="${SITE_URL}/brand/logo-primary.svg" alt="Wealth Beginners" width="180" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="color:#C9A84C;font-size:28px;font-weight:700;margin:0 0 16px;font-family:Georgia,serif;font-style:italic;">
              Welcome to the family! 🎉
            </h1>
            <p style="color:#FAF8F3;font-size:16px;line-height:1.6;margin:0 0 20px;">
              You&apos;re now part of a community learning to build wealth from zero. Every week you&apos;ll get practical money tips, investing basics, and financial guides — all designed for beginners.
            </p>
            <p style="color:rgba(250,248,243,0.7);font-size:14px;line-height:1.6;margin:0 0 32px;">
              No jargon. No gatekeeping. Just clear, actionable advice you can start using today.
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#C9A84C;border-radius:10px;padding:14px 32px;text-align:center;">
                  <a href="${SITE_URL}/blog" style="color:#0B1628;font-size:15px;font-weight:700;text-decoration:none;display:block;">
                    Read Latest Posts →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
            <p style="color:rgba(250,248,243,0.4);font-size:12px;margin:0;">
              You&apos;re receiving this because you subscribed at wealthbeginners.com<br>
              <a href="${unsubUrl}" style="color:#C9A84C;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  New post notification email  (subscriber blast)
// ─────────────────────────────────────────────────────────────────────────────
export function newPostEmailHtml(opts: {
  postTitle:   string
  postExcerpt: string
  postUrl:     string
  email:       string
}): string {
  const { postTitle, postExcerpt, postUrl, email } = opts
  const unsubUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${postTitle}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B1628;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 20px;background:#162035;text-align:center;">
            <img src="${SITE_URL}/brand/logo-primary.svg" alt="Wealth Beginners" width="160" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <!-- Badge -->
        <tr>
          <td style="padding:24px 40px 0;">
            <span style="background:#C9A84C;color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:4px 12px;border-radius:20px;">
              New Post
            </span>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:16px 40px 32px;">
            <h1 style="color:#FAF8F3;font-size:24px;font-weight:700;margin:0 0 12px;font-family:Georgia,serif;line-height:1.3;">
              ${postTitle}
            </h1>
            <p style="color:rgba(250,248,243,0.7);font-size:15px;line-height:1.6;margin:0 0 28px;">
              ${postExcerpt}
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#C9A84C;border-radius:10px;padding:13px 28px;">
                  <a href="${postUrl}" style="color:#0B1628;font-size:14px;font-weight:700;text-decoration:none;display:block;">
                    Read Full Post →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
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
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contact form — admin notification email
// ─────────────────────────────────────────────────────────────────────────────
export function contactAdminEmailHtml(opts: {
  name:    string
  email:   string
  subject: string
  message: string
}): string {
  const { name, email, subject, message } = opts
  const ts = new Date().toISOString()
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#0B1628;border-bottom:2px solid #C9A84C;padding-bottom:8px;">New Contact Form Submission</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;font-weight:700;width:100px;">Name:</td><td>${name}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Email:</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Subject:</td><td>${subject}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Time:</td><td>${ts}</td></tr>
  </table>
  <h3 style="color:#0B1628;margin-top:20px;">Message:</h3>
  <div style="background:#f9f9f9;border-left:4px solid #C9A84C;padding:16px;white-space:pre-wrap;">${message}</div>
</body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contact form — auto-reply to sender
// ─────────────────────────────────────────────────────────────────────────────
export function contactAutoReplyHtml(name: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B1628;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="padding:36px 40px 28px;background:#162035;text-align:center;">
            <img src="${SITE_URL}/brand/logo-primary.svg" alt="Wealth Beginners" width="160" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#C9A84C;font-family:Georgia,serif;font-style:italic;margin:0 0 16px;">Hi ${name}, we got your message!</h2>
            <p style="color:#FAF8F3;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Thanks for reaching out to Wealth Beginners. We&apos;ll get back to you within 1–2 business days.
            </p>
            <p style="color:rgba(250,248,243,0.6);font-size:13px;">
              In the meantime, check out our latest guides at
              <a href="${SITE_URL}/blog" style="color:#C9A84C;">wealthbeginners.com/blog</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
            <p style="color:rgba(250,248,243,0.35);font-size:12px;margin:0;">Wealth Beginners · wealthbeginners.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// ─── Strip HTML for text fallback ─────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

