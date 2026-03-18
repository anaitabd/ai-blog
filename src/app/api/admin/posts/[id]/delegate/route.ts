import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateArticle } from '@/lib/bedrock'
import { generateSlug, calcReadingTime } from '@/lib/quality-gate'
import { revalidatePath } from 'next/cache'

interface SaveDraft {
  title?:     string
  excerpt?:   string
  metaTitle?: string
  metaDesc?:  string
  featured?:  boolean
  content?:   string
  slug?:      string
}

/** Count words and compute reading time in one pass. */
function wordStats(text: string) {
  const wordCount   = text.trim().split(/\s+/).filter(Boolean).length
  const readingTime = calcReadingTime(wordCount)
  return { wordCount, readingTime }
}

/** Returns a slug that does not conflict with any other post. */
async function resolveSlug(raw: string, excludeId: string): Promise<string> {
  const base     = generateSlug(raw)
  const conflict = await prisma.post.findFirst({
    where: { slug: base, NOT: { id: excludeId } },
    select: { id: true },
  })
  return conflict ? `${base}-${Date.now()}` : base
}

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
    include: { category: true },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Optionally apply in-progress edits before delegating
  const body: SaveDraft = await req.json().catch(() => ({}))
  const { title, content, excerpt, metaTitle, metaDesc, featured, slug: bodySlug } = body

  const hasDraft =
    title !== undefined || content !== undefined || excerpt !== undefined ||
    metaTitle !== undefined || metaDesc !== undefined || featured !== undefined ||
    bodySlug !== undefined

  if (hasDraft) {
    const saveData: Partial<{
      title: string; excerpt: string; metaTitle: string; metaDesc: string
      featured: boolean; content: string; wordCount: number; readingTime: number; slug: string
    }> = {}

    if (title     !== undefined) saveData.title     = title
    if (excerpt   !== undefined) saveData.excerpt   = excerpt
    if (metaTitle !== undefined) saveData.metaTitle = metaTitle
    if (metaDesc  !== undefined) saveData.metaDesc  = metaDesc
    if (featured  !== undefined) saveData.featured  = featured
    if (content   !== undefined) {
      saveData.content = content
      Object.assign(saveData, wordStats(content))
    }
    if (bodySlug !== undefined) {
      const rawSlug = (bodySlug || '').trim() || title || post.title
      saveData.slug = await resolveSlug(rawSlug, params.id)
    }
    await prisma.post.update({ where: { id: params.id }, data: saveData })
  }

  // Reload the post (with any saved edits applied)
  const current = await prisma.post.findUnique({
    where: { id: params.id },
    include: { category: true },
  })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delegate regeneration to the cloud AI agent (AWS Bedrock)
  const generated = await generateArticle({
    keyword:  current.metaTitle || current.title,
    category: current.category.name,
  })

  const resolvedSlug = await resolveSlug(generated.slug || generated.title, params.id)
  const stats        = wordStats(generated.content)

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      title:       generated.title,
      slug:        resolvedSlug,
      excerpt:     generated.excerpt,
      content:     generated.content,
      metaTitle:   generated.metaTitle,
      metaDesc:    generated.metaDesc,
      wordCount:   stats.wordCount,
      readingTime: stats.readingTime,
      status:      'REVIEW',
      publishedAt: null,
    },
    include: { category: true, tags: true },
  })

  revalidatePath('/')
  revalidatePath(`/${current.slug}`)
  if (resolvedSlug !== current.slug) revalidatePath(`/${resolvedSlug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/posts')

  return NextResponse.json({ success: true, post: updated })
}
