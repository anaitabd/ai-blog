/**
 * ArticleTracker component tests
 * Verifies that trackArticleRead is called on mount with the correct args.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const trackArticleReadMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics', () => ({
  trackArticleRead: trackArticleReadMock,
  trackNewsletterSignup: vi.fn(),
  trackAffiliateClick: vi.fn(),
  trackScrollDepth: vi.fn(),
  trackCalculator: vi.fn(),
}))

import ArticleTracker from '@/components/ArticleTracker'

beforeEach(() => {
  trackArticleReadMock.mockClear()
})

describe('ArticleTracker', () => {
  it('calls trackArticleRead on mount with slug, title, and category', () => {
    render(
      <ArticleTracker
        slug="how-to-budget"
        title="How To Budget"
        category="budgeting"
      />
    )
    expect(trackArticleReadMock).toHaveBeenCalledOnce()
    expect(trackArticleReadMock).toHaveBeenCalledWith(
      'how-to-budget',
      'How To Budget',
      'budgeting'
    )
  })

  it('renders nothing (returns null)', () => {
    const { container } = render(
      <ArticleTracker slug="test" title="Test" category="general" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('calls trackArticleRead again when props change', () => {
    const { rerender } = render(
      <ArticleTracker slug="post-1" title="Post 1" category="investing" />
    )
    rerender(
      <ArticleTracker slug="post-2" title="Post 2" category="savings" />
    )
    expect(trackArticleReadMock).toHaveBeenCalledTimes(2)
    expect(trackArticleReadMock).toHaveBeenLastCalledWith('post-2', 'Post 2', 'savings')
  })
})
