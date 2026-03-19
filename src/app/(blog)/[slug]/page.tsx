import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ArticleBody from '@/components/ArticleBody'
import { extractHeadings } from '@/lib/headings'
import TableOfContents from '@/components/TableOfContents'
import AdUnit from '@/components/AdUnit'
import NewsletterInline from '@/components/NewsletterInline'
import TrendingWidget from '@/components/TrendingWidget'
import CompoundCalculator from '@/components/CompoundCalculator'
import AffiliateBox from '@/components/AffiliateBox'
import AuthorBio from '@/components/AuthorBio'
import RelatedPosts from '@/components/RelatedPosts'
import { sanitizePostContent } from '@/lib/content-sanitizer'

interface Props {
  params: { slug: string }
}

export const revalidate = 43200 // 12 hours ISR

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
  })
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
  })
  if (!post) return {}

  const title       = post.ogTitle       || post.metaTitle
  const description = post.ogDescription || post.metaDesc
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wealthbeginners.com'

  return {
    title,
    description,
    authors: [{ name: 'WealthBeginners Editorial Team' }],
    alternates: { canonical: `${siteUrl}/${post.slug}` },
    openGraph: {
      title,
      description,
      type:          'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors:       [`${siteUrl}/about`],
      images: post.featuredImage
        ? [{ url: post.featuredImage, width: 1200, height: 630, alt: post.title }]
        : [],
    },
    twitter: {
      card:        'summary_large_image',
      title:       post.ogTitle || post.metaTitle,
      description: post.ogDescription || post.metaDesc,
      images:      post.featuredImage ? [post.featuredImage] : [],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { category: true, tags: true },
  })

  if (!post) notFound()

  // Sanitize content at render time (catches any DB entries that weren't cleaned at write time)
  const cleanContent = sanitizePostContent(post.content)

  // Increment view count (fire-and-forget)
  prisma.post
    .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {/* non-critical */})

  const subscriberCount = await prisma.subscriber
    .count({ where: { active: true } })
    .catch(() => 0)
  const displayCount =
    subscriberCount >= 1000
      ? `${(subscriberCount / 1000).toFixed(1)}K+`
      : subscriberCount > 0
      ? `${subscriberCount}+`
      : null

  const wordCount = post.wordCount || cleanContent.trim().split(/\s+/).length
  const headings  = extractHeadings(cleanContent)

  // Parse schemas
  const articleSchema = post.schemaJson ? (() => { try { return JSON.parse(post.schemaJson) } catch { return null } })() : null
  const faqSchema     = post.faqSchema  ? (() => { try { return JSON.parse(post.faqSchema)  } catch { return null } })() : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* JSON-LD: Article schema */}
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      {/* JSON-LD: FAQ schema */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
        {/* Article */}
        <article className="min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-muted mb-6">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/category/${post.category.slug}`} className="hover:text-gold transition-colors">
              {post.category.name}
            </Link>
            <span>/</span>
            <span className="truncate max-w-[160px]">{post.title}</span>
          </nav>

          {/* Article header */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Link
                href={`/category/${post.category.slug}`}
                className="bg-gold/10 text-gold text-xs font-semibold px-3 py-1 rounded-full hover:bg-gold/20 transition-colors"
              >
                {post.category.name}
              </Link>
              <span className="text-muted text-xs">·</span>
              <span className="text-muted text-xs">{post.readingTime} min read</span>
              <span className="text-muted text-xs">·</span>
              <span className="text-muted text-xs">{wordCount.toLocaleString()} words</span>
              {post.publishedAt && (
                <>
                  <span className="text-muted text-xs">·</span>
                  <time className="text-muted text-xs" dateTime={post.publishedAt.toISOString()}>
                    {post.publishedAt.toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </time>
                </>
              )}
            </div>

            <h1 className="font-serif text-4xl font-bold text-[#1A1A2E] leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-lg text-muted leading-relaxed italic">{post.excerpt}</p>

            {/* Author bar */}
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
              <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-gold font-serif font-bold text-sm">
                W
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E]">WealthBeginners Editorial</p>
                <p className="text-xs text-muted">Expert Reviewed ✓</p>
              </div>
            </div>
          </header>

          {post.featuredImage && (
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full rounded-2xl mb-8 object-cover max-h-[480px]"
            />
          )}

          <AdUnit slot="top-article" />
          <TableOfContents headings={headings} mobileInline />

          {/* First affiliate box — above content for high visibility */}
          <AffiliateBox category={post.category.slug} />

          <ArticleBody content={cleanContent} />

          {/* Second affiliate box — after content */}
          <AffiliateBox category={post.category.slug} />

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/search?q=${encodeURIComponent(tag.name)}`}
                  className="bg-cream-2 text-muted text-xs px-3 py-1.5 rounded-full border border-border hover:bg-gold/10 hover:text-gold transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          <AdUnit slot="bottom-article" />

          {/* Author bio */}
          <AuthorBio />

          {/* Related posts */}
          <RelatedPosts currentPostId={post.id} category={post.category.slug} />

          <AdUnit slot="post-footer" format="horizontal" />
          <NewsletterInline subscriberCount={displayCount} />
        </article>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block space-y-8">
          <div className="sticky top-24">
            <TableOfContents headings={headings} />
            <div className="mt-6">
              <AffiliateBox category={post.category.slug} />
            </div>
            <TrendingWidget />
            <div className="mt-8">
              <CompoundCalculator />
            </div>
            <div className="mt-8">
              <AdUnit slot="sidebar" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
