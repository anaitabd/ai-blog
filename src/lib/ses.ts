// ─────────────────────────────────────────────────────────────────────────────
//  TODO: SES PRODUCTION ACCESS REQUIRED
//  Go to: https://console.aws.amazon.com/ses/home#/account
//  Click "Request production access"
//  Fill the form — takes 24-48 hours to approve
//  Until then, only verified email addresses receive emails
// ─────────────────────────────────────────────────────────────────────────────

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

export const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'noreply@wealthbeginners.com'
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
  const from        = opts.from ?? `No Reply · WealthBeginners <${FROM_EMAIL}>`

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
          Html: { Data: opts.html,                       Charset: 'UTF-8' },
          Text: { Data: opts.text ?? stripHtml(opts.html), Charset: 'UTF-8' },
        },
      },
    }),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared design tokens (inline — email clients strip <style> blocks)
// ─────────────────────────────────────────────────────────────────────────────
// bg:      #F0EDE8   warm off-white wrapper
// card:    #0B1628   dark navy card
// header:  #162035   slightly lighter strip
// gold:    #C9A84C   primary accent
// lgold:   #E8C96B   highlight accent
// body tx: #FAF8F3   card text
// muted:   rgba(250,248,243,0.65)

/** CSS text wordmark — renders everywhere, no image load required */
function wordmark(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px;">
      <tr>
        <td style="border:2px solid rgba(201,168,76,0.45);border-radius:8px;padding:8px 20px;">
          <span style="color:#C9A84C;font-size:13px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">WEALTHBEGINNERS</span>
        </td>
      </tr>
    </table>`
}

/** Gold gradient divider bar */
function goldDivider(): string {
  return `<tr><td style="background:linear-gradient(90deg,transparent,#C9A84C 20%,#E8C96B 50%,#C9A84C 80%,transparent);height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>`
}

