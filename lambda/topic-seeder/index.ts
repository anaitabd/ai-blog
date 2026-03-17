import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })

// ─── Edit this list to match your niche ──────────────────────
const TOPICS = [
  { keyword: 'best productivity apps for remote work 2025', category: 'Productivity', priority: 10 },
  { keyword: 'how to start investing with 100 dollars', category: 'Finance', priority: 10 },
  { keyword: 'beginner guide to intermittent fasting', category: 'Health', priority: 9 },
  { keyword: 'best free AI tools for students', category: 'Technology', priority: 9 },
  { keyword: 'how to learn programming for free online', category: 'Technology', priority: 9 },
  { keyword: 'home workout routine no equipment needed', category: 'Health', priority: 8 },
  { keyword: 'side hustle ideas that make real money', category: 'Finance', priority: 8 },
  { keyword: 'best budgeting apps for beginners', category: 'Finance', priority: 7 },
  { keyword: 'how to improve sleep quality naturally', category: 'Health', priority: 7 },
  { keyword: 'python vs javascript which to learn first', category: 'Technology', priority: 7 },
  { keyword: 'how to meal prep for the week', category: 'Health', priority: 6 },
  { keyword: 'best credit cards for cashback rewards', category: 'Finance', priority: 6 },
  { keyword: 'how to build a morning routine that sticks', category: 'Productivity', priority: 6 },
  { keyword: 'what is cloud computing explained simply', category: 'Technology', priority: 5 },
  { keyword: 'how to reduce stress and anxiety naturally', category: 'Health', priority: 5 },
  { keyword: 'passive income ideas for beginners', category: 'Finance', priority: 5 },
  { keyword: 'best free online courses for programming', category: 'Technology', priority: 4 },
  { keyword: 'how to declutter your home minimalist guide', category: 'Productivity', priority: 4 },
  { keyword: 'high protein meal ideas for muscle building', category: 'Health', priority: 4 },
  { keyword: 'how to negotiate a salary raise', category: 'Finance', priority: 3 },
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
