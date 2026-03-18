import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBoardIdForCategory, createPin, buildPinDescription, buildPinTitle } from '@/lib/pinterest'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { Category: true, Tag: true },
  })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!post.pinterestImage && !post.featuredImage) {
    return NextResponse.json({ error: 'No image available for Pinterest' }, { status: 400 })
  }

  try {
    const pin = await createPin({
      title: buildPinTitle(post.title),
      description: buildPinDescription({
        title: post.title,
        excerpt: post.excerpt,
        tags: post.Tag.map(t => t.name),
        keyword: post.metaTitle,
      }),
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/${post.slug}?utm_source=pinterest`,
      imageUrl: post.pinterestImage ?? post.featuredImage!,
      boardId: getBoardIdForCategory(post.Category.name),
      altText: `${post.title} — WealthBeginners personal finance guide`,
    })

    await prisma.post.update({
      where: { id: params.id },
      data: {
        pinterestPinId: pin.id,
        pinterestPinUrl: pin.url,
        pinterestPinnedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, pinId: pin.id, pinUrl: pin.url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
