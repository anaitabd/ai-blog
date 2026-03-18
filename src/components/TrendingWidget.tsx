import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function TrendingWidget() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { viewCount: 'desc' },
    take: 5,
    include: { category: true },
  })

  if (posts.length === 0) return null

  return (
    <aside className="bg-white border border-border rounded-2xl p-6">
      <h3 className="font-serif text-lg font-bold text-[#1A1A2E] mb-5">Trending Articles</h3>
      <ol className="space-y-5">
        {posts.map((post, i) => (
          <li key={post.id} className="flex gap-4 items-start group">
            <span
              className="font-serif text-3xl font-bold leading-none shrink-0 mt-0.5"
              style={{ color: '#E5E0D8' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-gold text-xs font-semibold mb-1">{post.category.name}</p>
              <Link
                href={`/${post.slug}`}
                className="text-sm font-medium text-[#1A1A2E] group-hover:text-gold transition-colors leading-snug line-clamp-2"
              >
                {post.title}
              </Link>
              <p className="text-xs text-muted mt-1">{post.readingTime} min read</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
