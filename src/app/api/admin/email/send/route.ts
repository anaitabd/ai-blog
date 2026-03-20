import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/ses'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const body = await req.json() as { subject?: string; body?: string }
  const { subject, body: emailBody } = body

  if (!subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  // Fetch all active subscribers
  const subscribers = await prisma.subscriber.findMany({
    where: { active: true },
    select: { email: true, name: true },
  })

  if (subscribers.length === 0) {
    return NextResponse.json({ error: 'No active subscribers' }, { status: 400 })
  }

  let sent = 0
  const errors: string[] = []

  // Send in batches of 14 (SES rate limit: 14/s by default on sandbox)
  const BATCH = 14
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async sub => {
        const personalizedBody = emailBody
          .replace(/\{name\}/g, sub.name ?? 'there')

        try {
          await sendEmail({
            to:      sub.email,
            subject,
            html:    personalizedBody.replace(/\n/g, '<br/>'),
            text:    personalizedBody,
          })
          sent++
        } catch (err) {
          errors.push(`${sub.email}: ${String(err)}`)
        }
      })
    )
    // Small delay between batches to respect SES rate limits
    if (i + BATCH < subscribers.length) {
      await new Promise(r => setTimeout(r, 1100))
    }
  }

  return NextResponse.json({
    ok: true,
    count: sent,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
