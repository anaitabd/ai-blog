'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin',              icon: '📊', label: 'Dashboard' },
  { href: '/admin/posts',        icon: '📝', label: 'Posts',         badge: 'pending' },
  { href: '/admin/topics',       icon: '🎯', label: 'Topics' },
  { href: '/admin/youtube',      icon: '🎬', label: 'YouTube' },
  { href: '/admin/logs',         icon: '📋', label: 'Logs' },
  { href: '/admin/email',        icon: '📧', label: 'Email' },
  { href: '/admin/quality',      icon: '🌟', label: 'Quality' },
  { href: '/admin/monetization', icon: '💰', label: 'Monetization' },
  { href: '/admin/pinterest',    icon: '📌', label: 'Pinterest' },
  { href: '/admin/settings',     icon: '⚙️',  label: 'Settings' },
]

interface Props {
  pendingCount: number
}

export default function SidebarNav({ pendingCount }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.replace('/admin/login')
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <aside className="w-64 bg-[#0B1628] flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#C9A84C]/20 shrink-0">
        <Link href="/admin" className="font-serif text-lg font-bold text-[#C9A84C]" onClick={() => setOpen(false)}>
          WealthBeginners
        </Link>
        <p className="text-[11px] text-[#FAF8F3]/40 mt-0.5 tracking-wide">Admin Dashboard</p>
      </div>

      {/* User */}
      <div className="px-5 py-3.5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#C9A84C]/25 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#C9A84C]">A</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#FAF8F3]/90">Admin</p>
            <p className="text-[10px] text-[#FAF8F3]/40">WealthBeginners</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C] font-medium'
                  : 'text-[#FAF8F3]/65 hover:bg-white/5 hover:text-[#FAF8F3]'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge === 'pending' && pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-white/5 shrink-0 space-y-0.5">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#FAF8F3]/45 hover:text-[#FAF8F3]/80 transition-colors"
        >
          <span className="text-base w-5 text-center">🌐</span>
          <span>View site →</span>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#FAF8F3]/45 hover:text-red-400 transition-colors"
        >
          <span className="text-base w-5 text-center">🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 bg-[#0B1628] text-[#C9A84C] p-2 rounded-lg shadow-lg"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {open
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:w-64 lg:z-30">
        <SidebarContent />
      </div>
    </>
  )
}
