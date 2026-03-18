import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })

interface Topic {
  keyword: string
  category: string
  priority: number
  relatedArticle?: string
  leadMagnet?: string
}

// ─── Edit this list to match your niche ──────────────────────
const TOPICS: Topic[] = [
  // High CPC — debt & credit (advertisers pay top dollar here)
  { keyword: 'how to pay off credit card debt fast', category: 'Debt', priority: 10 },
  { keyword: 'best balance transfer credit cards 2025', category: 'Credit Cards', priority: 10 },
  { keyword: 'how to improve credit score 100 points', category: 'Credit', priority: 10 },
  { keyword: 'debt snowball vs debt avalanche method', category: 'Debt', priority: 9 },
  { keyword: 'how to get out of debt on low income', category: 'Debt', priority: 9 },

  // High CPC — investing (huge advertiser competition)
  { keyword: 'how to start investing with little money', category: 'Investing', priority: 10 },
  { keyword: 'index funds vs ETFs for beginners', category: 'Investing', priority: 9 },
  { keyword: 'best brokerage accounts for beginners 2025', category: 'Investing', priority: 9 },
  { keyword: 'how to open a Roth IRA step by step', category: 'Investing', priority: 9 },
  { keyword: 'compound interest explained with examples', category: 'Investing', priority: 8 },
  { keyword: 'how to invest 1000 dollars for beginners', category: 'Investing', priority: 8 },
  { keyword: 'what is dollar cost averaging strategy', category: 'Investing', priority: 8 },

  // High CPC — budgeting & saving
  { keyword: 'how to budget money on low income', category: 'Budgeting', priority: 10 },
  { keyword: 'zero based budgeting method explained', category: 'Budgeting', priority: 9 },
  { keyword: '50 30 20 budget rule explained', category: 'Budgeting', priority: 9 },
  { keyword: 'best budgeting apps that actually work', category: 'Budgeting', priority: 8 },
  { keyword: 'how to save money fast on a tight budget', category: 'Saving', priority: 8 },
  { keyword: 'sinking funds explained how to use them', category: 'Saving', priority: 7 },
  {
    keyword: 'how to build an emergency fund from scratch',
    category: 'Saving',
    priority: 8,
    relatedArticle: 'How to Budget on a Low Income — WealthBeginners',
    leadMagnet: 'Free Emergency Fund Tracker Spreadsheet',
  },

  // High CPC — income & side hustles (advertiser goldmine)
  { keyword: 'best passive income ideas that actually work', category: 'Income', priority: 10 },
  { keyword: 'how to make money online legitimate ways', category: 'Income', priority: 9 },
  { keyword: 'side hustles you can start with no money', category: 'Income', priority: 9 },
  { keyword: 'how to negotiate a higher salary guide', category: 'Career', priority: 8 },
  { keyword: 'freelancing for beginners how to start', category: 'Income', priority: 7 },

  // Evergreen financial literacy
  { keyword: 'what is net worth and how to calculate it', category: 'Financial Literacy', priority: 7 },
  { keyword: 'how does compound interest work explained', category: 'Financial Literacy', priority: 7 },
  { keyword: 'difference between gross income and net income', category: 'Financial Literacy', priority: 6 },
  { keyword: 'what is an emergency fund and how much', category: 'Financial Literacy', priority: 7 },
  { keyword: 'how to read a pay stub explained simply', category: 'Financial Literacy', priority: 6 },

  // Productivity — high CPC from SaaS advertisers
  { keyword: 'best project management tools for small teams', category: 'Productivity', priority: 8 },
  { keyword: 'notion vs obsidian which is better', category: 'Productivity', priority: 7 },
  { keyword: 'how to use notion for personal finance', category: 'Productivity', priority: 7 },
  { keyword: 'best free productivity apps for remote work', category: 'Productivity', priority: 7 },
  { keyword: 'time blocking method how to actually do it', category: 'Productivity', priority: 6 },
]

export const handler = async () => {
  let seeded = 0
  let skipped = 0

  for (const topic of TOPICS) {
    try {
      await dynamo.send(
        new PutItemCommand({
          TableName: process.env.TOPICS_TABLE!,
          Item: {
            id: { S: randomUUID() },
            keyword: { S: topic.keyword },
            category: { S: topic.category },
            priority: { N: String(topic.priority) },
            status: { S: 'PENDING' },
            createdAt: { S: new Date().toISOString() },
            relatedArticle: topic.relatedArticle ? { S: topic.relatedArticle } : { NULL: true },
            leadMagnet: topic.leadMagnet ? { S: topic.leadMagnet } : { NULL: true },
          },
        })
      )
      seeded++
    } catch {
      skipped++
    }
  }

  console.log(`Seeded ${seeded} topics, skipped ${skipped}`)
  return { seeded, skipped, total: TOPICS.length }
}
