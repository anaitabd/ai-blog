'use client'

import { useEffect, useRef, useState } from 'react'
import type { Heading } from '@/lib/headings'

interface Props {
  headings: Heading[]
  /** When true, renders as a collapsible <details> block (for mobile inline use). */
  mobileInline?: boolean
}

export default function TableOfContents({ headings, mobileInline = false }: Readonly<Props>) {
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (typeof globalThis.window === 'undefined' || headings.length === 0) return

    const ids = headings.map((h) => h.id)

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  const tocList = (
    <nav aria-label="Table of contents">
      <ul className="space-y-1">
        {headings.map((heading) => {
          const isActive = heading.id === activeId
          const isH3    = heading.level === 3
          return (
            <li
              key={heading.id}
              className={isH3 ? 'pl-4' : ''}
            >
              <a
                href={`#${heading.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
                  setActiveId(heading.id)
                }}
                className={[
                  'block text-sm py-0.5 transition-colors leading-snug',
                  isH3 ? 'text-xs' : '',
                  isActive
                    ? 'text-[#C9A84C] font-semibold'
                    : 'text-[#374151] hover:text-[#C9A84C]',
                ].join(' ')}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  // ── Mobile inline: collapsible <details> ─────────────────────────────────
  if (mobileInline) {
    return (
      <details className="lg:hidden mb-8 bg-[#f9f7f2] border border-[#e5e0d5] rounded-xl overflow-hidden">
        <summary className="flex items-center justify-between px-5 py-3.5 font-semibold text-sm text-[#1A1A2E] cursor-pointer select-none list-none">
          <span>📋 Table of Contents</span>
          <svg
            className="w-4 h-4 text-[#C9A84C] transition-transform details-open:rotate-180"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-5 py-4 border-t border-[#e5e0d5]">
          {tocList}
        </div>
      </details>
    )
  }

  // ── Sidebar sticky (desktop) ─────────────────────────────────────────────
  return (
    <div className="bg-[#f9f7f2] border border-[#e5e0d5] rounded-xl p-5 mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#C9A84C] mb-3">
        Table of Contents
      </p>
      {tocList}
    </div>
  )
}
