export function buildArticleSchema(params: {
  title: string
  description: string
  url: string
  imageUrl?: string
  publishedAt?: Date
  modifiedAt?: Date
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
    dateModified: (params.modifiedAt ?? new Date()).toISOString(),
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

export function buildWebsiteSchema(): string {
  const base  = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const name  = process.env.NEXT_PUBLIC_SITE_NAME ?? 'WealthBeginners'
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  })
}

export function buildBreadcrumbSchema(
  crumbs: Array<{ name: string; url: string }>
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  })
}

export function buildFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  })
}
