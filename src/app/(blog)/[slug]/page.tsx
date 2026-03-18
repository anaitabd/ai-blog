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
import ArticleCard from '@/components/ArticleCard'
import PinterestSaveButton from '@/components/PinterestSaveButton'

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
    include: { Category: true },
  })
  if (!post) return {}

  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/${post.slug}`

  return {
    title: post.metaTitle,
    description: post.metaDesc,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDesc,
      url,
      type: 'article',
      siteName: 'WealthBeginners',
      publishedTime: post.publishedAt?.toISOString(),
      images: [
        // Pinterest vertical image first (2:3 ratio — Pinterest prefers this)
        ...(post.pinterestImage ? [{
          url: post.pinterestImage,
          width: 1000,
          height: 1500,
          alt: post.title,
        }] : []),
        // Standard featured image second
        ...(post.featuredImage ? [{
          url: post.featuredImage,
          width: 1792,
          height: 1024,
          alt: post.title,
        }] : []),
      ],
    },
    // Pinterest Rich Pins require these specific meta tags
    other: {
      'pinterest:description': post.metaDesc,
      'pinterest:media': post.pinterestImage ?? post.featuredImage ?? '',
      // Tells Pinterest this is an article (enables Rich Pin article type)
      'og:type': 'article',
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { Category: true, Tag: true },
  })

  if (!post) notFound()

  // Increment view count (fire-and-forget)
  prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {/* non-critical */})

  const relatedPosts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      categoryId: post.categoryId,
      id: { not: post.id },
    },
    take: 3,
    orderBy: { publishedAt: 'desc' },
    include: { Category: true },
  })

  const wordCount = post.wordCount || post.content.trim().split(/\s+/).length
  const headings  = extractHeadings(post.content)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {post.schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: post.schemaJson }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
        {/* Article */}
        <article className="min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-muted mb-6">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/category/${post.Category.slug}`} className="hover:text-gold transition-colors">
              {post.Category.name}
            </Link>
            <span>/</span>
            <span className="truncate max-w-[160px]">{post.title}</span>
          </nav>

          {/* Article header */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Link
                href={`/category/${post.Category.slug}`}
                className="bg-gold/10 text-gold text-xs font-semibold px-3 py-1 rounded-full hover:bg-gold/20 transition-colors"
              >
                {post.Category.name}
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
            <p className="text-lg text-muted leading-relaxed">{post.excerpt}</p>

            {/* Author bar */}
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
              <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-gold font-serif font-bold text-sm">
                W
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E]">WealthBeginners Editorial</p>
                <p className="text-xs text-muted">Personal finance experts</p>
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

          {/* Table of Contents — inline on mobile, hidden on desktop (sidebar takes over) */}
          <TableOfContents headings={headings} mobileInline />

          <ArticleBody content={post.content} />

          {/* Tags */}
          {post.Tag.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.Tag.map((tag) => (
                <span
                  key={tag.id}
                  className="bg-cream-2 text-muted text-xs px-3 py-1.5 rounded-full border border-border"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Pinterest Save Button */}
          {(post.pinterestImage || post.featuredImage) && (
            <div className="flex items-center gap-3 py-4 border-t border-border mt-8">
              <span className="text-sm text-muted">Share this article:</span>
              <PinterestSaveButton
                imageUrl={post.pinterestImage ?? post.featuredImage ?? ''}
                description={`${post.excerpt} — Read more at WealthBeginners.com #personalfinance #moneytips #wealthbeginners`}
                url={`${process.env.NEXT_PUBLIC_SITE_URL}/${post.slug}`}
              />
            </div>
          )}

          <AdUnit slot="bottom-article" />
          <NewsletterInline />

          {/* Related articles */}
          {relatedPosts.length > 0 && (
            <section className="mt-12">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A2E] mb-6">Related Articles</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {relatedPosts.map((related) => (
                  <ArticleCard key={related.id} post={related} />
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block space-y-8">
          <div className="sticky top-24">
            {/* Table of Contents — desktop sidebar */}
            <TableOfContents headings={headings} />
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
