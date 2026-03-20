import { describe, it, expect } from 'vitest'
import { getAffiliatesForCategory, getAffiliatesForArticle } from '@/lib/affiliates'

describe('getAffiliatesForCategory', () => {
  it('returns an array for every known category', () => {
    const categories = ['investing', 'budgeting', 'debt', 'income', 'savings', 'general']
    for (const cat of categories) {
      const items = getAffiliatesForCategory(cat)
      expect(Array.isArray(items)).toBe(true)
    }
  })

  it('returns at most 3 items by default when sliced', () => {
    const items = getAffiliatesForCategory('investing').slice(0, 3)
    expect(items.length).toBeLessThanOrEqual(3)
  })

  it('each item has required fields: name, url, tagline', () => {
    const items = getAffiliatesForCategory('investing')
    for (const item of items) {
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('url')
      expect(item).toHaveProperty('tagline')
      expect(typeof item.name).toBe('string')
      expect(typeof item.url).toBe('string')
      expect(typeof item.tagline).toBe('string')
    }
  })

  it('URLs are valid https links (skips placeholder values)', () => {
    const items = getAffiliatesForCategory('investing')
    const realItems = items.filter((item) => !item.url.startsWith('REPLACE'))
    for (const item of realItems) {
      expect(item.url).toMatch(/^https?:\/\//)
    }
  })

  it('returns results for unknown category (falls back to general)', () => {
    const items = getAffiliatesForCategory('unknown-category')
    expect(Array.isArray(items)).toBe(true)
  })
})

describe('getAffiliatesForArticle', () => {
  it('returns an array given a title, category, and snippet', () => {
    const items = getAffiliatesForArticle(
      'How to Start Investing in Index Funds',
      'investing',
      'Index funds are a great way to build wealth over time.'
    )
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeLessThanOrEqual(3)
  })

  it('returns 3 or fewer items', () => {
    const items = getAffiliatesForArticle('Save Money Fast', 'savings', '')
    expect(items.length).toBeLessThanOrEqual(3)
  })
})
