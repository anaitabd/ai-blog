/**
 * AffiliateBox component tests
 * Verifies affiliate links render and trackAffiliateClick is called on click.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const trackAffiliateClickMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics', () => ({
  trackArticleRead: vi.fn(),
  trackNewsletterSignup: vi.fn(),
  trackAffiliateClick: trackAffiliateClickMock,
  trackScrollDepth: vi.fn(),
  trackCalculator: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/how-to-invest',
  useRouter: () => ({ push: vi.fn() }),
}))

import AffiliateBox from '@/components/AffiliateBox'
import type { AffiliateItem } from '@/lib/affiliates'

const mockAffiliates: AffiliateItem[] = [
  {
    name: 'Acorns',
    url: 'https://acorns.com',
    tagline: 'Invest spare change automatically',
    badge: 'Best for Beginners',
    cta: 'Start Investing',
  },
  {
    name: 'Betterment',
    url: 'https://betterment.com',
    tagline: 'Automated investing and savings',
    badge: undefined,
    cta: 'Get Started',
  },
]

beforeEach(() => {
  trackAffiliateClickMock.mockClear()
})

describe('AffiliateBox', () => {
  it('renders all provided affiliate items', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    expect(screen.getByText('Acorns')).toBeInTheDocument()
    expect(screen.getByText('Betterment')).toBeInTheDocument()
  })

  it('renders affiliate taglines', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    expect(screen.getByText('Invest spare change automatically')).toBeInTheDocument()
  })

  it('renders a badge when provided', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    expect(screen.getByText('Best for Beginners')).toBeInTheDocument()
  })

  it('calls trackAffiliateClick with product name and pathname on link click', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    const acornsLink = screen.getByRole('link', { name: /Start Investing/i })
    fireEvent.click(acornsLink)
    expect(trackAffiliateClickMock).toHaveBeenCalledWith('Acorns', '/how-to-invest')
  })

  it('calls trackAffiliateClick for each separate affiliate clicked', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    const links = screen.getAllByRole('link')
    fireEvent.click(links[0])
    fireEvent.click(links[1])
    expect(trackAffiliateClickMock).toHaveBeenCalledTimes(2)
  })

  it('renders the "Recommended Tools" header', () => {
    render(<AffiliateBox category="investing" affiliates={mockAffiliates} />)
    expect(screen.getByText('Recommended Tools')).toBeInTheDocument()
  })
})
