export function buildArticleSchema(params: {
  title: string
  description: string
  url: string
  imageUrl?: string
  publishedAt?: Date
  authorName?: string
  siteName: string
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    url: params.url,
    image: params.imageUrl,
    datePublished: params.publishedAt?.toISOString(),
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: params.authorName ?? params.siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: params.siteName,
      url: process.env.NEXT_PUBLIC_SITE_URL,
    },
  })
}
