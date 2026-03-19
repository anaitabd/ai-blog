import { NextRequest, NextResponse } from 'next/server'
import {
  sendEmail,
  contactAdminEmailHtml,
  contactAutoReplyHtml,
  FROM_EMAIL,
} from '@/lib/ses'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { z } from 'zod'

const _region = process.env.REGION ?? process.env.AWS_REGION ?? 'us-east-1'
const _ssmCreds = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const ssm = new SSMClient({ region: _region, ...(_ssmCreds && { credentials: _ssmCreds }) })

const Schema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email(),
  subject: z.string().min(2).max(100),
  message: z.string().min(10).max(2000),
})

async function getAdminEmail(): Promise<string> {
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name:           '/wealthbeginners/admin-email',
      WithDecryption: true,
    }))
    return res.Parameter?.Value ?? FROM_EMAIL
  } catch {
    return FROM_EMAIL
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, subject, message } = parsed.data
    const adminEmail = await getAdminEmail()

    // Forward to admin
    await sendEmail({
      to:      adminEmail,
      from:    `WealthBeginners Contact <${FROM_EMAIL}>`,
      subject: `New Contact: ${subject}`,
      html:    contactAdminEmailHtml({ name, email, subject, message }),
    })

    // Auto-reply to sender
    await sendEmail({
      to:      email,
      from:    `Wealth Beginners <${FROM_EMAIL}>`,
      subject: `We received your message — ${subject}`,
      html:    contactAutoReplyHtml(name),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] SES send error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
