'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { label: 'All',        value: '' },
  { label: 'Investing',  value: 'investing' },
  { label: 'Budgeting',  value: 'budgeting' },
  { label: 'Debt',       value: 'debt' },
  { label: 'Income',     value: 'income' },
  { label: 'Saving',     value: 'saving' },
  { label: 'Credit',     value: 'credit' },
  { label: 'Retirement', value: 'retirement' },
]

export default function CategoryPills() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const active       = searchParams.get('category') ?? ''

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('category', value)
    else params.delete('category')
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => select(cat.value)}
          className={`whitespace-nowrap text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${
            active === cat.value
              ? 'bg-navy text-white border-navy'
              : 'bg-white text-muted border-border hover:border-navy hover:text-navy'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
