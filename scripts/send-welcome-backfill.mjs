// Send welcome emails to subscribers who never got one
// Run AFTER adding RESEND_API_KEY to .env:
//   node scripts/send-welcome-backfill.mjs
import { config } from 'dotenv'
config()

const { PrismaClient } = await import('@prisma/client')
const { Resend } = await import('resend')

const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = `WealthBeginners <${process.env.SES_FROM_EMAIL ?? 'hello@wealthbeginners.com'}>`
const SITE   = 'https://www.wealthbeginners.com'

function welcomeHtml(email) {
  const unsub = `${SITE}/unsubscribe?email=${encodeURIComponent(email)}`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome to WealthBeginners</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B1628;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:36px 40px 24px;background:#162035;text-align:center;">
          <h2 style="color:#C9A84C;font-family:Georgia,serif;font-size:24px;margin:0;">WealthBeginners</h2>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="color:#C9A84C;font-size:26px;font-weight:700;margin:0 0 16px;font-family:Georgia,serif;font-style:italic;">
            Welcome to the family! 🎉
          </h1>
          <p style="color:#FAF8F3;font-size:15px;line-height:1.6;margin:0 0 20px;">
            You're now part of a community learning to build wealth from zero. Every week you'll get practical money tips, investing basics, and financial guides — all designed for beginners.
          </p>
          <p style="color:rgba(250,248,243,0.7);font-size:14px;line-height:1.6;margin:0 0 32px;">
            No jargon. No gatekeeping. Just clear, actionable advice you can start using today.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="background:#C9A84C;border-radius:10px;padding:14px 32px;text-align:center;">
              <a href="${SITE}/blog" style="color:#0B1628;font-size:15px;font-weight:700;text-decoration:none;display:block;">Read Latest Posts →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
          <p style="color:rgba(250,248,243,0.35);font-size:12px;margin:0;">
            You subscribed at wealthbeginners.com ·
            <a href="${unsub}" style="color:#C9A84C;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function run() {
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not set in .env — aborting')
    process.exit(1)
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Sending welcome emails to ${subscribers.length} subscribers...`)
  let sent = 0, failed = 0

  for (const sub of subscribers) {
    try {
      const { error } = await resend.emails.send({
        from:    FROM,
        to:      sub.email,
        subject: 'Welcome to WealthBeginners 🎉',
        html:    welcomeHtml(sub.email),
      })
      if (error) throw new Error(error.message)
      console.log(`  ✅ Sent to ${sub.email}`)
      sent++
      // Rate limit: 1 email/sec on free tier
      await new Promise(r => setTimeout(r, 1100))
    } catch (e) {
      console.error(`  ❌ Failed for ${sub.email}: ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${sent} sent, ${failed} failed.`)
  await prisma.$disconnect()
}

run()

