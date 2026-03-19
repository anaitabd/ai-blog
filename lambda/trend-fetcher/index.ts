import googleTrends from 'google-trends-api'
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { log } from '../shared/logger'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })
const TABLE  = process.env.TOPICS_TABLE!

// Expanded seed queries — 20 personal-finance topics
const FINANCE_QUERIES = [
  'budgeting tips',
  'invest for beginners',
  'pay off debt fast',
  'emergency fund',
  'passive income ideas',
  'credit score improve',
  'retirement savings',
  'frugal living',
  'stock market basics',
  'side hustle ideas',
  'high yield savings account',
  'index fund investing',
  'how to start investing',
  'dividend investing',
  'real estate investing beginners',
  'tax saving strategies',
  'financial freedom',
  'money market account',
  '401k vs roth ira',
  'how to negotiate salary',
]

const PROHIBITED_KEYWORDS = [
  /casino|gambling|poker|bet/i,
  /porn|adult|xxx|escort/i,
  /cocaine|heroin|drugs/i,
  /hate|racist|slur/i,
  /\bscam\b|\bfraud\b/i,
]

const CPC_MAP: Record<string, string> = {
  invest: '$4.50', stock: '$3.80', retire: '$5.20', budget: '$2.10',
  debt: '$3.30',   credit: '$4.00', insurance: '$6.50', mortgage: '$7.00',
  loan: '$5.80',   income: '$2.50', savings: '$3.20',   tax: '$4.80',
  salary: '$2.90', dividend: '$4.20', 'real estate': '$5.50',
}

function isProhibited(keyword: string): boolean {
  return PROHIBITED_KEYWORDS.some((p) => p.test(keyword))
}

function estimateCPC(keyword: string): string {
  for (const [term, cpc] of Object.entries(CPC_MAP)) {
    if (keyword.toLowerCase().includes(term)) return cpc
  }
  return '$1.50'
}

function enrichKeyword(raw: string): string {
  const cleaned = raw.trim().toLowerCase()
  if (cleaned.split(' ').length === 1) return `${cleaned} for beginners`
  return cleaned
}

/** Map a 0–100 trend score to a readable monthly-search band. */
function trendScoreToSearchBand(score: number): string {
  if (score >= 80) return '50K+'
  if (score >= 50) return '10K-50K'
  if (score >= 20) return '1K-10K'
  return '<1K'
}

/** Map a 0–100 trend score to a DynamoDB priority (0–10). */
function trendScoreToPriority(score: number): number {
  return Math.round(score / 10)
}

/** Sleep helper to avoid rate-limiting Google Trends API. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch the average Interest Over Time score for a keyword over the last 4 weeks.
 * Returns 50 as a safe default if the call fails.
 */
async function fetchTrendScore(keyword: string): Promise<number> {
  try {
    await sleep(500)
    const raw = await (googleTrends as any).interestOverTime({ keyword, geo: 'US', hl: 'en-US' })
    const parsed = JSON.parse(raw)
    const timeline: Array<{ value: number[] }> = parsed?.default?.timelineData ?? []
    if (timeline.length === 0) return 50

    // Use only the last 4 weeks
    const recent = timeline.slice(-4)
    const sum = recent.reduce((acc, item) => acc + (item.value[0] ?? 0), 0)
    return Math.round(sum / recent.length)
  } catch {
    return 50 // safe default
  }
}

async function isDuplicate(keyword: string): Promise<boolean> {
  const normalized = keyword.toLowerCase().trim()
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'keyword-index',
      KeyConditionExpression: 'keyword = :kw',
      ExpressionAttributeValues: { ':kw': { S: normalized } },
      Limit: 1,
    })
  )
  return (result.Count ?? 0) > 0
}

async function saveTopic(keyword: string, originalQuery: string, trendScore: number) {
  const id       = `trend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const enriched = enrichKeyword(keyword)
  const priority = trendScoreToPriority(trendScore)

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        id:              { S: id },
        keyword:         { S: enriched },
        originalQuery:   { S: originalQuery },
        source:          { S: 'google-trends' },
        status:          { S: 'PENDING' },
        priority:        { N: String(priority) },
        trendScore:      { N: String(trendScore) },
        estimatedCPC:    { S: estimateCPC(enriched) },
        monthlySearches: { S: trendScoreToSearchBand(trendScore) },
        createdAt:       { S: new Date().toISOString() },
      },
      ConditionExpression: 'attribute_not_exists(id)',
    })
  )
  return { id, keyword: enriched, trendScore, priority }
}

async function processTrendItem(
  kw: string,
  query: string,
  saved: string[],
  skipped: string[],
  fetchScore: boolean,
): Promise<void> {
  if (!kw || isProhibited(kw)) { skipped.push(kw); return }
  if (await isDuplicate(kw))   { skipped.push(kw); return }

  const trendScore = fetchScore ? await fetchTrendScore(kw) : 50

  try {
    const result = await saveTopic(kw, query, trendScore)
    saved.push(result.keyword)
    log({ lambda: 'trend-fetcher', step: 'save-topic', status: 'complete',
      meta: { keyword: result.keyword, trendScore, priority: result.priority } })
  } catch {
    skipped.push(kw)
  }
}

export const handler = async () => {
  log({ lambda: 'trend-fetcher', step: 'handler-start', status: 'start', pct: 0,
    meta: { queriesTotal: FINANCE_QUERIES.length } })

  const saved: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  const total = FINANCE_QUERIES.length

  for (let i = 0; i < total; i++) {
    const query = FINANCE_QUERIES[i]
    const pct   = Math.round(((i + 1) / total) * 100)

    log({ lambda: 'trend-fetcher', step: 'fetch-query', status: 'start', pct,
      meta: { query, done: i, total } })

    try {
      const raw = await googleTrends.relatedQueries({ keyword: query, geo: 'US', hl: 'en-US' })
      const parsed = JSON.parse(raw)
      const risingItems: Array<{ query: string }> =
        parsed?.default?.rankedList?.[0]?.rankedKeyword ?? []

      // Only fetch Interest Over Time for the top 3 to avoid rate limiting
      for (let j = 0; j < Math.min(3, risingItems.length); j++) {
        await processTrendItem(risingItems[j].query?.trim(), query, saved, skipped, true)
      }
      // Process remaining items without an extra API call
      for (let j = 3; j < Math.min(5, risingItems.length); j++) {
        await processTrendItem(risingItems[j].query?.trim(), query, saved, skipped, false)
      }

      log({ lambda: 'trend-fetcher', step: 'fetch-query', status: 'complete', pct,
        meta: { query, found: risingItems.length } })
    } catch (err) {
      log({ lambda: 'trend-fetcher', step: 'fetch-query', status: 'error', pct,
        meta: { query, error: String(err) } })
      errors.push(query)
    }

    // Throttle between queries to avoid rate-limiting
    if (i < total - 1) await sleep(1000)
  }

  log({ lambda: 'trend-fetcher', step: 'handler-done', status: 'complete', pct: 100,
    meta: { saved: saved.length, skipped: skipped.length, errors: errors.length } })

  return { saved, skipped, errors }
}

