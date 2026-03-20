import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { log, updateTopicStep } from '../shared/logger'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const dynamo  = new DynamoDBClient({ region: process.env.AWS_REGION })

interface Event {
  topicId: string
  keyword: string
  category: string
  retryCount?: number
  relatedArticle?: string
  leadMagnet?: string
  trendScore?: number
  relatedTrends?: string[]
  originalQuery?: string
  // Populated on retries so the prompt knows exactly what failed
  qualityIssues?: string[]
  qualityWarnings?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Live context scraper — Google News RSS + Reddit (no API keys needed)
// ─────────────────────────────────────────────────────────────────────────────

interface LiveContext {
  headlines: string[]
  redditPosts: string[]
}

async function fetchLiveContext(keyword: string): Promise<LiveContext> {
  const headlines: string[]   = []
  const redditPosts: string[] = []

  // ── Google News RSS ───────────────────────────────────────────────────────
  try {
    const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' personal finance')}&hl=en-US&gl=US&ceid=US:en`
    const res = await fetch(newsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthBeginners/1.0; +https://wealthbeginners.com)' },
      signal: AbortSignal.timeout(6000),
    })
    const xml = await res.text()

    // Try CDATA-wrapped titles first (most Google News feeds)
    const cdataRe = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g
    for (const m of xml.matchAll(cdataRe)) {
      if (headlines.length >= 5) break
      const title = m[1].trim()
      if (title && !title.toLowerCase().startsWith('google news')) headlines.push(title)
    }

    // Fallback: plain <title> tags inside <item>
    if (headlines.length === 0) {
      const plainRe = /<item>[\s\S]*?<title>(.*?)<\/title>/g
      for (const m of xml.matchAll(plainRe)) {
        if (headlines.length >= 5) break
        const title = m[1].trim()
        if (title) headlines.push(title)
      }
    }
  } catch {
    // Silently skip — not critical
  }

  // ── Reddit JSON (r/personalfinance + r/financialindependence) ─────────────
  try {
    const sub = 'personalfinance+financialindependence+povertyfinance'
    const redditUrl = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(keyword)}&sort=hot&limit=8&restrict_sr=true&t=month`
    const res = await fetch(redditUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthBeginners/1.0)' },
      signal: AbortSignal.timeout(6000),
    })
    const data = await res.json() as { data?: { children?: Array<{ data?: { title?: string; score?: number } }> } }
    for (const post of data?.data?.children ?? []) {
      if (redditPosts.length >= 5) break
      const title = post?.data?.title?.trim()
      if (title) redditPosts.push(title)
    }
  } catch {
    // Silently skip — not critical
  }

  return { headlines, redditPosts }
}

