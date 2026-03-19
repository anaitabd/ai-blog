export const VALID_CATEGORIES = [
  'investing',
  'budgeting',
  'debt',
  'income',
  'saving',
  'credit',
  'retirement',
  'real-estate',
  '401-k',
  'roth-ira',
  'financial-literacy',
  'tools',
]

export function normalizeCategory(cat: string): string {
  return (
    cat
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'
  )
}

export function getCategoryLabel(slug: string): string {
  const labels: Record<string, string> = {
    investing: 'Investing',
    budgeting: 'Budgeting',
    debt: 'Debt',
    income: 'Income',
    saving: 'Saving',
    credit: 'Credit',
    retirement: 'Retirement',
    'real-estate': 'Real Estate',
    '401-k': '401(k)',
    'roth-ira': 'Roth IRA',
    'financial-literacy': 'Financial Literacy',
    tools: 'Tools',
  }
  return labels[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
}

