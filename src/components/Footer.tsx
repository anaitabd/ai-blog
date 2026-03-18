'use client'

import Link from 'next/link'
import { useState } from 'react'

const TOPICS = [
  { label: 'Investing',    href: '/category/investing' },
  { label: 'Budgeting',    href: '/category/budgeting' },
  { label: 'Paying Off Debt', href: '/category/debt' },
  { label: 'Side Income',  href: '/category/income' },
  { label: 'Saving Money', href: '/category/saving' },
  { label: 'Retirement',   href: '/category/retirement' },
  { label: 'Credit Scores',href: '/category/credit' },
]

const COMPANY = [
  { label: 'About',        href: '/about' },
  { label: 'Contact',      href: '/contact' },
]

const LEGAL = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Disclaimer',     href: '/disclaimer' },
]

export default function Footer() {
  const [email, setEmail]     = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email }),
      })
      setSubscribed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="bg-navy text-white/80 mt-20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="font-serif text-xl font-bold text-white">
              Wealth<span className="text-gold">Beginners</span>
            </Link>
            <p className="mt-3 text-sm text-white/60 leading-relaxed">
              Real money advice for real beginners. No jargon, no hype — just practical guides updated daily.
            </p>
            {/* Mini newsletter */}
            <div className="mt-5">
              {subscribed ? (
                <p className="text-xs text-gold">✓ You&apos;re subscribed!</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gold hover:bg-gold-2 text-navy text-sm font-semibold px-3 py-2 rounded-lg transition-colors shrink-0"
                  >
                    {loading ? '...' : 'Join'}
                  </button>
                </form>
              )}
            </div>
            {/* Social icons */}
            <div className="flex gap-3 mt-5">
              <a href="https://twitter.com/wealthbeginners" aria-label="Twitter/X" target="_blank" rel="noopener noreferrer"
                className="text-white/40 hover:text-gold transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://youtube.com/@wealthbeginners" aria-label="YouTube" target="_blank" rel="noopener noreferrer"
                className="text-white/40 hover:text-gold transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://pinterest.com/wealthbeginners" aria-label="Pinterest" target="_blank" rel="noopener noreferrer"
                className="text-white/40 hover:text-gold transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Topics */}
          <div>
            <h4 className="text-white text-sm font-semibold uppercase tracking-widest mb-4">Topics</h4>
            <ul className="space-y-2">
              {TOPICS.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-gold transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white text-sm font-semibold uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2">
              {COMPANY.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-gold transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white text-sm font-semibold uppercase tracking-widest mb-4">Legal</h4>
            <ul className="space-y-2">
              {LEGAL.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-gold transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} WealthBeginners.com. All rights reserved.
          </p>
          <div className="flex gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              AdSense Ready
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              HTTPS Secure
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
              GDPR Compliant
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
