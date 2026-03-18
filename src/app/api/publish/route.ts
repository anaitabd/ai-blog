import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runQualityGate, calcReadingTime } from '@/lib/quality-gate'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const PublishSchema = z.object({
  secret: z.string(),
  title: z.string().min(10),
  slug: z.string().min(3).optional(),
  excerpt: z.string().min(50),
  content: z.string().min(500),
  metaTitle: z.string().min(10).max(70),
  metaDesc: z.string().min(50).max(170),
  categoryName: z.string().min(2),
  tags: z.array(z.string()).min(1).max(10),
  featuredImage: z.string().url().optional(),
  schemaJson: z.string().optional(),
})

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-')
    .slice(0, 80)
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base
  let suffix = 2
  while (await prisma.post.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix++}`
  }
  return candidate
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PublishSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { secret, categoryName, tags, slug: rawSlug, ...data } = parsed.data

    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quality = runQualityGate(data.content)
    if (!quality.passed) {
      return NextResponse.json(
        { error: 'Quality gate failed', issues: quality.issues },
        { status: 422 }
      )
    }

    // Generate + deduplicate slug
    const slugBase = rawSlug ?? titleToSlug(data.title)
    const slug     = await uniqueSlug(slugBase)

    const categorySlug = categoryName.toLowerCase().replaceAll(/\s+/g, '-')
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: categoryName, slug: categorySlug },
    })

    const tagRecords = await Promise.all(
      tags.map((tag) => {
        const tagSlug = tag.toLowerCase().replaceAll(/\s+/g, '-')
        return prisma.tag.upsert({
          where: { slug: tagSlug },
          update: {},
          create: { name: tag, slug: tagSlug },
        })
      })
    )

    const wordCount   = quality.wordCount
    const readingTime = calcReadingTime(wordCount)

    const post = await prisma.post.create({
      data: {
        ...data,
        slug,
        categoryId: category.id,
        tags: { connect: tagRecords.map((t) => ({ id: t.id })) },
        wordCount,
        readingTime,
        status: 'REVIEW',
      },
      include: { Category: true, Tag: true },
    })

    revalidatePath('/')
    revalidatePath('/sitemap.xml')

    return NextResponse.json({ success: true, postId: post.id, slug: post.slug, post })
  } catch (err) {
    console.error('Publish webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
