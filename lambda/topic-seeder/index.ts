import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { randomUUID } from 'crypto'
import googleTrends from 'google-trends-api'

const dynamo  = new DynamoDBClient({ region: process.env.AWS_REGION })
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedTopic {
  keyword: string
  category: string
  priority: number
  rationale: string
  relatedArticle?: string
  leadMagnet?: string
}

// ─── Live news sources (all public RSS — no API keys) ─────────────────────────

const NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=personal+finance+tips+2026&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=investing+for+beginners+2026&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=budgeting+saving+money+tips&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=debt+payoff+credit+score+tips&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=side+hustle+passive+income+2026&hl=en-US&gl=US&ceid=US:en',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=personal-finance&region=US&lang=en-US',
  'https://www.cnbc.com/id/10000664/device/rss/rss.html',
]


const REDDIT_SUBS = ['personalfinance', 'financialindependence', 'povertyfinance', 'investing', 'frugal']

// ─── Fetchers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchRssHeadlines(): Promise<string[]> {
  const headlines: string[] = []
  for (const feedUrl of NEWS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthBeginners/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      const xml = await res.text()
      const cdataRe = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g
      for (const m of xml.matchAll(cdataRe)) {
        const t = m[1].trim()
        if (t && !t.toLowerCase().startsWith('google news')) headlines.push(t)
      }
      if (headlines.length === 0) {
        const plainRe = /<item>[\s\S]*?<title>(.*?)<\/title>/g
        for (const m of xml.matchAll(plainRe)) {
          const t = m[1].replace(/<[^>]*>/g, '').trim()
          if (t) headlines.push(t)
        }
      }
    } catch { /* skip failed feed */ }
  }
  return [...new Set(headlines)].slice(0, 40)
}

async function fetchRedditPosts(): Promise<string[]> {
  const posts: string[] = []
  for (const sub of REDDIT_SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthBeginners/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json() as { data?: { children?: Array<{ data?: { title?: string } }> } }
      for (const child of data?.data?.children ?? []) {
        const t = child?.data?.title?.trim()
        if (t) posts.push(t)
      }
    } catch { /* skip */ }
    await sleep(300)
  }
  return [...new Set(posts)].slice(0, 30)
}

/**
 * Derive short seed phrases from live RSS headlines for use as
 * Google Trends relatedQueries seeds — no static list needed.
 */
function extractSeedQueries(headlines: string[], count = 5): string[] {
  const seeds: string[] = []
  const year = new Date().getFullYear()
  for (const h of headlines) {
    // Strip source attribution ("How to save money — CNBC" → "how to save money")
    const clean = h.replace(/\s*[-–—|]\s*[A-Z].*$/, '').trim()
    // Take first 5 words as a short search-style query
    const phrase = clean.split(/\s+/).slice(0, 5).join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    if (phrase.split(' ').length >= 2 && phrase.length >= 8) seeds.push(phrase)
    if (seeds.length >= count) break
  }
  if (seeds.length === 0) {
    // Last-resort fallback — only if all RSS feeds failed
    return [`personal finance tips ${year}`, 'debt payoff strategies', 'credit score tips']
  }
  return seeds
}

async function fetchTrendingQueries(seeds: string[]): Promise<string[]> {
  const queries: string[] = []
  // Limit to 5 seeds to stay under Google Trends rate limit
  for (const seed of seeds.slice(0, 5)) {
    try {
      await sleep(1200)
      const raw = await (googleTrends as any).relatedQueries({ keyword: seed, geo: 'US', hl: 'en-US' })
      const parsed = JSON.parse(raw)
      const rising: Array<{ query: string }> = parsed?.default?.rankedList?.[0]?.rankedKeyword ?? []
      rising.slice(0, 5).forEach(item => { if (item.query) queries.push(item.query.trim()) })
    } catch { /* skip */ }
  }
  return [...new Set(queries)].slice(0, 25)
}

// ─── AI topic generator ───────────────────────────────────────────────────────

