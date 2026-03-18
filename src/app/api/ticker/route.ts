import { NextResponse } from 'next/server'

// Cache the response for 1 hour at the CDN / Next.js data cache layer.
export const revalidate = 3600

interface TickerItem {
  label: string
  value: string
  change: number
}

const FALLBACK: TickerItem[] = [
  { label: 'S&P 500',           value: '5,417.21', change:  0.42 },
  { label: 'Avg Mortgage Rate', value: '6.87%',    change: -0.03 },
  { label: 'CPI Inflation',     value: '3.2%',     change:  0.1  },
  { label: '10Y Treasury',      value: '4.31%',    change:  0.05 },
  { label: 'Fed Funds Rate',    value: '5.25%',    change:  0    },
  { label: 'Gold (oz)',         value: '$2,341',   change:  0.8  },
]

export async function GET() {
  const items: TickerItem[] = [...FALLBACK]

  try {
    // The fiscaldata API requires a server-side fetch — browsers are blocked by CORS.
    // The correct security_desc value is "Treasury Bonds" (with plural).
    // If the Treasury endpoint changes, this falls back to static values silently.
    const res = await fetch(
      'https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates' +
      '?fields=record_date,avg_interest_rate_amt' +
      '&filter=security_desc:eq:Treasury%20Bonds' +
      '&sort=-record_date&page[size]=1',
      { next: { revalidate: 3600 } }
    )

    if (res.ok) {
      const data = await res.json()
      const rate: string | undefined = data?.data?.[0]?.avg_interest_rate_amt
      if (rate) {
        const idx = items.findIndex((i) => i.label === '10Y Treasury')
        if (idx !== -1) {
          items[idx] = { ...items[idx], value: `${parseFloat(rate).toFixed(2)}%` }
        }
      }
    }
  } catch {
    // Network or parse error — return fallback silently.
  }

  return NextResponse.json(items, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
    },
  })
}

