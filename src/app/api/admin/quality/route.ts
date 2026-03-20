import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const view   = searchParams.get('view')   ?? 'posts'

  // Topic queue view
  if (view === 'topics') {
    const topics = await prisma.topicQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, keyword: true, status: true, category: true, createdAt: true },
    })
    return NextResponse.json({ topics: topics.map(t => ({ ...t, topic: t.keyword })) })
  }

  // Posts by filter
  const where: Record<string, unknown> = {}

  if (filter === 'low') {
    where.seoScore = { lt: 60 }
    where.status = 'PUBLISHED'
  } else if (filter === 'high') {
    where.seoScore = { gte: 80 }
    where.status = 'PUBLISHED'
  } else if (filter === 'failed') {
    where.status = 'REJECTED'
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: filter === 'failed' ? { createdAt: 'desc' } : { seoScore: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      seoScore: true,
      wordCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ posts })
}
