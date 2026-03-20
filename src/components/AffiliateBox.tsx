'use client'

import { usePathname } from 'next/navigation'
import { getAffiliatesForArticle, getAffiliatesForCategory, type AffiliateItem } from '@/lib/affiliates'
import { trackAffiliateClick } from '@/lib/analytics'

interface Props {
  category: string
  /** Article title — used for dynamic keyword matching */
  title?: string
  /** First 500 chars of article content — used for dynamic keyword matching */
  contentSnippet?: string
  /** Optional: pass pre-resolved affiliates to skip matching logic */
  affiliates?: AffiliateItem[]
}

export default function AffiliateBox({ category, title = '', contentSnippet = '', affiliates }: Props) {
  const pathname = usePathname()
  const items = affiliates
    ? affiliates.slice(0, 3)
    : title
      ? getAffiliatesForArticle(title, category, contentSnippet)
      : getAffiliatesForCategory(category).slice(0, 3)

  return (
    <aside
      className="my-8 rounded-lg overflow-hidden"
      style={{
        background: '#FAF8F3',
        borderLeft: '4px solid #C9A84C',
        boxShadow: '0 2px 12px rgba(11,22,40,0.07)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <p
          className="text-xs font-semibold uppercase tracking-[2px]"
          style={{ color: '#C9A84C' }}
        >
          Recommended Tools
        </p>
      </div>

      {/* Items */}
      <div className="px-5 pb-4 flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.name} className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-bold text-base"
                  style={{ color: '#0B1628' }}
                >
                  {item.name}
                </span>
                {item.badge && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#C9A84C', color: '#0B1628' }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <p
                className="text-sm mt-0.5 line-clamp-1"
                style={{ color: '#6B7280' }}
              >
                {item.tagline}
              </p>
            </div>

            {/* CTA */}
            {item.url.startsWith('REPLACE') ? (
              <span
                className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2 rounded-full opacity-60 cursor-not-allowed"
                style={{ background: '#C9A84C', color: '#0B1628' }}
              >
                Coming Soon
              </span>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2 rounded-full transition-colors duration-150 whitespace-nowrap"
                style={{ background: '#C9A84C', color: '#0B1628' }}
                onClick={() => trackAffiliateClick(item.name, pathname)}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#E8C96A')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#C9A84C')
                }
              >
                {item.cta}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div
        className="px-5 py-2 border-t text-[11px] italic"
        style={{ borderColor: '#E5E0D8', color: '#9CA3AF' }}
      >
        * Affiliate links — we may earn a small commission at no extra cost to you. We only
        recommend tools we trust.
      </div>
    </aside>
  )
}

