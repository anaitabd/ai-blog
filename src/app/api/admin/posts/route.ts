import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateSlug } from '@/lib/quality-gate'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    title,
    content = '',
    excerpt,
    categoryId,
    metaTitle,
    metaDesc,
    slug: rawSlug,
    featured = false,
    tagNames = [] as string[],
  } = body

  if (!title || !excerpt || !categoryId || !metaTitle || !metaDesc) {
    return NextResponse.json(
      { error: 'Missing required fields: title, excerpt, categoryId, metaTitle, metaDesc' },
      { status: 400 }
    )
  }

  const slug = generateSlug(rawSlug || title)

  const conflict = await prisma.post.findUnique({ where: { slug }, select: { id: true } })
  if (conflict) {
    return NextResponse.json({ error: 'Slug already in use — change the title or slug' }, { status: 409 })
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 400 })
  }

  const wordCount   = content.trim().split(/\s+/).filter(Boolean).length
  const readingTime = Math.ceil(wordCount / 215)

  const cleanTags: string[] = (tagNames as string[])
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean)

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      excerpt,
      content,
      categoryId,
      metaTitle,
      metaDesc,
      wordCount,
      readingTime,
      featured,
      status: 'DRAFT',
      tags: cleanTags.length > 0
        ? {
            connectOrCreate: cleanTags.map((name: string) => ({
              where: { name },
              create: { name, slug: generateSlug(name) },
            })),
          }
        : undefined,
    },
    include: { Category: true, Tag: true },
  })

  revalidatePath('/admin/posts')
  revalidatePath('/')

  return NextResponse.json({ success: true, post }, { status: 201 })
}
