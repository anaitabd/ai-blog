'use client'

import { useEffect, useState } from 'react'

interface TickerItem {
  label: string
  value: string
  change: number // positive = up, negative = down, 0 = neutral
}

const FALLBACK: TickerItem[] = [
  { label: 'S&P 500',           value: '5,417.21', change:  0.42 },
  { label: 'Avg Mortgage Rate', value: '6.87%',    change: -0.03 },
  { label: 'CPI Inflation',     value: '3.2%',     change:  0.1  },
  { label: '10Y Treasury',      value: '4.31%',    change:  0.05 },
  { label: 'Fed Funds Rate',    value: '5.25%',    change:  0    },
  { label: 'Gold (oz)',         value: '$2,341',   change:  0.8  },
]

export default function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK)

  useEffect(() => {
    // Fetch via our server-side proxy to avoid CORS issues with the Treasury API.
    fetch('/api/ticker')
      .then((r) => r.json())
      .then((data: TickerItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setItems(data)
        }
      })
      .catch(() => {/* silently use fallback */})
  }, [])

  const doubled = [...items, ...items] // duplicate for seamless loop

  return (
    <div className="bg-gold text-navy overflow-hidden py-2 text-xs font-semibold">
      <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 px-6">
            <span className="opacity-60">{item.label}</span>
            <span className="font-bold">{item.value}</span>
            {item.change !== 0 && (
              <span className={item.change > 0 ? 'text-emerald-700' : 'text-red-700'}>
                {item.change > 0 ? '▲' : '▼'}{Math.abs(item.change)}
              </span>
            )}
            <span className="opacity-30 ml-2">|</span>
          </span>
        ))}
      </div>
    </div>
  )
}
