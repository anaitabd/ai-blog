'use client'

import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Investing',   href: '/category/investing' },
  { label: 'Budgeting',   href: '/category/budgeting' },
  { label: 'Debt',        href: '/category/debt' },
  { label: 'Income',      href: '/category/income' },
  { label: 'Tools',       href: '/category/tools' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="bg-navy sticky top-0 z-50 border-b border-white/5">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="shrink-0 font-serif text-xl font-bold text-white tracking-tight">
          Wealth<span className="text-gold">Beginners</span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 hover:text-white px-3 py-2 rounded-md transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            href="#newsletter"
            className="hidden sm:inline-flex items-center bg-gold hover:bg-gold-2 text-navy text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Free Newsletter
          </Link>

          {/* Mobile hamburger */}
          <button
            aria-label="Toggle menu"
            className="md:hidden text-white/80 hover:text-white p-1"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-navy-2 border-t border-white/5 px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 hover:text-white py-2 px-3 rounded-md transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="#newsletter"
            className="mt-2 text-center bg-gold hover:bg-gold-2 text-navy text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Free Newsletter
          </Link>
        </div>
      )}
    </header>
  )
}