/** Dark footer row */
function darkFooter(unsubUrl?: string): string {
  const year = new Date().getFullYear()
  return `
    <tr>
      <td style="background:#0B1628;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;">
        <p style="color:rgba(250,248,243,0.35);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;">WealthBeginners &nbsp;·&nbsp; wealthbeginners.com</p>
        <p style="color:rgba(250,248,243,0.25);font-size:11px;margin:0;">
          © ${year} WealthBeginners. All rights reserved.
          ${unsubUrl ? `&nbsp;·&nbsp;<a href="${unsubUrl}" style="color:rgba(201,168,76,0.6);text-decoration:underline;">Unsubscribe</a>` : ''}
        </p>
      </td>
    </tr>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Welcome email  (newsletter subscriber)
// ─────────────────────────────────────────────────────────────────────────────
export function welcomeEmailHtml(email: string, name?: string): string {
  const unsubUrl  = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}`
  const firstName = name && name.trim() ? name.split(' ')[0] : ''
  const greeting  = firstName ? `Hey ${firstName}, welcome aboard! 🎉` : `Welcome aboard! 🎉`
  const preview   = `You're now part of a community learning to build real wealth from scratch.`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Welcome to WealthBeginners</title>
</head>
<body style="margin:0;padding:0;background:#F0EDE8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F0EDE8;">
    ${preview}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE8;padding:32px 16px 48px;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- top label -->
    <tr>
      <td align="center" style="padding-bottom:18px;">
        <p style="margin:0;color:#8A7E6E;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">
          WealthBeginners &nbsp;·&nbsp; You're In
        </p>
      </td>
    </tr>

    <!-- ── DARK HEADER ─────────────────────────────── -->
    <tr>
      <td style="background:#0B1628;border-radius:20px 20px 0 0;padding:36px 44px 32px;text-align:center;">
        ${wordmark()}
        <h1 style="color:#FFFFFF;font-size:28px;font-weight:700;line-height:1.25;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;">
          ${greeting}
        </h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0;">
          ${preview}
        </p>
      </td>
    </tr>

    ${goldDivider()}

    <!-- ── WHITE BODY ──────────────────────────────── -->
    <tr>
      <td style="background:#FFFFFF;padding:36px 44px 8px;">

        <!-- personal note -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #F0EDE8;">
              <p style="margin:0 0 10px;color:#0B1628;font-size:15px;font-weight:700;">
                ${firstName ? `Great to have you here, ${firstName}! 👋` : 'Great to have you here! 👋'}
              </p>
              <p style="margin:0;color:#6B7280;font-size:14px;line-height:1.75;">
                Every week you'll get practical money tips, investing basics, and financial guides — all written for people just starting out. No jargon. No gatekeeping. Just clear, actionable advice.
              </p>
            </td>
          </tr>
        </table>

        <!-- 3 value-prop cards -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td width="33%" style="text-align:center;padding:0 6px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:22px;margin:0 0 8px;">📖</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Weekly Guides</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Deep-dives, easy to follow</p>
              </div>
            </td>
            <td width="33%" style="text-align:center;padding:0 6px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:22px;margin:0 0 8px;">💡</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Actionable Tips</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Real steps, real numbers</p>
              </div>
            </td>
            <td width="33%" style="text-align:center;padding:0 6px;">
              <div style="background:#F8F6F1;border-radius:12px;padding:18px 10px;">
                <p style="font-size:22px;margin:0 0 8px;">🎯</p>
                <p style="color:#0B1628;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Zero Jargon</p>
                <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.4;">Plain English, always</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- gold callout box -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="background:#FDFAF3;border:1px solid rgba(201,168,76,0.3);border-left:4px solid #C9A84C;border-radius:0 10px 10px 0;padding:16px 20px;">
              <p style="margin:0;color:#0B1628;font-size:13px;font-weight:700;margin-bottom:4px;">🚀 Start here</p>
              <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.6;">
                Browse our most popular beginner guides and pick the topic that matters most to you right now.
              </p>
            </td>
          </tr>
        </table>

        <!-- CTA button -->
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 36px;">
          <tr>
            <td style="background:#C9A84C;border-radius:10px;padding:14px 36px;">
              <a href="${SITE_URL}/blog" style="color:#0B1628;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
                Explore the Guides &rarr;
              </a>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    ${darkFooter(unsubUrl)}

  </table>
  </td></tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contact form — admin notification email  (internal, minimal design)
// ─────────────────────────────────────────────────────────────────────────────
export function contactAdminEmailHtml(opts: {
  name:    string
  email:   string
  subject: string
  message: string
}): string {
  const { name, email, subject, message } = opts
  const ts = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Contact: ${subject}</title></head>
<body style="margin:0;padding:0;background:#F0EDE8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE8;padding:32px 16px 48px;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">

    <!-- header -->
    <tr>
      <td style="background:#0B1628;padding:24px 36px;border-bottom:3px solid #C9A84C;">
        <p style="margin:0;color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">WealthBeginners Admin</p>
        <h1 style="margin:6px 0 0;color:#FFFFFF;font-size:20px;font-weight:700;">📬 New Contact Form Submission</h1>
      </td>
    </tr>

    <!-- meta table -->
    <tr>
      <td style="padding:28px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr style="border-bottom:1px solid #F0EDE8;">
            <td style="padding:10px 0;color:#9CA3AF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;width:90px;">From</td>
            <td style="padding:10px 0;color:#0B1628;font-size:14px;font-weight:600;">${name} &nbsp;<span style="color:#9CA3AF;font-weight:400;">&lt;<a href="mailto:${email}" style="color:#C9A84C;text-decoration:none;">${email}</a>&gt;</span></td>
          </tr>
          <tr style="border-bottom:1px solid #F0EDE8;">
            <td style="padding:10px 0;color:#9CA3AF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Subject</td>
            <td style="padding:10px 0;color:#0B1628;font-size:14px;">${subject}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#9CA3AF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Received</td>
            <td style="padding:10px 0;color:#6B7280;font-size:13px;">${ts}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- message body -->
    <tr>
      <td style="padding:24px 36px 36px;">
        <p style="margin:0 0 10px;color:#9CA3AF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Message</p>
        <div style="background:#F8F6F1;border-left:4px solid #C9A84C;border-radius:0 10px 10px 0;padding:18px 20px;color:#374151;font-size:14px;line-height:1.75;white-space:pre-wrap;">${message}</div>
      </td>
    </tr>

    <!-- footer -->
    <tr>
      <td style="background:#F8F6F1;padding:16px 36px;border-top:1px solid #F0EDE8;text-align:center;">
        <p style="margin:0;color:#9CA3AF;font-size:11px;">This is an automated notification from WealthBeginners contact form.</p>
      </td>
    </tr>

  </table>
  </td></tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contact form — auto-reply to sender
// ─────────────────────────────────────────────────────────────────────────────
export function contactAutoReplyHtml(name: string): string {
  const firstName = name && name.trim() ? name.split(' ')[0] : name
  const preview   = `We received your message and will get back to you within 1–2 business days.`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>We received your message</title>
</head>
<body style="margin:0;padding:0;background:#F0EDE8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F0EDE8;">
    ${preview}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE8;padding:32px 16px 48px;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- top label -->
    <tr>
      <td align="center" style="padding-bottom:18px;">
        <p style="margin:0;color:#8A7E6E;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">
          WealthBeginners &nbsp;·&nbsp; Support
        </p>
      </td>
    </tr>

    <!-- ── DARK HEADER ─────────────────────────────── -->
    <tr>
      <td style="background:#0B1628;border-radius:20px 20px 0 0;padding:36px 44px 32px;text-align:center;">
        ${wordmark()}
        <h1 style="color:#FFFFFF;font-size:26px;font-weight:700;line-height:1.3;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;">
          Got your message, ${firstName}! ✉️
        </h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0;">
          ${preview}
        </p>
      </td>
    </tr>

    ${goldDivider()}

    <!-- ── WHITE BODY ──────────────────────────────── -->
    <tr>
      <td style="background:#FFFFFF;padding:36px 44px 8px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #F0EDE8;">
              <p style="margin:0 0 10px;color:#0B1628;font-size:15px;font-weight:700;">
                Thanks for reaching out 👋
              </p>
              <p style="margin:0;color:#6B7280;font-size:14px;line-height:1.75;">
                Our team has received your enquiry and we'll review it shortly. We aim to respond to all messages within <strong>1–2 business days</strong>.
              </p>
            </td>
          </tr>
        </table>

        <!-- what happens next -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="background:#F8F6F1;border-radius:12px;padding:20px 24px;">
              <p style="margin:0 0 12px;color:#0B1628;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What happens next</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:6px 0;color:#374151;font-size:13px;line-height:1.6;">
                    <span style="color:#C9A84C;font-weight:700;">01 &nbsp;</span> Your message lands in our inbox right now
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#374151;font-size:13px;line-height:1.6;">
                    <span style="color:#C9A84C;font-weight:700;">02 &nbsp;</span> A real person reviews it (no bots here!)
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#374151;font-size:13px;line-height:1.6;">
                    <span style="color:#C9A84C;font-weight:700;">03 &nbsp;</span> We reply directly to this email address
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 36px;">
          <tr>
            <td style="background:#C9A84C;border-radius:10px;padding:13px 32px;">
              <a href="${SITE_URL}/blog" style="color:#0B1628;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
                Browse Our Guides &rarr;
              </a>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    ${darkFooter()}

  </table>
  </td></tr>
  </table>
</body>
</html>`
}

// ─── Strip HTML for plain-text fallback ───────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
}