async function generateTopicsWithAI(
  headlines: string[],
  redditPosts: string[],
  trendingQueries: string[],
): Promise<GeneratedTopic[]> {
  const year = new Date().getFullYear()
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prompt = `You are an expert personal finance content strategist for WealthBeginners.com — a beginner-focused blog targeting adults aged 22–35 who want to improve their finances.

Analyze the LIVE data below and generate exactly 15 high-value blog article topics for ${month}.

═══════════════════════════════════════
LIVE DATA
═══════════════════════════════════════

📰 CURRENT NEWS HEADLINES:
${headlines.slice(0, 20).map((h, i) => `${i + 1}. ${h}`).join('\n')}

📈 RISING GOOGLE SEARCHES RIGHT NOW:
${trendingQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

💬 HOT COMMUNITY QUESTIONS (Reddit):
${redditPosts.slice(0, 15).map((p, i) => `${i + 1}. ${p}`).join('\n')}

═══════════════════════════════════════
RULES
═══════════════════════════════════════

- Keywords: 5–8 words, long-tail, beginner-focused, mirrors real Google searches
- Must be grounded in the live data above — not random generic ideas
- Specific over vague: "how to pay off 5000 in credit card debt" not "debt tips"

VALID CATEGORIES (copy exactly): Investing, Budgeting, Saving, Debt, Income, Credit, Financial Literacy, Career, Productivity

PRIORITY (1–10):
- 10: Investing / Credit / Debt ($4–$8 CPC)
- 8–9: Budgeting / Saving / Income ($2–$4 CPC)
- 6–7: Financial Literacy / Career / Productivity ($1–$2 CPC)

Respond ONLY with a valid JSON array, no other text:

\`\`\`json
[
  {
    "keyword": "exact 5-8 word keyword grounded in the live data above",
    "category": "valid category",
    "priority": 9,
    "rationale": "one sentence: why this is high-value right now based on the live data",
    "relatedArticle": "How to [Related Topic] — WealthBeginners",
    "leadMagnet": "Free [Resource] Spreadsheet"
  }
]
\`\`\``

  // Use Haiku — faster and cheaper than Sonnet for topic ideation
  const modelId = process.env.SEEDER_MODEL_ID ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0'

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await bedrock.send(command)
  const body     = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text

  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  const jsonStr = fenced ? fenced[1].trim() : text.trim()
  const parsed  = JSON.parse(jsonStr)
  return Array.isArray(parsed) ? parsed : []
}

// ─── Duplicate check ──────────────────────────────────────────────────────────

async function isDuplicate(keyword: string): Promise<boolean> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.TOPICS_TABLE!,
      IndexName: 'keyword-index',
      KeyConditionExpression: 'keyword = :kw',
      ExpressionAttributeValues: { ':kw': { S: keyword } },
      Limit: 1,
    })
  )
  return (result.Count ?? 0) > 0
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = async () => {
  console.log('🔍 Fetching live data sources…')

  // Step 1: Fetch headlines + Reddit in parallel (headlines drive trend seeds)
  const [headlines, redditPosts] = await Promise.all([
    fetchRssHeadlines(),
    fetchRedditPosts(),
  ])

  // Step 2: Derive dynamic seeds from live headlines, then query Google Trends
  const dynamicSeeds = extractSeedQueries(headlines)
  console.log(`📰 Headlines: ${headlines.length} | 💬 Reddit: ${redditPosts.length} | 🌱 Seeds: ${dynamicSeeds.join(', ')}`)
  const trendingQueries = await fetchTrendingQueries(dynamicSeeds)

  console.log(`📈 Trends: ${trendingQueries.length}`)

  if (headlines.length === 0 && redditPosts.length === 0 && trendingQueries.length === 0) {
    console.error('All data sources empty — aborting')
    return { seeded: 0, skipped: 0, error: 'All sources empty' }
  }

  console.log('🤖 Generating topics with AI…')
  let generatedTopics: GeneratedTopic[] = []

  try {
    generatedTopics = await generateTopicsWithAI(headlines, redditPosts, trendingQueries)
    console.log(`✨ AI generated ${generatedTopics.length} topic ideas`)
  } catch (err) {
    console.error('AI generation failed:', String(err))
    return { seeded: 0, skipped: 0, error: String(err) }
  }

  let seeded  = 0
  let skipped = 0

  for (const topic of generatedTopics) {
    if (!topic.keyword?.trim() || !topic.category) { skipped++; continue }

    const keyword = topic.keyword.toLowerCase().trim()
    if (await isDuplicate(keyword)) { skipped++; continue }

    try {
      await dynamo.send(
        new PutItemCommand({
          TableName: process.env.TOPICS_TABLE!,
          Item: {
            id:        { S: randomUUID() },
            keyword:   { S: keyword },
            category:  { S: topic.category },
            priority:  { N: String(Math.min(10, Math.max(1, topic.priority ?? 7))) },
            status:    { S: 'PENDING' },
            source:    { S: 'ai-seeder' },
            createdAt: { S: new Date().toISOString() },
            ...(topic.rationale      && { rationale:      { S: topic.rationale } }),
            ...(topic.relatedArticle && { relatedArticle: { S: topic.relatedArticle } }),
            ...(topic.leadMagnet     && { leadMagnet:     { S: topic.leadMagnet } }),
          },
        })
      )
      console.log(`  ✓ [${topic.category} · P${topic.priority}] ${keyword}`)
      seeded++
    } catch {
      skipped++
    }
  }

  console.log(`\n✅ Seeded ${seeded} new topics, skipped ${skipped} duplicates`)
  return {
    seeded, skipped,
    total: generatedTopics.length,
    sources: { headlines: headlines.length, reddit: redditPosts.length, trends: trendingQueries.length },
  }
}
