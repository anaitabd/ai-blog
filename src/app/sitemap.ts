import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL!

  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true, updatedAt: true, publishedAt: true },
  })

  const categories = await prisma.Category.findMany({
    select: { slug: true, createdAt: true },
  })

  return [
    { url: base, priority: 1.0, changeFrequency: 'daily' },
    { url: `${base}/about`, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${base}/contact`, priority: 0.5, changeFrequency: 'monthly' },
    { url: `${base}/privacy-policy`, priority: 0.3, changeFrequency: 'monthly' },
    { url: `${base}/disclaimer`, priority: 0.3, changeFrequency: 'monthly' },
    ...categories.map((cat) => ({
      url: `${base}/category/${cat.slug}`,
      lastModified: cat.createdAt,
      priority: 0.7,
      changeFrequency: 'weekly' as const,
    })),
    ...posts.map((post) => ({
      url: `${base}/${post.slug}`,
      lastModified: post.updatedAt,
      priority: 0.8,
      changeFrequency: 'weekly' as const,
    })),
  ]
}
