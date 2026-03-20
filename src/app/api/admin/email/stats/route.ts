import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESClient, GetSendStatisticsCommand } from '@aws-sdk/client-ses'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'subscribers'

  if (view === 'delivery') {
    try {
      const ses = new SESClient({ region: process.env.REGION ?? 'us-east-1', credentials })
      const res = await ses.send(new GetSendStatisticsCommand({}))
      const stats = (res.SendDataPoints ?? [])
        .sort((a, b) => (a.Timestamp?.getTime() ?? 0) - (b.Timestamp?.getTime() ?? 0))
        .slice(-30)
        .map(p => ({
          timestamp:        p.Timestamp?.toISOString() ?? '',
          deliveryAttempts: p.DeliveryAttempts ?? 0,
          bounces:          p.Bounces ?? 0,
          complaints:       p.Complaints ?? 0,
          rejects:          p.Rejects ?? 0,
        }))
      return NextResponse.json({ stats })
    } catch (err) {
      console.error('[email/stats] SES error', err)
      return NextResponse.json({ stats: [] })
    }
  }

  // Default: subscriber list (paginated)
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
  const search = searchParams.get('search')?.trim() ?? ''
  const skip   = (page - 1) * limit

  const where = search
    ? { email: { contains: search, mode: 'insensitive' as const } }
    : {}

  const [subscribers, total, active] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, email: true, name: true, active: true, createdAt: true },
    }),
    prisma.subscriber.count({ where }),
    prisma.subscriber.count({ where: { active: true } }),
  ])

  return NextResponse.json({ subscribers, total, active, page, limit })
}
