import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateSlug } from '@/lib/quality-gate'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { status, title, content, excerpt, slug, metaTitle, metaDesc, featured } = body

  if (status !== undefined && !['PUBLISHED', 'REJECTED', 'DRAFT', 'REVIEW'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const current = await prisma.post.findUnique({ where: { id: params.id }, select: { slug: true } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if (status !== undefined) {
    data.status = status
    if (status === 'PUBLISHED') data.publishedAt = new Date()
    if (status === 'DRAFT' || status === 'REJECTED' || status === 'REVIEW') data.publishedAt = null
  }
  if (title     !== undefined) data.title    = title
  if (excerpt   !== undefined) data.excerpt  = excerpt
  if (metaTitle !== undefined) data.metaTitle = metaTitle
  if (metaDesc  !== undefined) data.metaDesc  = metaDesc
  if (featured  !== undefined) data.featured  = featured

  if (content !== undefined) {
    data.content     = content
    const wc         = content.trim().split(/\s+/).filter(Boolean).length
    data.wordCount   = wc
    data.readingTime = Math.ceil(wc / 215)
  }

  if (slug !== undefined) {
    const cleanSlug = generateSlug(slug) || generateSlug(title ?? current.slug)
    const conflict  = await prisma.post.findFirst({
      where: { slug: cleanSlug, NOT: { id: params.id } },
      select: { id: true },
    })
    if (conflict) {
      return NextResponse.json({ error: 'Slug already in use by another post' }, { status: 409 })
    }
    data.slug = cleanSlug
  }

  const post = await prisma.post.update({ where: { id: params.id }, data })

  revalidatePath('/')
  revalidatePath(`/${current.slug}`)
  if (data.slug && data.slug !== current.slug) revalidatePath(`/${data.slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/posts')

  return NextResponse.json({ success: true, post })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { slug: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.post.delete({ where: { id: params.id } })

  revalidatePath('/')
  revalidatePath(`/${post.slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/posts')

  return NextResponse.json({ success: true })
}

