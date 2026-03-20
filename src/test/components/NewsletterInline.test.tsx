/**
 * NewsletterInline component tests
 * Verifies form renders, submit flow, and GA4 tracking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const trackNewsletterSignupMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics', () => ({
  trackArticleRead: vi.fn(),
  trackNewsletterSignup: trackNewsletterSignupMock,
  trackAffiliateClick: vi.fn(),
  trackScrollDepth: vi.fn(),
  trackCalculator: vi.fn(),
}))

// Mock next/navigation (usePathname used by AffiliateBox, not this component — but needed if imported transitively)
vi.mock('next/navigation', () => ({
  usePathname: () => '/test',
  useRouter: () => ({ push: vi.fn() }),
}))

import NewsletterInline from '@/components/NewsletterInline'

beforeEach(() => {
  trackNewsletterSignupMock.mockClear()
  vi.restoreAllMocks()
})

describe('NewsletterInline', () => {
  it('renders the email input and subscribe button', () => {
    render(<NewsletterInline />)
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Get Free Money Tips/i })).toBeInTheDocument()
  })

  it('shows subscriber count line when subscriberCount prop is provided', () => {
    render(<NewsletterInline subscriberCount="2.4K+" />)
    // Count appears in both the subline paragraph and the footer — use getAllByText
    const matches = screen.getAllByText(/2\.4K\+/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('calls trackNewsletterSignup("inline") on successful submit', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    render(<NewsletterInline />)
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Get Free Money Tips/i }))

    await waitFor(() => {
      expect(trackNewsletterSignupMock).toHaveBeenCalledWith('inline')
    })
  })

  it('does NOT call trackNewsletterSignup when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    render(<NewsletterInline />)
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Get Free Money Tips/i }))

    await waitFor(() => {
      expect(trackNewsletterSignupMock).not.toHaveBeenCalled()
    })
  })

  it('shows success message after successful submit', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    render(<NewsletterInline />)
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Get Free Money Tips/i }))

    await waitFor(() => {
      expect(screen.getByText(/You're in!/i)).toBeInTheDocument()
    })
  })
})
