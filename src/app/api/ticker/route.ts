import { NextResponse } from 'next/server'

export const revalidate = 900 // 15-minute cache

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

async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 900 },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      price: meta.regularMarketPrice ?? meta.chartPreviousClose,
      changePercent: meta.regularMarketChangePercent ?? 0,
    }
  } catch {
    return null
  }
}

function fmt(pct: number): number {
  return Math.round(pct * 100) / 100
}

export async function GET() {
  const items: TickerItem[] = [...FALLBACK]

  // ── S&P 500 via Yahoo Finance ───────────────────────────────────────
  const sp500 = await fetchYahooQuote('^GSPC')
  if (sp500) {
    const idx = items.findIndex((i) => i.label === 'S&P 500')
    if (idx !== -1) {
      items[idx] = {
        label: 'S&P 500',
        value: sp500.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: fmt(sp500.changePercent),
      }
    }
  }

  // ── Gold via Yahoo Finance ──────────────────────────────────────────
  const gold = await fetchYahooQuote('GC=F')
  if (gold) {
    const idx = items.findIndex((i) => i.label === 'Gold (oz)')
    if (idx !== -1) {
      items[idx] = {
        label: 'Gold (oz)',
        value: `$${gold.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        change: fmt(gold.changePercent),
      }
    }
  }

  // ── 10Y Treasury via fiscaldata.treasury.gov ────────────────────────
  try {
    const res = await fetch(
      'https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates' +
      '?fields=record_date,avg_interest_rate_amt' +
      '&filter=security_desc:eq:Treasury%20Bonds' +
      '&sort=-record_date&page[size]=1',
      { next: { revalidate: 900 } }
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
    // silently use fallback
  }

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=120' },
  })
}

