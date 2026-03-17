import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const TopicSchema = z.object({
  keyword: z.string().min(5),
  category: z.string().min(2),
  priority: z.number().int().min(1).max(10).default(5),
})

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = TopicSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const topic = await prisma.topicQueue.create({
    data: {
      keyword: parsed.data.keyword,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ success: true, topic })
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topics = await prisma.topicQueue.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'desc' }],
  })

  return NextResponse.json({ topics })
}
