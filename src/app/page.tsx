import { prisma } from '@/lib/prisma'
import ArticleCard from '@/components/ArticleCard'

export const revalidate = 3600

export default async function HomePage() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    include: { category: true, tags: true },
  })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">
          {process.env.NEXT_PUBLIC_SITE_NAME}
        </h1>
        <p className="text-gray-500 text-lg">
          Practical guides, tips, and insights — updated daily.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-xl">No articles published yet.</p>
          <p className="text-sm mt-2">The pipeline will generate content soon.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  )
}
