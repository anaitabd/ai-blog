import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, welcomeEmailHtml, FROM_EMAIL } from '@/lib/ses'
import { z } from 'zod'

const Schema = z.object({
  name:   z.string().max(100).default(''),
  email:  z.string().email(),
  source: z.string().max(50).default('website'),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = Schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const { name, email, source } = parsed.data

    const existing = await prisma.subscriber.findUnique({ where: { email } })
    if (existing) {
      // Re-activate if they previously unsubscribed
      if (!existing.active) {
        await prisma.subscriber.update({ where: { email }, data: { active: true } })
      }
      return NextResponse.json({ success: true, alreadySubscribed: true })
    }

    await prisma.subscriber.create({
      data: { name, email, source, active: true },
    })

    // Send welcome email via SES (non-blocking — don't fail subscription if email fails)
    try {
      await sendEmail({
        to:      email,
        from:    `Wealth Beginners <${FROM_EMAIL}>`,
        subject: 'Welcome to Wealth Beginners 🎉',
        html:    welcomeEmailHtml(email),
      })
    } catch (emailErr) {
      // TODO: Request SES production access at console.aws.amazon.com/ses before deploying to prod
      console.error('[newsletter] Welcome email failed (non-blocking):', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter subscription error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
