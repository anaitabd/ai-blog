import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ArticleCard from '@/components/ArticleCard'

interface Props {
  params: { name: string }
}

export const revalidate = 3600

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({ select: { slug: true } })
  return categories.map((c) => ({ name: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await prisma.category.findUnique({ where: { slug: params.name } })
  if (!category) return {}
  return {
    title: `${category.name} — Personal Finance Tips | WealthBeginners`,
    description: `Browse all ${category.name.toLowerCase()} articles on WealthBeginners. Practical, research-backed advice for beginners.`,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/category/${params.name}`,
    },
  }
}

export default async function CategoryPage({ params }: Readonly<Props>) {
  const category = await prisma.category.findUnique({
    where: { slug: params.name },
  })
  if (!category) notFound()

  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', categoryId: category.id },
    orderBy: { publishedAt: 'desc' },
    include: { Category: true, Tag: true },
  })

  return (
    <main>
      {/* Hero */}
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <nav className="text-white/50 text-xs mb-4 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gold">Category</span>
          </nav>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            {category.name}
          </h1>
          <p className="text-white/60 text-sm">
            {posts.length} {posts.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted mb-6">No articles published yet in this category.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-navy/90 transition-colors"
            >
              ← Browse All Articles
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
