// Internal endpoint — called by email-notifier Lambda to retrieve active subscribers.
// Auth: x-internal-secret header (same secret used by YouTube publisher Lambda).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscribers = await prisma.subscriber.findMany({
      where:   { active: true },
      select:  { id: true, email: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ subscribers })
  } catch (err) {
    console.error('[admin/subscribers] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

