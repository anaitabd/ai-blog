import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ArticleCard from '@/components/ArticleCard'
import NewsletterInline from '@/components/NewsletterInline'

export const metadata: Metadata = {
  title: 'All Articles | WealthBeginners',
  description:
    'Browse all personal finance articles — investing, budgeting, credit, debt, saving, and more. Updated daily.',
}

export const revalidate = 3600

const FILTER_TABS = [
  { label: 'All',        slug: '' },
  { label: 'Investing',  slug: 'investing' },
  { label: 'Budgeting',  slug: 'budgeting' },
  { label: 'Credit',     slug: 'credit' },
  { label: 'Debt',       slug: 'debt' },
  { label: 'Saving',     slug: 'saving' },
  { label: 'Income',     slug: 'income' },
  { label: 'Retirement', slug: 'retirement' },
]

const PAGE_SIZE = 12

interface Props {
  searchParams: { category?: string; page?: string }
}

export default async function BlogPage({ searchParams }: Props) {
  const activeCategory = searchParams.category || ''
  const page           = Math.max(1, parseInt(searchParams.page || '1', 10))
  const skip           = (page - 1) * PAGE_SIZE

  const where = {
    status: 'PUBLISHED' as const,
    ...(activeCategory
      ? { category: { slug: { equals: activeCategory, mode: 'insensitive' as const } } }
      : {}),
  }

  const [posts, total, subscriberCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: { category: true, tags: true },
    }),
    prisma.post.count({ where }),
    prisma.subscriber.count({ where: { active: true } }).catch(() => 0),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const displayCount =
    subscriberCount >= 1000
      ? `${(subscriberCount / 1000).toFixed(1)}K+`
      : subscriberCount > 0
      ? `${subscriberCount}+`
      : null

  const buildHref = (p: number, cat?: string) => {
    const params = new URLSearchParams()
    if (cat)  params.set('category', cat)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/blog${qs ? `?${qs}` : ''}`
  }

  return (
    <main>
      {/* Hero */}
      <section className="bg-navy text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-gold text-xs font-semibold uppercase tracking-widest mb-3">
            Personal Finance Guides
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3">
            All Articles
          </h1>
          <p className="text-white/60 text-sm">
            {total} articles · Updated daily
          </p>
        </div>
      </section>

      {/* Filter tabs — sticky */}
      <div className="sticky top-16 z-40 bg-cream/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {FILTER_TABS.map((tab) => {
              const isActive = tab.slug === activeCategory
              return (
                <Link
                  key={tab.slug}
                  href={buildHref(1, tab.slug || undefined)}
                  className={`shrink-0 text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-navy text-white'
                      : 'text-muted hover:bg-navy/5 hover:text-navy'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Count */}
        <p className="text-sm text-muted mb-6">
          Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} articles
          {activeCategory && ` in ${activeCategory}`}
        </p>

        {/* Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <p className="text-xl font-serif mb-3">No articles found.</p>
            <Link href="/blog" className="text-gold text-sm hover:underline">
              ← View all articles
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-8">
            {page > 1 && (
              <Link
                href={buildHref(page - 1, activeCategory || undefined)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-navy hover:text-white hover:border-navy transition-colors"
              >
                ← Previous
              </Link>
            )}

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-muted text-sm">…</span>
                ) : (
                  <Link
                    key={p}
                    href={buildHref(p as number, activeCategory || undefined)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-navy text-white'
                        : 'border border-border hover:bg-navy hover:text-white hover:border-navy'
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}

            {page < totalPages && (
              <Link
                href={buildHref(page + 1, activeCategory || undefined)}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-navy hover:text-white hover:border-navy transition-colors"
              >
                Next →
              </Link>
            )}
          </nav>
        )}

        <NewsletterInline subscriberCount={displayCount} />
      </div>
    </main>
  )
}

