'use client'
import { sendGAEvent } from '@next/third-parties/google'

export function trackArticleRead(slug: string, title: string, category: string) {
  sendGAEvent('event', 'article_read', { slug, title, category })
}

export function trackNewsletterSignup(source: string) {
  sendGAEvent('event', 'newsletter_signup', { source })
}

export function trackAffiliateClick(product: string, slug: string) {
  sendGAEvent('event', 'affiliate_click', { product, article: slug })
}

export function trackScrollDepth(depth: number, slug: string) {
  sendGAEvent('event', 'scroll', { depth_pct: depth, article: slug })
}

export function trackCalculator(result: number) {
  sendGAEvent('event', 'calculator_used', { result })
}
