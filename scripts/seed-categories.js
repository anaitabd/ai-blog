// Run with: node scripts/seed-categories.js
// Requires DATABASE_URL to be set in the environment (e.g. via .env.local)
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// All slugs referenced across Header, CategoryPills, ArticleCard, and seen in 404 logs.
const CATEGORIES = [
  { name: 'Investing',          slug: 'investing' },
  { name: 'Budgeting',          slug: 'budgeting' },
  { name: 'Debt',               slug: 'debt' },
  { name: 'Income',             slug: 'income' },
  { name: 'Tools',              slug: 'tools' },
  { name: 'Saving',             slug: 'saving' },
  { name: 'Credit',             slug: 'credit' },
  { name: 'Retirement',         slug: 'retirement' },
  { name: 'Real Estate',        slug: 'real-estate' },
  // Canonical 401k slug — publish webhook now normalises all "401 k" variants to this.
  // Any legacy "401-k-" row already in the DB will still resolve via dynamicParams=true.
  { name: '401(k)',             slug: '401k' },
  { name: 'Roth IRA',           slug: 'roth-ira' },
  { name: 'Financial Literacy', slug: 'financial-literacy' },
  { name: 'Career',             slug: 'career' },
  { name: 'Stocks',             slug: 'stocks' },
  { name: 'Side Hustles',       slug: 'side-hustles' },
  { name: 'Taxes',              slug: 'taxes' },
]

async function main() {
  console.log(`Seeding ${CATEGORIES.length} categories…`)

  for (const cat of CATEGORIES) {
    const result = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { name: cat.name, slug: cat.slug },
    })
    console.log(`  ✓ ${result.name} (${result.slug})`)
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())


