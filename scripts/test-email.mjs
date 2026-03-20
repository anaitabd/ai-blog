// Test email sending — run: node scripts/test-email.mjs your@email.com
// Tests Resend first, then SES fallback
import { config } from 'dotenv'
config()

const to = process.argv[2]
if (!to) {
  console.error('Usage: node scripts/test-email.mjs your@email.com')
  process.exit(1)
}

const FROM = process.env.SES_FROM_EMAIL ?? 'hello@wealthbeginners.com'

// ── Try Resend ──────────────────────────────────────────────────────────────
const resendKey = process.env.RESEND_API_KEY
if (resendKey) {
  console.log('Testing Resend...')
  const { Resend } = await import('resend')
  const resend = new Resend(resendKey)
  const { data, error } = await resend.emails.send({
    from: `WealthBeginners <${FROM}>`,
    to,
    subject: '✅ WealthBeginners email test (Resend)',
    html: '<p>This is a test from <strong>WealthBeginners</strong> via Resend. If you see this, welcome emails are working! 🎉</p>',
  })
  if (error) {
    console.error('❌ Resend failed:', error.message)
  } else {
    console.log('✅ Resend sent! Message ID:', data?.id)
    console.log('Check your inbox at', to)
    process.exit(0)
  }
} else {
  console.log('⚠️  RESEND_API_KEY not set — skipping Resend test')
}

// ── Try SES ─────────────────────────────────────────────────────────────────
console.log('Testing AWS SES...')
const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
const ses = new SESClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId:     process.env.APP_KEY_ID     ?? process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.APP_KEY_SECRET ?? process.env.AWS_SECRET_ACCESS_KEY,
  },
})

try {
  const result = await ses.send(new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: '✅ WealthBeginners email test (SES)', Charset: 'UTF-8' },
      Body: { Text: { Data: 'Test from WealthBeginners via SES.', Charset: 'UTF-8' } },
    },
  }))
  console.log('✅ SES sent! MessageId:', result.MessageId)
} catch (e) {
  console.error('❌ SES failed:', e.message)
  if (e.message.includes('not verified')) {
    console.log('')
    console.log('→ SES is in SANDBOX MODE — emails only go to verified addresses.')
    console.log('→ Fix: add RESEND_API_KEY to .env (resend.com — free, 2 minutes)')
    console.log('→ OR: request SES production access at console.aws.amazon.com/ses')
  }
}

