import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { searchParams } = new URL(req.url)

  // List published posts for the "Generate Short" dropdown
  if (searchParams.get('list_posts') === '1') {
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 100,
      select: { id: true, title: true },
    })
    return NextResponse.json({ posts })
  }

  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const skip  = (page - 1) * limit

  const [shorts, total] = await Promise.all([
    prisma.youtubeShort.findMany({
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        youtubeVideoId: true,
        youtubeVideoUrl: true,
        publishedAt: true,
        post: { select: { title: true } },
      },
    }),
    prisma.youtubeShort.count(),
  ])

  return NextResponse.json({
    shorts: shorts.map(s => ({
      id:             s.id,
      title:          s.title,
      youtubeVideoId: s.youtubeVideoId,
      youtubeVideoUrl: s.youtubeVideoUrl,
      publishedAt:    s.publishedAt,
      postTitle:      s.post?.title ?? null,
    })),
    total,
    page,
    limit,
  })
}
