import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalPosts,
    publishedPosts,
    pendingPosts,
    rejectedPosts,
    totalSubscribers,
    weekSubscribers,
    pendingTopics,
    doneTopics,
    failedTopics,
    topPosts,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'REVIEW' } }),
    prisma.post.count({ where: { status: 'REJECTED' } }),
    prisma.subscriber.count({ where: { active: true } }),
    prisma.subscriber.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    prisma.topicQueue.count({ where: { status: 'PENDING' } }),
    prisma.topicQueue.count({ where: { status: 'DONE' } }),
    prisma.topicQueue.count({ where: { status: 'FAILED' } }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: { id: true, title: true, slug: true, viewCount: true, Category: { select: { name: true } } },
    }),
  ])

  return NextResponse.json({
    posts: {
      total: totalPosts,
      published: publishedPosts,
      pending: pendingPosts,
      rejected: rejectedPosts,
    },
    subscribers: {
      total: totalSubscribers,
      thisWeek: weekSubscribers,
    },
    topics: {
      pending: pendingTopics,
      done: doneTopics,
      failed: failedTopics,
    },
    topPosts,
  })
}
