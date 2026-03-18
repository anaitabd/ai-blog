'use client'

import Link from 'next/link'

const CATEGORY_COLORS: Record<string, string> = {
  investing:           'bg-teal-600',
  budgeting:           'bg-blue-600',
  debt:                'bg-rose-600',
  income:              'bg-violet-600',
  saving:              'bg-emerald-600',
  credit:              'bg-orange-600',
  retirement:          'bg-indigo-600',
  'financial literacy':'bg-slate-600',
  career:              'bg-pink-600',
  tools:               'bg-cyan-600',
}

interface Props {
  post: {
    slug: string
    title: string
    excerpt: string
    featuredImage: string | null
    readingTime: number
    publishedAt: Date | null
    category: { name: string; slug: string }
  }
}

export default function ArticleCard({ post }: Props) {
  const badgeColor = CATEGORY_COLORS[post.category.slug] ?? 'bg-navy'

  return (
    <Link href={`/${post.slug}`} className="group block h-full">
      <article className="bg-white rounded-2xl border border-border overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-cream-2">
          {post.featuredImage ? (
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0B1628 0%,#162035 100%)' }}
            >
              <span className="font-serif text-gold text-4xl opacity-60">W</span>
            </div>
          )}
          {/* Category badge */}
          <span className={`absolute top-3 left-3 ${badgeColor} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
            {post.category.name}
          </span>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col flex-1">
          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-muted mb-3">
            <span className="text-gold font-medium">{post.category.name}</span>
            <span>·</span>
            <span>{post.readingTime} min read</span>
            {post.publishedAt && (
              <>
                <span>·</span>
                <time dateTime={post.publishedAt.toISOString()}>
                  {post.publishedAt.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </time>
              </>
            )}
          </div>

          {/* Title */}
          <h2 className="font-serif font-semibold text-[#1A1A2E] group-hover:text-gold transition-colors line-clamp-2 flex-1 mb-2 leading-snug">
            {post.title}
          </h2>

          {/* Excerpt */}
          <p className="text-sm text-muted line-clamp-2 mb-4">
            {post.excerpt}
          </p>

          {/* Footer */}
          <div className="mt-auto">
            <span className="text-gold text-sm font-medium group-hover:underline">
              Read article →
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
