import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures the mock fn is created before vi.mock() factory runs
const sendGAEventMock = vi.hoisted(() => vi.fn())

vi.mock('@next/third-parties/google', () => ({
  sendGAEvent: sendGAEventMock,
}))

import {
  trackArticleRead,
  trackNewsletterSignup,
  trackAffiliateClick,
  trackScrollDepth,
  trackCalculator,
} from '@/lib/analytics'

beforeEach(() => {
  sendGAEventMock.mockClear()
})

describe('trackArticleRead', () => {
  it('calls sendGAEvent with article_read event and correct params', () => {
    trackArticleRead('how-to-budget', 'How To Budget', 'budgeting')
    expect(sendGAEventMock).toHaveBeenCalledOnce()
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'article_read', {
      slug: 'how-to-budget',
      title: 'How To Budget',
      category: 'budgeting',
    })
  })
})

describe('trackNewsletterSignup', () => {
  it('calls sendGAEvent with newsletter_signup and source', () => {
    trackNewsletterSignup('inline')
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'newsletter_signup', {
      source: 'inline',
    })
  })

  it('supports different source values', () => {
    trackNewsletterSignup('footer')
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'newsletter_signup', {
      source: 'footer',
    })
  })
})

describe('trackAffiliateClick', () => {
  it('calls sendGAEvent with affiliate_click, product, and article', () => {
    trackAffiliateClick('Acorns', '/how-to-invest')
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'affiliate_click', {
      product: 'Acorns',
      article: '/how-to-invest',
    })
  })
})

describe('trackScrollDepth', () => {
  it('calls sendGAEvent with scroll event and depth_pct', () => {
    trackScrollDepth(50, 'saving-money-tips')
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'scroll', {
      depth_pct: 50,
      article: 'saving-money-tips',
    })
  })
})

describe('trackCalculator', () => {
  it('calls sendGAEvent with calculator_used and result', () => {
    trackCalculator(12450)
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'calculator_used', {
      result: 12450,
    })
  })
})
