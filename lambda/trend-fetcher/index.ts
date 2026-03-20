import googleTrends from 'google-trends-api'
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { log } from '../shared/logger'

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })
const TABLE  = process.env.TOPICS_TABLE!

// ─── Finance relevance detection ─────────────────────────────────────────────
const FINANCE_INDICATORS = [
  'budget', 'invest', 'debt', 'credit', 'sav', 'income', 'money', 'loan',
  'mortgage', 'tax', 'retire', 'stock', 'fund', 'salary', 'earn', 'bank',
  'insurance', 'wealth', 'financ', 'inflation', 'interest rate',
  'recession', 'market', 'side hustle', 'passive income', 'paycheck',
  'emergency fund', 'roth', '401k', 'ira', 'dividend', 'real estate',
]

function isFinanceRelated(text: string): boolean {
  const lower = text.toLowerCase()
  return FINANCE_INDICATORS.some((ind) => lower.includes(ind))
}

// ─── RSS feeds for live financial news ───────────────────────────────────────
function getFinanceRssFeeds(): string[] {
  const year = new Date().getFullYear()
  return [
    `https://news.google.com/rss/search?q=personal+finance+tips+${year}&hl=en-US&gl=US&ceid=US:en`,
    `https://news.google.com/rss/search?q=investing+for+beginners+${year}&hl=en-US&gl=US&ceid=US:en`,
    `https://news.google.com/rss/search?q=credit+score+debt+payoff+${year}&hl=en-US&gl=US&ceid=US:en`,
    `https://news.google.com/rss/search?q=budgeting+saving+money+${year}&hl=en-US&gl=US&ceid=US:en`,
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=personal-finance&region=US&lang=en-US',
    'https://www.cnbc.com/id/10000664/device/rss/rss.html',
  ]
}

async function fetchNewsHeadlines(): Promise<string[]> {
  const headlines: string[] = []
  for (const feedUrl of getFinanceRssFeeds()) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthBeginners/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      const xml = await res.text()
      const cdataRe = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g
      const plainRe  = /<item>[\s\S]*?<title>(.*?)<\/title>/g
      for (const re of [cdataRe, plainRe]) {
        for (const m of xml.matchAll(re)) {
          const t = m[1]?.replace(/<[^>]*>/g, '').trim()
          if (t && t.length > 10 && isFinanceRelated(t)) headlines.push(t)
          if (headlines.length >= 40) break
        }
        if (headlines.length >= 40) break
      }
    } catch { /* skip feed */ }
  }
  return [...new Set(headlines)].slice(0, 40)
}

async function fetchDailyTrendSeeds(): Promise<string[]> {
  const seeds: string[] = []
  try {
    const raw = await (googleTrends as any).dailyTrends({ geo: 'US', hl: 'en-US' })
    const parsed = JSON.parse(raw)
    for (const day of (parsed?.default?.trendingSearchesDays ?? []).slice(0, 2)) {
      for (const t of day?.trendingSearches ?? []) {
        const q = t?.title?.query?.trim()
        if (q && isFinanceRelated(q)) seeds.push(q)
      }
    }
  } catch { /* skip */ }
  return seeds
}

/**
 * Build dynamic query seeds from live data.
 * Priority: Google Trends daily trending (finance-filtered) → news headlines.
 * Falls back to minimal evergreen queries only if all live sources fail.
 */
async function buildDynamicQueries(headlines: string[]): Promise<string[]> {
  const seeds = new Set<string>()

  // 1. Finance-relevant Google Trends daily trending searches
  for (const s of await fetchDailyTrendSeeds()) seeds.add(s)

  // 2. Convert news headlines to search-style queries
  for (const h of headlines) {
    // Strip source attribution: "How to save money — CNBC" → "how to save money"
    const query = h
      .replace(/\s*[-–—|]\s*[A-Z].*$/, '')
      .trim()
      .toLowerCase()
      .slice(0, 60)
    if (query.split(/\s+/).length >= 2 && query.length >= 8) seeds.add(query)
    if (seeds.size >= 30) break
  }

  const result = [...seeds].slice(0, 20)
  if (result.length < 5) {
    // Guaranteed evergreen fallback — only reached if all HTTP calls fail
    const year = new Date().getFullYear()
    return [
      `investing for beginners ${year}`,
      `how to get out of debt fast`,
      `improve credit score fast`,
      `best budgeting methods ${year}`,
      `passive income ideas ${year}`,
    ]
  }
  return result
}

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

async function saveTopic(keyword: string, originalQuery: string, trendScore: number, risingKeywords: string[] = []) {
  const id       = `trend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const enriched = enrichKeyword(keyword)
  const priority = trendScoreToPriority(trendScore)

  // Keep only unique, clean related keywords (exclude the keyword itself)
  const relatedTrends = [...new Set(
    risingKeywords.map(k => k.trim().toLowerCase()).filter(k => k && k !== enriched.toLowerCase())
  )].slice(0, 8)

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
        ...(relatedTrends.length > 0 && {
          relatedTrends: { SS: relatedTrends },
        }),
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
  risingKeywords: string[],
): Promise<void> {
  if (!kw || isProhibited(kw)) { skipped.push(kw); return }
  if (await isDuplicate(kw))   { skipped.push(kw); return }

  const trendScore = fetchScore ? await fetchTrendScore(kw) : 50

  try {
    const result = await saveTopic(kw, query, trendScore, risingKeywords)
    saved.push(result.keyword)
    log({ lambda: 'trend-fetcher', step: 'save-topic', status: 'complete',
      meta: { keyword: result.keyword, trendScore, priority: result.priority } })
  } catch {
    skipped.push(kw)
  }
}

export const handler = async () => {
  log({ lambda: 'trend-fetcher', step: 'handler-start', status: 'start', pct: 0,
    meta: { queriesTotal: 0 } })

  const saved: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  // Build dynamic query seeds from live data
  const dynamicQueries = await buildDynamicQueries(await fetchNewsHeadlines())
  log({ lambda: 'trend-fetcher', step: 'dynamic-queries', status: 'complete', pct: 10,
    meta: { queriesTotal: dynamicQueries.length } })

  const total = dynamicQueries.length
  for (let i = 0; i < total; i++) {
    const query = dynamicQueries[i]
    const pct   = Math.round(((i + 1) / total) * 100)

    log({ lambda: 'trend-fetcher', step: 'fetch-query', status: 'start', pct,
      meta: { query, done: i, total } })

    try {
      const raw = await googleTrends.relatedQueries({ keyword: query, geo: 'US', hl: 'en-US' })
      const parsed = JSON.parse(raw)
      const risingItems: Array<{ query: string }> =
        parsed?.default?.rankedList?.[0]?.rankedKeyword ?? []

      // Collect all rising query strings for context storage
      const allRisingKeywords = risingItems.map(item => item.query?.trim()).filter(Boolean)

      // Only fetch Interest Over Time for the top 3 to avoid rate limiting
      for (let j = 0; j < Math.min(3, risingItems.length); j++) {
        await processTrendItem(risingItems[j].query?.trim(), query, saved, skipped, true, allRisingKeywords)
      }
      // Process remaining items without an extra API call
      for (let j = 3; j < Math.min(5, risingItems.length); j++) {
        await processTrendItem(risingItems[j].query?.trim(), query, saved, skipped, false, allRisingKeywords)
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
