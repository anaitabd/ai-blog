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

