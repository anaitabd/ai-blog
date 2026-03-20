import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: 'desc' },
    select: { email: true, name: true, active: true, createdAt: true },
  })

  const rows = [
    'email,name,active,subscribed_at',
    ...subscribers.map(s => {
      const email  = `"${s.email.replace(/"/g, '""')}"`
      const name   = `"${(s.name ?? '').replace(/"/g, '""')}"`
      const active = s.active ? 'true' : 'false'
      const date   = s.createdAt.toISOString()
      return `${email},${name},${active},${date}`
    }),
  ].join('\n')

  return new NextResponse(rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
