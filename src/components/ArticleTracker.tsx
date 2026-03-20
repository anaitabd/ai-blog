'use client'
import { useEffect } from 'react'
import { trackArticleRead } from '@/lib/analytics'

interface Props {
  slug: string
  title: string
  category: string
}

export default function ArticleTracker({ slug, title, category }: Props) {
  useEffect(() => {
    trackArticleRead(slug, title, category)
  }, [slug, title, category])

  return null
}