export const handler = async (event: Event) => {
  const {
    topicId, keyword, category, retryCount = 0,
    relatedArticle, leadMagnet,
    trendScore, relatedTrends = [], originalQuery,
    qualityIssues = [], qualityWarnings = [],
  } = event
  const attempt = retryCount + 1

  log({ lambda: 'content-generator', step: 'handler-start', status: 'start', pct: 0,
    meta: { topicId, keyword, category, attempt, trendScore } })

  try {
    // ── Step 1: Fetch live context (news + Reddit) ────────────────────────
    await updateTopicStep(topicId, `Fetching live context · attempt ${attempt}/3`, dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'content-generator', step: 'fetch-live-context', status: 'start', pct: 5,
      meta: { keyword } })

    const liveContext = await fetchLiveContext(keyword)

    log({ lambda: 'content-generator', step: 'fetch-live-context', status: 'complete', pct: 8,
      meta: { headlines: liveContext.headlines.length, redditPosts: liveContext.redditPosts.length } })

    // ── Step 2: Bedrock call ──────────────────────────────────────────────
    await updateTopicStep(topicId, `Generating content · attempt ${attempt}/3`, dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'content-generator', step: 'bedrock-call', status: 'start', pct: 10,
      meta: { keyword, attempt } })

    const article = await callBedrock(
      keyword, category, retryCount > 0,
      relatedArticle, leadMagnet,
      { trendScore, relatedTrends, originalQuery, liveContext, qualityIssues, qualityWarnings },
    )

    log({ lambda: 'content-generator', step: 'bedrock-call', status: 'complete', pct: 70,
      meta: { titleLength: (article.title as string)?.length, contentWords: (article.content as string)?.trim().split(/\s+/).length } })

    // ── Step 2: Quality gate ─────────────────────────────────────────────
    await updateTopicStep(topicId, `Quality check · attempt ${attempt}/3`, dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'content-generator', step: 'quality-gate', status: 'start', pct: 75 })

    const quality = checkQuality(article.content as string)

    if (!quality.passed) {
      log({ lambda: 'content-generator', step: 'quality-gate', status: 'warn', pct: 75,
        meta: { issues: quality.issues, attempt } })

      if (retryCount < 2) {
        await updateTopicStep(topicId, `Quality retry · attempt ${attempt}/3 failed`, dynamo, process.env.TOPICS_TABLE!)
        return {
          ...event,
          retryCount: retryCount + 1,
          shouldRetry: true,
          qualityIssues:   quality.issues,
          qualityWarnings: quality.warnings,
        }
      }      await updateTopic(topicId, 'FAILED', quality.issues.join('; '))
      throw new Error(`Quality gate failed after ${attempt} attempts: ${quality.issues.join('; ')}`)
    }

    log({ lambda: 'content-generator', step: 'quality-gate', status: 'complete', pct: 100,
      meta: { wordCount: quality.wordCount } })
    await updateTopicStep(topicId, 'Content ready · awaiting publish', dynamo, process.env.TOPICS_TABLE!)

    return {
      topicId,
      keyword,
      category,
      article,
      wordCount: quality.wordCount,
      readingTime: Math.ceil(quality.wordCount / 200),
      shouldRetry: false,
    }
  } catch (err) {
    log({ lambda: 'content-generator', step: 'handler-error', status: 'error', pct: 0,
      meta: { error: String(err) } })
    await updateTopic(topicId, 'FAILED', String(err))
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JSON parser — resilient to formatting variations from Bedrock
// ─────────────────────────────────────────────────────────────────────────────

// Escape unescaped control characters inside JSON string literals.
// LLMs often emit real newlines/tabs inside string values instead of \n/\t.
function repairJsonStrings(text: string): string {
  let inString = false
  let escape   = false
  let out      = ''
  for (const ch of text) {
    if (escape)                        { escape = false; out += ch; continue }
    if (ch === '\\' && inString)       { escape = true;  out += ch; continue }
    if (ch === '"')                    { inString = !inString; out += ch; continue }
    if (inString) {
      if (ch === '\n')                 { out += '\\n'; continue }
      if (ch === '\r')                 { out += '\\r'; continue }
      if (ch === '\t')                 { out += '\\t'; continue }
    }
    out += ch
  }
  return out
}

function parseBedrockJson(text: string): Record<string, unknown> {
  // Build an ordered list of raw candidates to try
  const candidates: (string | null)[] = []

  // 1. Fenced ```json block — use GREEDY match so the full content field
  //    (which may contain inner ``` code blocks) is captured correctly.
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*)\n?\s*```/)
  if (fenced) candidates.push(fenced[1].trim())

  // 2. First outermost { … } block
  const brace = text.match(/(\{[\s\S]*\})/)
  if (brace) candidates.push(brace[1].trim())

  // 3. Whole text (model may have returned bare JSON)
  candidates.push(text.trim())

  for (const raw of candidates) {
    if (!raw) continue
    // Try as-is first, then with control-character repair
    for (const candidate of [raw, repairJsonStrings(raw)]) {
      try { return JSON.parse(candidate) } catch { /* try next */ }
    }
  }

  throw new Error(`Invalid JSON response from Bedrock — could not parse model output.\nRaw (first 300 chars): ${text.slice(0, 300)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(
  keyword: string,
  category: string,
  isRetry: boolean,
  relatedArticle?: string,
  leadMagnet?: string,
  trendCtx?: {
    trendScore?: number
    relatedTrends?: string[]
    originalQuery?: string
    liveContext?: LiveContext
    qualityIssues?: string[]
    qualityWarnings?: string[]
  },
): string {
  const year = new Date().getFullYear()

  const relatedLink = relatedArticle ?? 'another relevant article on WealthBeginners'
  const cta         = leadMagnet     ?? 'Free Beginner Budget Spreadsheet'

  // ── Build targeted RETRY block ────────────────────────────────────────────
  let retryNote = ''
  if (isRetry) {
    const issues   = trendCtx?.qualityIssues   ?? []
    const warnings = trendCtx?.qualityWarnings ?? []
    const lines: string[] = [
      '🚨 RETRY ATTEMPT — Your previous draft was REJECTED by the quality gate.',
      'Do NOT repeat the same mistakes. Read every failure below and fix ALL of them:',
      '',
    ]
    if (issues.length > 0) {
      lines.push('❌ HARD FAILURES (caused the rejection):')
      issues.forEach(i => lines.push(`   • ${i}`))
      lines.push('')
    }
    if (warnings.length > 0) {
      lines.push('⚠️  WARNINGS (fix these too):')
      warnings.forEach(w => lines.push(`   • ${w}`))
      lines.push('')
    }
    // Targeted fix instructions based on what actually failed
    const allText = [...issues, ...warnings].join(' ').toLowerCase()
    if (allText.includes('too short') || allText.includes('words')) {
      lines.push('✏️  WORD COUNT FIX: Write MORE. Target 1,700–1,900 words. Expand every section.')
    }
    if (allText.includes('anecdote') || allText.includes('e-e-a-t')) {
      lines.push('✏️  ANECDOTE FIX: You MUST have EXACTLY 3 [INSERT PERSONAL ANECDOTE: …] placeholders — one in the intro, one in the middle, one near the end. Do not skip any.')
    }
    if (allText.includes('h2') || allText.includes('section')) {
      lines.push('✏️  SECTIONS FIX: You MUST have at least 5 ## H2 headings in the article body.')
    }
    if (allText.includes('callout') || allText.includes('💡') || allText.includes('⚠️') || allText.includes('📊')) {
      lines.push('✏️  CALLOUT FIX: You MUST include at least one 💡 Pro Tip, one ⚠️ Warning, and one 📊 By the Numbers callout box.')
    }
    if (allText.includes('internal link')) {
      lines.push('✏️  LINK FIX: Include a natural internal link in the middle of the article to a related WealthBeginners post.')
    }
    if (allText.includes('banned') || allText.includes('ai word')) {
      lines.push('✏️  LANGUAGE FIX: Remove ALL banned AI words (delve, crucial, leverage, utilize, tapestry, furthermore, robust, etc.). Rewrite those sentences in plain English.')
    }
    retryNote = '\n' + lines.join('\n') + '\n'
  }

  // ── Build LIVE TREND CONTEXT block ────────────────────────────────────────
  const trendLines: string[] = []

  if (trendCtx?.trendScore !== undefined) {
    const band =
      trendCtx.trendScore >= 80 ? 'VERY HIGH (top trending right now)' :
      trendCtx.trendScore >= 50 ? 'HIGH (actively trending)' :
      trendCtx.trendScore >= 20 ? 'MODERATE (steady interest)' : 'EMERGING'
    trendLines.push(`• Google Trends Interest Score: ${trendCtx.trendScore}/100 — ${band}`)
  }

  if (trendCtx?.originalQuery) {
    trendLines.push(`• Seed search query that triggered this topic: "${trendCtx.originalQuery}"`)
  }

  if (trendCtx?.relatedTrends?.length) {
    trendLines.push(`• People also search for (rising related queries):`)
    trendCtx.relatedTrends.slice(0, 6).forEach(t => trendLines.push(`  - ${t}`))
  }

  const headlines = trendCtx?.liveContext?.headlines ?? []
  if (headlines.length > 0) {
    trendLines.push(`\n• What the news is currently saying about this topic (${year}):`)
    headlines.forEach(h => trendLines.push(`  📰 ${h}`))
  }

  const redditPosts = trendCtx?.liveContext?.redditPosts ?? []
  if (redditPosts.length > 0) {
    trendLines.push(`\n• What real people are asking on Reddit right now:`)
    redditPosts.forEach(r => trendLines.push(`  💬 ${r}`))
  }

  const trendBlock = trendLines.length > 0
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE TREND CONTEXT (use this to make the article feel current & authoritative)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${trendLines.join('\n')}

INSTRUCTION: Your article MUST be anchored to what people are searching and discussing RIGHT NOW.
- Address the rising related queries naturally within the article (weave them into subheadings or body)
- Reference the news angle as a hook or a "📊 By the Numbers" callout if data is present
- Answer the Reddit questions directly — these are REAL pain points beginners have TODAY
- Do NOT copy or quote these sources — use them as inspiration to make content feel timely
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    : ''

  return `Role: You are an elite personal finance copywriter writing for "WealthBeginners.com." Your tone is empathetic, fiercely honest, highly actionable, and conversational — like a smart friend giving advice over coffee.
${retryNote}${trendBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARTICLE BRIEF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic / Target keyword : "${keyword}"
Category               : ${category}
Year                   : ${year}
Related article to link: ${relatedLink}
Lead magnet CTA        : ${cta}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 6 WEALTHBEGINNERS RULES (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — WORD COUNT & PACING
- Target: 1,500 to 1,900 words (a 7-minute read). NEVER exceed 2,000 words.
- Maximum 2–3 SHORT sentences per paragraph. No walls of text.
- Get to the point in every paragraph. Cut every sentence that does not add value.

RULE 2 — ZERO AI FLUFF
Banned words (never use these):
delve, tapestry, testament, crucial, furthermore, undeniably, navigate, beacon,
embark, robust, foster, leverage, utilize, multifaceted, holistic, groundbreaking,
it's worth noting, in today's world, in conclusion, to summarize, remember that

- First sentence: hook with a relatable pain point, surprising real statistic, or hard truth. NO generic intros like "In today's financial landscape..."
- Last section: end abruptly with the CTA. Never write "In conclusion" or "To summarize."

RULE 3 — AGGRESSIVE SCANNABILITY
- Use H2 tags for major sections, H3 for sub-points
- Bold the single most important sentence in every major section
- Use bullet points and comparison tables for data and steps
- Include at least 3 visual callout boxes using:
  💡 Pro Tip: [1-2 sentence actionable tip]
  ⚠️ Warning: [1-2 sentence risk or mistake]
  📊 By the Numbers: [real statistic with source name — Federal Reserve, BLS, Bankrate, etc.]

RULE 4 — HUMAN-FIRST SEO & INTERNAL LINKING
- Use the target keyword naturally in: H1, first 100 words, one H2, final section
- Do NOT force awkward keyword phrasing — adjust so it sounds like natural speech
- In the MIDDLE of the article, write a natural transition sentence linking to: "${relatedLink}"
  Example: "If you're also working on cutting expenses, our guide on [related topic] walks you through exactly how to do it."
- Use 2–3 LSI keywords (related terms) throughout — do NOT repeat exact keyword more than 4 times

RULE 5 — E-E-A-T PLACEHOLDERS (Critical — do NOT skip)
Insert exactly 3 personal anecdote placeholders throughout the article.
Format them EXACTLY like this:

[INSERT PERSONAL ANECDOTE: Tell me what specific relatable struggle or
financial win I should share here to build trust with a beginner.
Be specific — e.g., "Share a time you overspent on a budget category
and what you did to fix it" or "Share when you first opened your Roth IRA
and what surprised you about the process."]

Place them: one in the intro section, one in the middle, one near the end.
These are placeholders the site owner will fill in — do NOT invent fake stories.

RULE 6 — CONVERSION CTA (final section only)
End the article with ONE powerful call-to-action:
- No "In conclusion" or "Final thoughts" header
- Use a direct, benefit-focused H2 like: "Get Your Free [Lead Magnet Name]"
- Tell the reader EXACTLY what problem the "${cta}" solves for them
- Make it urgent and specific: "Download it now and fill in your numbers tonight."
- Do NOT add anything after the CTA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED ARTICLE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. H1 title (55–65 chars, includes keyword naturally, includes ${year})
2. Hook paragraph — no H2, straight into the pain point or stat
3. [INSERT PERSONAL ANECDOTE #1]
4. ## What This Article Covers — bullet list of 4–5 takeaways
5. ## [Section 1] — first key concept (H3 sub-points if needed)
6. ## [Section 2] — second key concept + 📊 By the Numbers callout
7. ## [Section 3] — step-by-step OR comparison table
8. [INSERT PERSONAL ANECDOTE #2]
9. ## [Section 4] — common mistakes or warnings + ⚠️ Warning callout
10. Natural internal link transition to: "${relatedLink}"
11. ## [Section 5] — pro tips + 💡 Pro Tip callout
12. [INSERT PERSONAL ANECDOTE #3]
13. ## Get Your Free ${cta} — CTA section (LAST, no summary after this)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL DATA REQUIREMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include at least 3 real statistics from credible sources:
- Federal Reserve (federalreserve.gov)
- Bureau of Labor Statistics (bls.gov)
- FDIC (fdic.gov)
- Bankrate, NerdWallet, Fidelity research
- Pew Research Center
Format: "According to [Source], [specific stat with number and year]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURED IMAGE PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write a specific Titan Image Generator prompt:
- Brand colors: navy blue (#0B1628) background, gold (#C9A84C) accents
- Style: flat design illustration, financial editorial magazine
- No text, no faces, no logos, no copyright elements
- 16:9 landscape format
- Be specific about the visual metaphor (e.g., "stack of coins growing into
  a bar chart" not just "money")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEO METADATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Meta title: 50–60 chars, includes keyword, ends with "| WealthBeginners"
- Meta description: 145–158 chars, includes keyword, has a compelling hook
- URL slug: lowercase, hyphens only, no special characters, keyword-first

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELF-CHECK BEFORE RESPONDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before writing the JSON, verify:
□ Word count is between 1,500 and 1,900 words
□ Zero banned words used (delve, tapestry, crucial, etc.)
□ First sentence is a hook — not a generic intro
□ Exactly 3 E-E-A-T anecdote placeholders inserted
□ At least 3 callout boxes (💡 ⚠️ 📊)
□ Natural internal link to related article in the middle
□ Article ends with CTA — nothing written after it
□ At least 3 real statistics with source names
□ Meta title is 50–60 characters
□ Meta description is 145–158 characters
□ No "In conclusion", "To summarize", "Remember that"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (strict — no text before or after JSON block)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond ONLY with this JSON:

\`\`\`json
{
  "title": "H1 title 55–65 chars with keyword and ${year}",
  "slug": "keyword-first-url-slug",
  "excerpt": "Compelling 145–158 char excerpt with keyword and hook that makes someone want to read",
  "content": "# Title Here\\n\\n[Full 1500–1900 word markdown article with all 6 rules applied]",
  "metaTitle": "Keyword Phrase ${year} | WealthBeginners",
  "metaDesc": "145–158 char description with keyword and hook — no generic phrasing",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "schemaJson": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"...\\",\\"description\\":\\"...\\",\\"datePublished\\":\\"${new Date().toISOString()}\\",\\"dateModified\\":\\"${new Date().toISOString()}\\",\\"author\\":{\\"@type\\":\\"Organization\\",\\"name\\":\\"WealthBeginners Editorial Team\\",\\"url\\":\\"https://wealthbeginners.com/about\\"},\\"publisher\\":{\\"@type\\":\\"Organization\\",\\"name\\":\\"WealthBeginners.com\\",\\"url\\":\\"https://wealthbeginners.com\\"}}",
  "imagePrompt": "Flat design illustration [specific visual description related to topic], navy blue background #0B1628, gold (#C9A84C) accents, clean financial editorial magazine style, no text, no faces, no logos, 16:9 landscape format, professional quality"
}
\`\`\``
}

async function callBedrock(
  keyword: string,
  category: string,
  isRetry: boolean,
  relatedArticle?: string,
  leadMagnet?: string,
  trendCtx?: {
    trendScore?: number
    relatedTrends?: string[]
    originalQuery?: string
    liveContext?: LiveContext
    qualityIssues?: string[]
    qualityWarnings?: string[]
  },
) {
  const prompt = buildPrompt(keyword, category, isRetry, relatedArticle, leadMagnet, trendCtx)

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 10000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await bedrock.send(command)
  const body     = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text
  return parseBedrockJson(text)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Quality gate (mirrors src/lib/quality-gate.ts)
// ─────────────────────────────────────────────────────────────────────────────

function checkQuality(content: string) {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100

  // ── Word Count (Rule 1) ────────────────────────────────────────────────
  const wordCount = content.trim().split(/\s+/).length

  if (wordCount < 1400) {
    issues.push(`Too short: ${wordCount} words (minimum 1,400)`)
    score -= 30
  } else if (wordCount > 2100) {
    issues.push(`Too long: ${wordCount} words (maximum 2,000 — trim it down)`)
    score -= 20
  } else if (wordCount > 1900) {
    warnings.push(`Word count ${wordCount} is close to the 2,000 cap — consider trimming`)
    score -= 5
  }

  // ── Banned Words (Rule 2) ──────────────────────────────────────────────
  const BANNED_WORDS = [
    'delve', 'tapestry', 'testament', 'crucial', 'furthermore',
    'undeniably', 'navigate', 'beacon', 'embark', 'robust',
    'foster', 'leverage', 'utilize', 'multifaceted', 'holistic',
    'groundbreaking', "it's worth noting", "in today's world",
    'in conclusion', 'to summarize', 'remember that',
  ]
  const foundBanned: string[] = []
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(content)) foundBanned.push(word)
  }
  if (foundBanned.length > 0) {
    warnings.push(`Banned AI words found: ${foundBanned.join(', ')} — regenerate`)
    score -= foundBanned.length * 5
  }

  // ── Generic intro check (Rule 2) ──────────────────────────────────────
  const genericIntros = [
    /^in today'?s (world|financial landscape|economy)/im,
    /^are you (looking|struggling|trying) to/im,
    /^managing (your )?finances (can be|is)/im,
    /^when it comes to/im,
  ]
  for (const pattern of genericIntros) {
    if (pattern.test(content.slice(0, 300))) {
      warnings.push('Generic intro detected — first sentence should be a hook (stat, pain point, or hard truth)')
      score -= 10
      break
    }
  }

  // ── Scannability (Rule 3) ──────────────────────────────────────────────
  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 4) {
    issues.push(`Only ${h2Count} H2 sections (minimum 4 needed)`)
    score -= 15
  }

  const hasBold = /\*\*[^*]{10,}\*\*/.test(content)
  if (!hasBold) {
    warnings.push('No bolded sentences found — bold the key takeaway in each section')
    score -= 5
  }

  const callouts = {
    tip:     (content.match(/💡/g) || []).length,
    warning: (content.match(/⚠️/g) || []).length,
    data:    (content.match(/📊/g) || []).length,
  }
  const totalCallouts = callouts.tip + callouts.warning + callouts.data
  if (totalCallouts < 3) {
    warnings.push(`Only ${totalCallouts} callout boxes (need at least 3: 💡 ⚠️ 📊)`)
    score -= 8
  }

  const hasTable = content.includes('|---|') || content.includes('| --- |')
  if (!hasTable) {
    warnings.push('No comparison table found — add one for scannability and SEO')
    score -= 5
  }

  // ── Internal Link (Rule 4) ─────────────────────────────────────────────
  const hasInternalLink = /\[INTERNAL_LINK:/i.test(content) || /wealthbeginners\.com\//i.test(content)
  if (!hasInternalLink) {
    warnings.push('No internal link placeholder found — add [INTERNAL_LINK: topic] in the middle')
    score -= 8
  }

  // ── E-E-A-T Placeholders (Rule 5) ─────────────────────────────────────
  const anecdoteCount = (content.match(/\[INSERT PERSONAL ANECDOTE/gi) || []).length
  if (anecdoteCount < 3) {
    issues.push(`Only ${anecdoteCount} E-E-A-T placeholders (need exactly 3 — Google requires Experience signals)`)
    score -= 20
  }

  // ── Real Data (supporting Rule 4) ─────────────────────────────────────
  const hasStats = /according to|per the|data from|research (shows|found)|survey (found|shows)|reports that/i.test(content)
  if (!hasStats) {
    warnings.push('No cited statistics found — add at least 3 real data points with source names')
    score -= 10
  }

  // ── No AI Endings (Rule 2) ─────────────────────────────────────────────
  const last500 = content.slice(-500).toLowerCase()
  if (/in conclusion|to summarize|to wrap up|in summary|as we've (seen|discussed)/.test(last500)) {
    warnings.push('Generic AI conclusion detected — remove it, end with the CTA directly')
    score -= 10
  }

  // ── Prohibited Content ─────────────────────────────────────────────────
  const PROHIBITED = [
    /\b(casino|gambling|poker|bet365)\b/i,
    /\b(porn|xxx|adult content|escort)\b/i,
    /\b(cocaine|heroin|meth|fentanyl)\b/i,
    /\b(hack account|crack password|pirate software)\b/i,
  ]
  for (const pattern of PROHIBITED) {
    if (pattern.test(content)) {
      issues.push(`Prohibited content detected: ${pattern.source}`)
      score -= 50
    }
  }

  return {
    passed: issues.length === 0 && score >= 60,
    wordCount,
    score: Math.max(0, score),
    issues,
    warnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function updateTopic(topicId: string, status: string, reason?: string) {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: process.env.TOPICS_TABLE!,
      Key: { id: { S: topicId } },
      UpdateExpression:
        'SET #s = :s, processedAt = :now' + (reason ? ', failReason = :r' : ''),
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s':   { S: status },
        ':now': { S: new Date().toISOString() },
        ...(reason ? { ':r': { S: reason } } : {}),
      },
    }),
  )
}
