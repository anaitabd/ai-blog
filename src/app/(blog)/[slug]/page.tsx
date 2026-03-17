import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ArticleBody from '@/components/ArticleBody'
import AdUnit from '@/components/AdUnit'

interface Props {
  params: { slug: string }
}

export const revalidate = 43200 // 12 hours ISR

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
  })
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
  })
  if (!post) return {}

  return {
    title: post.metaTitle,
    description: post.metaDesc,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/${post.slug}`,
    },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDesc,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      images: post.featuredImage ? [post.featuredImage] : [],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { category: true, tags: true },
  })

  if (!post) notFound()

  const relatedPosts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      categoryId: post.categoryId,
      id: { not: post.id },
    },
    take: 3,
    orderBy: { publishedAt: 'desc' },
    include: { category: true },
  })

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {post.schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: post.schemaJson }}
        />
      )}

      <article>
        <header className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <a
              href={`/category/${post.category.slug}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {post.category.name}
            </a>
            <span>·</span>
            <span>{post.readingTime} min read</span>
            {post.publishedAt && (
              <>
                <span>·</span>
                <time dateTime={post.publishedAt.toISOString()}>
                  {post.publishedAt.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </time>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold leading-tight mb-4">{post.title}</h1>
          <p className="text-gray-600 text-lg leading-relaxed">{post.excerpt}</p>
        </header>

        {post.featuredImage && (
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full rounded-xl mb-8 object-cover max-h-96"
          />
        )}

        <AdUnit slot="top-article" />

        <ArticleBody content={post.content} />

        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
            >
              {tag.name}
            </span>
          ))}
        </div>

        <AdUnit slot="bottom-article" />
      </article>

      {relatedPosts.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold mb-6">Related Articles</h2>
          <div className="grid gap-4">
            {relatedPosts.map((related) => (
              <a
                key={related.id}
                href={`/${related.slug}`}
                className="flex gap-4 group"
              >
                {related.featuredImage && (
                  <img
                    src={related.featuredImage}
                    alt={related.title}
                    className="w-24 h-16 object-cover rounded-lg shrink-0"
                  />
                )}
                <div>
                  <p className="font-medium text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                    {related.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {related.readingTime} min read
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
