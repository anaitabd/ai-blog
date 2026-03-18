import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export type PipelineItem = {
  id: string
  keyword: string
  status: string
  source: string | null
  failReason: string | null
  currentStep: string | null
  processedAt: string | null
  processingAt: string | null
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const topics = await prisma.topicQueue.findMany({
    where: {
      OR: [
        { status: 'PROCESSING' },
        { processedAt: { gte: since } },
        { status: 'FAILED', createdAt: { gte: since } },
        { status: 'DONE', createdAt: { gte: since } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  const items: PipelineItem[] = topics.map((t) => ({
    id: t.id,
    keyword: t.keyword,
    status: t.status,
    source: t.source,
    failReason: t.failReason,
    currentStep: null,
    processedAt: t.processedAt?.toISOString() ?? null,
    processingAt: null,
  }))

  return NextResponse.json({ items, updatedAt: new Date().toISOString() })
}


