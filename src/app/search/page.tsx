import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ArticleCard from '@/components/ArticleCard'

interface Props {
  searchParams: { q?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = searchParams.q?.trim() || ''
  return {
    title: q ? `Search results for "${q}"` : 'Search Articles',
    description: q
      ? `Browse WealthBeginners articles matching "${q}"`
      : 'Search our personal finance guides and articles.',
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() || ''

  const results = q
    ? await prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title:   { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
            { tags:    { some: { name: { contains: q, mode: 'insensitive' } } } },
            { category: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        take: 20,
        include: { category: true, tags: true },
      })
    : []

  const suggestedTopics = ['investing', 'budgeting', 'credit score', 'debt payoff', 'saving', 'retirement']

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      {/* Search header */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-[#1A1A2E] mb-2">
          {q ? `Results for "${q}"` : 'Search Articles'}
        </h1>
        {q && (
          <p className="text-muted text-sm">
            {results.length === 0
              ? 'No articles found.'
              : `${results.length} article${results.length !== 1 ? 's' : ''} found`}
          </p>
        )}
      </div>

      {/* Inline search form */}
      <form action="/search" method="GET" className="mb-10">
        <div className="flex gap-3">
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Search personal finance topics…"
            className="flex-1 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold bg-white"
          />
          <button
            type="submit"
            className="bg-gold hover:bg-gold-2 text-navy font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {results.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
        </div>
      ) : q ? (
        /* No results state */
        <div className="text-center py-16 bg-cream rounded-2xl border border-border mb-12">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="font-serif text-xl font-bold text-[#1A1A2E] mb-2">
            No results for &ldquo;{q}&rdquo;
          </h2>
          <p className="text-muted text-sm mb-6">
            Try different keywords, or browse a topic below.
          </p>
        </div>
      ) : null}

      {/* Suggested topics */}
      {(!q || results.length === 0) && (
        <section>
          <h2 className="font-serif text-xl font-bold text-[#1A1A2E] mb-4">Browse Popular Topics</h2>
          <div className="flex flex-wrap gap-3">
            {suggestedTopics.map((topic) => (
              <Link
                key={topic}
                href={`/search?q=${encodeURIComponent(topic)}`}
                className="bg-white border border-border text-sm text-[#1A1A2E] px-4 py-2 rounded-full hover:bg-gold hover:text-navy hover:border-gold transition-colors font-medium"
              >
                {topic.charAt(0).toUpperCase() + topic.slice(1)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

