import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
    title: `${category.name} Articles`,
    description: `Browse all articles in ${category.name}.`,
  }
}

export default async function CategoryPage({ params }: Props) {
  const category = await prisma.category.findUnique({
    where: { slug: params.name },
  })
  if (!category) notFound()

  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', categoryId: category.id },
    orderBy: { publishedAt: 'desc' },
    include: { category: true, tags: true },
  })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
      <p className="text-gray-500 mb-8">{posts.length} articles</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <ArticleCard key={post.id} post={post} />
        ))}
      </div>
    </main>
  )
}
