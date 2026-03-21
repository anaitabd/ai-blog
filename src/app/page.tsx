import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import ArticleCard from '@/components/ArticleCard'
import NewsletterInline from '@/components/NewsletterInline'
import TrendingWidget from '@/components/TrendingWidget'
import CompoundCalculator from '@/components/CompoundCalculator'
import TickerBar from '@/components/TickerBar'
import CategoryPills from '@/components/CategoryPills'
import Link from 'next/link'

export const revalidate = 3600

interface Props {
  searchParams: { category?: string }
}

// ─── Skeleton shown while PostGrid streams in ────────────────────────────────
function PostGridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-6 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`bg-gray-200 rounded-2xl h-64 ${i === 0 ? 'sm:col-span-2' : ''}`}
        />
      ))}
    </div>
  )
}

// ─── Async server component — does the DB query ──────────────────────────────
async function PostGrid({ categoryFilter }: { categoryFilter?: string }) {
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      ...(categoryFilter ? { category: { slug: categoryFilter } } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    include: { category: true, tags: true },
  })

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 text-muted">
        <p className="text-xl font-serif">No articles published yet.</p>
        <p className="text-sm mt-2">The pipeline will generate content soon.</p>
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {posts.map((post, i) => (
        <div key={post.id} className={i === 0 ? 'sm:col-span-2' : ''}>
          <ArticleCard post={post} />
        </div>
      ))}
    </div>
  )
}

// ─── Page — renders instantly, streams PostGrid ──────────────────────────────
export default async function HomePage({ searchParams }: Props) {
  const categoryFilter = searchParams.category

  const [featuredPost, subscriberCount] = await Promise.all([
    prisma.post.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: { category: true },
    }),
    prisma.subscriber.count({ where: { active: true } }),
  ])

  const displayCount =
    subscriberCount >= 1000
      ? `${(subscriberCount / 1000).toFixed(1)}K+`
      : subscriberCount > 0
      ? `${subscriberCount}+`
      : null

  return (
    <>
      <TickerBar />

      {/* Hero */}
      {featuredPost && !categoryFilter && (
        <section
          className="relative bg-navy overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 50% 80% at 90% 10%, rgba(201,168,76,0.15) 0%, transparent 60%), #0B1628',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
            {/* Left */}
            <div className="animate-fade-up">
              <span className="inline-block bg-gold/20 text-gold text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                Featured · {featuredPost.category.name}
              </span>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
                {featuredPost.title}
              </h1>
              <p className="text-white/60 text-base leading-relaxed mb-6">
                {featuredPost.excerpt}
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href={`/${featuredPost.slug}`}
                  className="bg-gold hover:bg-gold-2 text-navy font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
                >
                  Read Article →
                </Link>
                <span className="text-white/40 text-xs">
                  {featuredPost.publishedAt?.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Right — featured image card */}
            <div className="animate-fade-up-delay-1 relative">
              {featuredPost.featuredImage ? (
                <img
                  src={featuredPost.featuredImage}
                  alt={featuredPost.title}
                  className="w-full rounded-2xl object-cover max-h-[340px]"
                />
              ) : (
                <div className="w-full rounded-2xl bg-navy-2 border border-white/10 max-h-[340px] flex items-center justify-center py-20">
                  <span className="font-serif text-6xl text-gold/30">W</span>
                </div>
              )}
              {/* Stats bar */}
              <div className="absolute bottom-4 left-4 right-4 bg-navy/80 backdrop-blur-sm rounded-xl px-4 py-3 flex gap-6 text-xs text-white/70">
                <span>📖 Daily readers</span>
                {displayCount ? (
                  <span>📧 {displayCount} subscribers</span>
                ) : (
                  <span>📧 Join our community</span>
                )}
                <span>⭐ Expert reviewed</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sticky category pills */}
      <div className="sticky top-16 z-40 bg-cream/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <Suspense fallback={null}>
            <CategoryPills />
          </Suspense>
        </div>
      </div>

      {/* Main content + sidebar */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">
          {/* Articles */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A2E]">
                {categoryFilter ? `${categoryFilter.charAt(0).toUpperCase()}${categoryFilter.slice(1)} Articles` : 'Latest Articles'}
              </h2>
            </div>

            <Suspense fallback={<PostGridSkeleton />}>
              <PostGrid categoryFilter={categoryFilter} />
            </Suspense>

            <NewsletterInline />
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            <TrendingWidget />
            <CompoundCalculator />

            {/* Tag cloud */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg font-bold text-[#1A1A2E] mb-4">Browse Topics</h3>
              <div className="flex flex-wrap gap-2">
                {['Investing', 'Budgeting', 'Saving', 'Debt', 'Income', 'Credit', 'Retirement', 'Real Estate', '401(k)', 'Roth IRA'].map(tag => (
                  <Link
                    key={tag}
                    href={`/category/${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="text-xs bg-cream-2 hover:bg-gold hover:text-navy text-muted px-3 py-1.5 rounded-full border border-border transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}
