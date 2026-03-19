import Link from 'next/link'
import { prisma } from '@/lib/prisma'

interface Props {
  currentPostId: string
  category: string  // category slug
}

export default async function RelatedPosts({ currentPostId, category }: Props) {
  // Try same-category first, backfill with latest if needed
  const sameCat = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: currentPostId },
      category: { slug: { equals: category, mode: 'insensitive' } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    include: { category: true },
  })

  let posts = sameCat
  if (posts.length < 3) {
    const extra = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        id: { notIn: [currentPostId, ...posts.map((p) => p.id)] },
      },
      orderBy: { publishedAt: 'desc' },
      take: 3 - posts.length,
      include: { category: true },
    })
    posts = [...posts, ...extra]
  }

  if (posts.length === 0) return null

  return (
    <section className="mt-14">
      {/* Heading */}
      <h2
        className="font-serif text-2xl font-bold mb-6 pb-2 inline-block"
        style={{
          color: '#0B1628',
          borderBottom: '3px solid #C9A84C',
        }}
      >
        Keep Reading
      </h2>

      {/* Grid — horizontal scroll on mobile, 3-col on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/${post.slug}`}
            className="group flex-none w-64 sm:w-auto bg-white border border-[#E5E0D8] rounded-2xl overflow-hidden
                       hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
          >
            {/* Image */}
            <div className="relative w-full aspect-video overflow-hidden bg-[#162035]">
              {post.featuredImage ? (
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-serif text-3xl text-[#C9A84C] opacity-40">W</span>
                </div>
              )}
              {/* Category badge */}
              <span
                className="absolute top-2 left-2 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: '#C9A84C', color: '#0B1628' }}
              >
                {post.category.name}
              </span>
            </div>

            {/* Title */}
            <div className="p-4">
              <h3
                className="font-serif font-semibold text-sm leading-snug line-clamp-2 group-hover:text-[#C9A84C] transition-colors"
                style={{ color: '#0B1628' }}
              >
                {post.title}
              </h3>
              {post.publishedAt && (
                <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                  {post.publishedAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

