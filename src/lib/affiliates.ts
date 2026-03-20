import { normalizeCategory } from './category-utils'

export interface AffiliateItem {
  name:     string
  tagline:  string
  url:      string
  cta:      string
  badge:    string | null
  network:  string
}

export const affiliateConfig: Record<string, AffiliateItem[]> = {
  credit: [
    {
      name: 'Credit Karma',
      tagline: 'Check your credit score free — no card needed',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Check Score Free →',
      badge: '100% Free',
      network: 'Impact.com',
    },
    {
      name: 'NerdWallet',
      tagline: 'Compare credit cards — find your best match',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Compare Cards →',
      badge: null,
      network: 'Impact.com',
    },
  ],
  investing: [
    {
      name: 'Betterment',
      tagline: 'Automated investing — start with any amount',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Start Investing →',
      badge: 'Top Rated',
      network: 'Impact.com',
    },
    {
      name: 'Acorns',
      tagline: 'Invest your spare change automatically',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Start With $5 →',
      badge: 'Best for Beginners',
      network: 'Impact.com',
    },
  ],
  budgeting: [
    {
      name: 'YNAB',
      tagline: 'The budgeting app that actually changes behavior',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Try Free 34 Days →',
      badge: "Editor's Pick",
      network: 'Impact.com',
    },
  ],
  debt: [
    {
      name: 'NerdWallet',
      tagline: 'Compare debt consolidation loan rates',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Compare Rates →',
      badge: null,
      network: 'Impact.com',
    },
  ],
  saving: [
    {
      name: 'SoFi',
      tagline: 'High-yield savings — earn more on every dollar',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Open Account →',
      badge: 'High Yield',
      network: 'Impact.com',
    },
  ],
  income: [
    {
      name: 'Amazon Associates',
      tagline: 'Earn commissions on products you recommend',
      url: 'REPLACE_AFTER_AMAZON_APPROVAL',
      cta: 'Join Free →',
      badge: null,
      network: 'Amazon',
    },
  ],
  retirement: [
    {
      name: 'Betterment',
      tagline: 'IRA and retirement accounts made simple',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Open IRA →',
      badge: 'Top Rated',
      network: 'Impact.com',
    },
  ],
  'real-estate': [
    {
      name: 'Fundrise',
      tagline: 'Invest in real estate with as little as $10',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Start Investing →',
      badge: 'Low Minimum',
      network: 'Impact.com',
    },
  ],
  default: [
    {
      name: 'Credit Karma',
      tagline: 'Free credit score and financial tools',
      url: 'REPLACE_AFTER_IMPACT_APPROVAL',
      cta: 'Check Free →',
      badge: '100% Free',
      network: 'Impact.com',
    },
  ],
}

export function getAffiliatesForCategory(category: string): AffiliateItem[] {
  const normalized = normalizeCategory(category)
  return affiliateConfig[normalized] || affiliateConfig.default
}

// ── Comprehensive affiliate product list with keyword matching ────────────────

interface AffiliateItemWithKeywords extends AffiliateItem {
  keywords: string[]
}

const ALL_AFFILIATES: AffiliateItemWithKeywords[] = [
  {
    name: 'Chase Sapphire',
    tagline: 'Premium travel rewards card — earn points on every purchase',
    url: process.env.AFFILIATE_CHASE_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Apply Now →',
    badge: 'Best Rewards',
    network: 'Chase',
    keywords: ['credit card', 'rewards', 'cash back', 'travel card', 'points', 'sign-up bonus'],
  },
  {
    name: 'Robinhood',
    tagline: 'Commission-free trading — stocks, ETFs, options, crypto',
    url: process.env.AFFILIATE_ROBINHOOD_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Start Investing →',
    badge: 'No Commissions',
    network: 'Robinhood',
    keywords: ['invest', 'stock', 'portfolio', 'etf', 'equity', 'brokerage', 'trading'],
  },
  {
    name: 'Acorns',
    tagline: 'Invest your spare change automatically — from $5',
    url: process.env.AFFILIATE_ACORNS_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Start With $5 →',
    badge: 'Best for Beginners',
    network: 'Acorns',
    keywords: ['savings', 'emergency fund', 'save', 'round-up', 'micro-invest', 'spare change'],
  },
  {
    name: 'YNAB',
    tagline: 'The budgeting app that actually changes behavior',
    url: process.env.AFFILIATE_YNAB_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Try Free 34 Days →',
    badge: "Editor's Pick",
    network: 'YNAB',
    keywords: ['budget', 'spending', 'track expenses', 'zero-based budget', 'overspending', 'money management'],
  },
  {
    name: 'TurboTax',
    tagline: 'File your taxes confidently — maximum refund guaranteed',
    url: process.env.AFFILIATE_TURBOTAX_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'File Free →',
    badge: '#1 Tax Software',
    network: 'Intuit',
    keywords: ['tax', 'refund', 'deduction', 'irs', 'w-2', 'tax return', 'tax filing', 'write-off'],
  },
  {
    name: 'SoFi Personal Loans',
    tagline: 'Low-rate personal loans — check your rate in 2 minutes',
    url: process.env.AFFILIATE_SOFI_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Check Your Rate →',
    badge: 'Low APR',
    network: 'SoFi',
    keywords: ['debt', 'loan', 'interest rate', 'consolidation', 'payoff', 'borrow', 'personal loan'],
  },
  {
    name: 'Coinbase',
    tagline: 'Buy, sell, and grow your crypto — trusted by 100M+ users',
    url: process.env.AFFILIATE_COINBASE_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Start Trading →',
    badge: 'Most Trusted',
    network: 'Coinbase',
    keywords: ['crypto', 'bitcoin', 'ethereum', 'cryptocurrency', 'blockchain', 'digital asset', 'defi'],
  },
  {
    name: 'LendingTree',
    tagline: 'Compare mortgage and loan rates from 1,500+ lenders',
    url: process.env.AFFILIATE_LENDINGTREE_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Compare Rates →',
    badge: 'Compare Lenders',
    network: 'LendingTree',
    keywords: ['mortgage', 'refinance', 'home loan', 'heloc', 'home equity', 'real estate loan', 'refi'],
  },
  {
    name: 'Personal Capital',
    tagline: 'Free retirement planning tools + wealth management',
    url: process.env.AFFILIATE_PERSONALCAPITAL_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Track Wealth Free →',
    badge: 'Free Tools',
    network: 'Empower',
    keywords: ['retire', 'retirement', '401k', 'ira', 'roth', 'pension', 'net worth', 'wealth', 'nest egg'],
  },
  {
    name: 'Credit Karma',
    tagline: 'Free credit score & monitoring — no card needed',
    url: process.env.AFFILIATE_CREDITKARMA_URL ?? 'REPLACE_AFTER_APPROVAL',
    cta: 'Check Score Free →',
    badge: '100% Free',
    network: 'Credit Karma',
    keywords: ['credit score', 'credit report', 'credit history', 'fico', 'credit monitoring', 'improve credit'],
  },
]

/**
 * Returns the top 3 most relevant affiliates for an article based on
 * keyword matching across title, category, and the first 500 chars of content.
 */
export function getAffiliatesForArticle(
  title: string,
  category: string,
  content: string,
): AffiliateItem[] {
  const searchText = [title, category, content.slice(0, 500)]
    .join(' ')
    .toLowerCase()

  const scored = ALL_AFFILIATES.map(({ keywords, ...affiliate }) => ({
    ...affiliate,
    score: keywords.reduce((acc, kw) => acc + (searchText.includes(kw) ? 1 : 0), 0),
  }))

  // Sort by match score (desc), then alphabetically for stable ties
  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
}

