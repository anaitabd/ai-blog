'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const NAV_LINKS = [
  { label: 'Blog',       href: '/blog' },
  { label: 'Investing',  href: '/category/investing' },
  { label: 'Budgeting',  href: '/category/budgeting' },
  { label: 'Debt',       href: '/category/debt' },
  { label: 'Income',     href: '/category/income' },
  { label: 'Tools',      href: '/tools' },
  { label: 'About',      href: '/about' },
]

export default function Header() {
  const pathname               = usePathname()
  const router                 = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Shadow on scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // Close search on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header
      className={`bg-navy sticky top-0 z-50 border-b border-white/5 transition-shadow duration-200 ${
        scrolled ? 'shadow-[0_2px_20px_rgba(0,0,0,0.4)]' : ''
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0 font-serif text-xl font-bold text-white tracking-tight">
          Wealth<span className="text-gold">Beginners</span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm px-3 py-2 rounded-md transition-colors ${
                isActive(link.href)
                  ? 'text-gold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold rounded-full" />
              )}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles…"
                  className="w-[200px] md:w-[260px] bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-gold transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                  className="ml-2 text-white/60 hover:text-white"
                  aria-label="Close search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="text-white/70 hover:text-white p-2 rounded-md transition-colors"
                aria-label="Open search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
                </svg>
              </button>
            )}
          </div>

          {/* CTA — gold pill */}
          <Link
            href="#newsletter"
            className="hidden sm:inline-flex items-center bg-gold hover:bg-gold-2 text-navy text-sm font-semibold px-5 py-2 rounded-full transition-colors duration-150"
          >
            Free Newsletter →
          </Link>

          {/* Mobile hamburger */}
          <button
            aria-label="Toggle menu"
            className="md:hidden text-white/80 hover:text-white p-1"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu — full screen overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-navy flex flex-col"
          style={{ top: 0 }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="font-serif text-xl font-bold text-white"
            >
              Wealth<span className="text-gold">Beginners</span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-white/70 hover:text-white p-2"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile search */}
          <div className="px-4 py-4 border-b border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value
                if (q.trim()) {
                  router.push(`/search?q=${encodeURIComponent(q.trim())}`)
                  setMobileOpen(false)
                }
              }}
            >
              <input
                name="q"
                type="text"
                placeholder="Search articles…"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-gold"
              />
            </form>
          </div>

          {/* Links */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
            {[...NAV_LINKS, { label: 'Contact', href: '/contact' }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center py-3 px-4 rounded-xl text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-white/10 text-gold'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA at bottom */}
          <div className="p-4 border-t border-white/10">
            <Link
              href="#newsletter"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center bg-gold hover:bg-gold-2 text-navy font-semibold py-3 rounded-full transition-colors text-sm"
            >
              Subscribe Free →
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
