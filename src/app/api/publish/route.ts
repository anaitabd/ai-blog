import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runQualityGate, calcReadingTime } from '@/lib/quality-gate'
import { sanitizePostContent } from '@/lib/content-sanitizer'
import { fetchPexelsImage, fetchUnsplashImage, uploadImageToS3 } from '@/lib/image-service'
import { analyzeSEO, enhancePostContent } from '@/lib/claude-seo-engine'
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
  // Extended SEO fields from pipeline
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  primaryKeyword: z.string().optional(),
  faqSchema: z.string().optional(),
  imageSource: z.string().optional(),
  wordCount: z.number().optional(),
  readingTime: z.number().optional(),
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

    const {
      secret,
      categoryName,
      tags,
      slug: rawSlug,
      ogTitle: incomingOgTitle,
      ogDescription: incomingOgDescription,
      primaryKeyword: incomingPrimaryKeyword,
      faqSchema: incomingFaqSchema,
      imageSource: incomingImageSource,
      wordCount: incomingWordCount,
      readingTime: incomingReadingTime,
      ...data
    } = parsed.data

    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Step 1: Quality gate — run on raw content BEFORE sanitizing ────
    // sanitizePostContent() strips [INSERT PERSONAL ANECDOTE: ...] markers,
    // so the quality gate must see the original content first.
    const quality = runQualityGate(data.content)
    if (!quality.passed) {
      return NextResponse.json(
        { error: 'Quality gate failed', issues: quality.issues },
        { status: 422 }
      )
    }

    // ── Step 2: Sanitize placeholder text ──────────────────────────────
    data.content = sanitizePostContent(data.content)

    // ── Step 3: Image — try Pexels first, fall back to lambda's image ───
    let finalImage = data.featuredImage
    let finalImageSource = incomingImageSource ?? 'bedrock'

    if (process.env.PEXELS_API_KEY) {
      try {
        const pexelsUrl = await fetchPexelsImage(data.title)
        if (pexelsUrl) {
          const s3Url = await uploadImageToS3(pexelsUrl, data.title)
          finalImage = s3Url
          finalImageSource = 'pexels'
        }
      } catch {
        // Pexels failed — use lambda-provided image or try Unsplash
        if (!finalImage && process.env.UNSPLASH_ACCESS_KEY) {
          try {
            const unsplashUrl = await fetchUnsplashImage(data.title)
            if (unsplashUrl) {
              const s3Url = await uploadImageToS3(unsplashUrl, data.title)
              finalImage = s3Url
              finalImageSource = 'unsplash'
            }
          } catch { /* keep lambda image */ }
        }
      }
    }

    // ── Step 4: Claude SEO analysis (if Anthropic key is set) ──────────
    let seoFields: {
      ogTitle?: string
      ogDescription?: string
      primaryKeyword?: string
      schemaJson?: string
      faqSchema?: string
      metaTitle?: string
      metaDesc?: string
    } = {
      ogTitle: incomingOgTitle,
      ogDescription: incomingOgDescription,
      primaryKeyword: incomingPrimaryKeyword,
      faqSchema: incomingFaqSchema,
    }

    if (process.env.ANTHROPIC_API_KEY && !incomingOgTitle) {
      try {
        const seoAnalysis = await analyzeSEO(data.title, data.content, categoryName)
        // Enhance content with SEO improvements
        const enhanced = await enhancePostContent(data.title, data.content, seoAnalysis)
        data.content = sanitizePostContent(enhanced) // re-sanitize after enhancement

        seoFields = {
          ogTitle: seoAnalysis.ogTitle || data.title,
          ogDescription: seoAnalysis.ogDescription || data.metaDesc,
          primaryKeyword: seoAnalysis.primaryKeyword,
          schemaJson: JSON.stringify(seoAnalysis.schemaMarkup),
          faqSchema: JSON.stringify(seoAnalysis.faqSchema),
          metaTitle: seoAnalysis.optimizedTitle?.slice(0, 70) || data.metaTitle,
          metaDesc: seoAnalysis.metaDescription?.slice(0, 170) || data.metaDesc,
        }
        // Update slug if SEO recommends a better one
        if (seoAnalysis.recommendedSlug && !rawSlug) {
          data.title = seoAnalysis.optimizedTitle || data.title
        }
      } catch (seoErr) {
        console.warn('SEO analysis failed, continuing without:', seoErr)
      }
    }

    // ── Step 5: Slug + category + tags ─────────────────────────────────
    const slugBase = rawSlug ?? titleToSlug(seoFields.metaTitle ?? data.title)
    const slug     = await uniqueSlug(slugBase)

    const categorySlug = categoryName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')

    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: categoryName, slug: categorySlug },
    })

    const tagRecords = await Promise.all(
      tags.map((tag) => {
        const tagSlug = tag.toLowerCase().replace(/\s+/g, '-')
        return prisma.tag.upsert({
          where: { slug: tagSlug },
          update: {},
          create: { name: tag, slug: tagSlug },
        })
      })
    )

    const wordCount   = incomingWordCount  ?? quality.wordCount
    const readingTime = incomingReadingTime ?? calcReadingTime(wordCount)

    // ── Step 6: Save to DB as PUBLISHED ────────────────────────────────
    const post = await prisma.post.create({
      data: {
        title:        data.title,
        slug,
        excerpt:      data.excerpt,
        content:      data.content,
        featuredImage: finalImage,
        metaTitle:    seoFields.metaTitle  ?? data.metaTitle,
        metaDesc:     seoFields.metaDesc   ?? data.metaDesc,
        schemaJson:   seoFields.schemaJson ?? data.schemaJson,
        ogTitle:      seoFields.ogTitle,
        ogDescription: seoFields.ogDescription,
        primaryKeyword: seoFields.primaryKeyword,
        faqSchema:    seoFields.faqSchema,
        imageSource:  finalImageSource,
        categoryId:   category.id,
        tags:         { connect: tagRecords.map((t) => ({ id: t.id })) },
        wordCount,
        readingTime,
        status:       'PUBLISHED',
        publishedAt:  new Date(),
      },
      include: { category: true, tags: true },
    })

    revalidatePath('/')
    revalidatePath('/blog')
    revalidatePath('/sitemap.xml')
    revalidatePath(`/category/${category.slug}`)
    revalidatePath(`/${post.slug}`)

    return NextResponse.json({ success: true, postId: post.id, slug: post.slug, post })
  } catch (err) {
    console.error('Publish webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
