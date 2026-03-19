import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  postId:          z.string().min(1),
  youtubeVideoId:  z.string().min(1),
  youtubeVideoUrl: z.string().url(),
  s3VideoUrl:      z.string().min(1),
  title:           z.string().min(1),
  caption:         z.string().optional(),
  script:          z.string().optional(),
})

export async function POST(req: NextRequest) {
  // Verify request comes from internal Lambda
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body   = await req.json()
    const parsed = Schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { postId, youtubeVideoId, youtubeVideoUrl, s3VideoUrl, title, caption, script } = parsed.data

    // Verify post exists
    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) {
      return NextResponse.json({ error: `Post ${postId} not found` }, { status: 404 })
    }

    const youtubeShort = await prisma.youtubeShort.create({
      data: {
        postId,
        youtubeVideoId,
        youtubeVideoUrl,
        s3VideoUrl,
        title,
        caption:     caption ?? null,
        script:      script  ?? null,
        publishedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, youtubeShort })
  } catch (err) {
    console.error('[POST /api/publish/youtube] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

