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
}

export const handler = async (event: Event) => {
  const { topicId, keyword, category, retryCount = 0 } = event
  const attempt = retryCount + 1

  log({ lambda: 'content-generator', step: 'handler-start', status: 'start', pct: 0,
    meta: { topicId, keyword, category, attempt } })

  try {
    // ── Step 1: Bedrock call ──────────────────────────────────────────────
    await updateTopicStep(topicId, `Generating content · attempt ${attempt}/3`, dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'content-generator', step: 'bedrock-call', status: 'start', pct: 10,
      meta: { keyword, attempt } })

    const article = await callBedrock(keyword, category, retryCount > 0)

    log({ lambda: 'content-generator', step: 'bedrock-call', status: 'complete', pct: 70,
      meta: { titleLength: article.title?.length, contentWords: article.content?.trim().split(/\s+/).length } })

    // ── Step 2: Quality gate ─────────────────────────────────────────────
    await updateTopicStep(topicId, `Quality check · attempt ${attempt}/3`, dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'content-generator', step: 'quality-gate', status: 'start', pct: 75 })

    const quality = checkQuality(article.content)

    if (!quality.passed) {
      log({ lambda: 'content-generator', step: 'quality-gate', status: 'warn', pct: 75,
        meta: { issues: quality.issues, attempt } })

      if (retryCount < 2) {
        await updateTopicStep(topicId, `Quality retry · attempt ${attempt}/3 failed`, dynamo, process.env.TOPICS_TABLE!)
        return { ...event, retryCount: retryCount + 1, shouldRetry: true }
      }
      await updateTopic(topicId, 'FAILED', quality.issues.join('; '))
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

function parseBedrockJson(text: string): Record<string, unknown> {
  // 1. Standard ```json ... ``` block (newline variants)
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }

  // 2. First { ... } block in the response
  const brace = text.match(/(\{[\s\S]*\})/)
  if (brace) {
    try { return JSON.parse(brace[1].trim()) } catch { /* fall through */ }
  }

  // 3. Whole text (model may have returned raw JSON)
  try { return JSON.parse(text.trim()) } catch { /* fall through */ }

  throw new Error(`Invalid JSON response from Bedrock — could not parse model output.\nRaw (first 300 chars): ${text.slice(0, 300)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

async function callBedrock(keyword: string, category: string, isRetry: boolean) {
  const retryNote = isRetry
    ? '\n\n⚠️ RETRY NOTICE: The previous attempt was REJECTED. You MUST include ALL of:\n' +
      '- A "## Table of Contents" section with anchor links right after the intro\n' +
      '- A markdown table with |---| separator row\n' +
      '- At least 2 callout boxes starting with "> 💡" or "> 📊" or "> ✅" or "> ⚠️"\n' +
      '- "## Frequently Asked Questions" with at least 4 Q&A pairs\n' +
      '- "According to [source]" used at least 3 times\n'
    : ''

  const prompt = `You are a friendly, expert personal-finance writer for WealthBeginners.com.
Your readers are 25–35 year olds who are complete beginners. Write like a smart, encouraging friend explaining this over coffee — conversational, warm, direct, and occasionally light-humored. Use short paragraphs (2–3 sentences max), "you/your", and active voice.
${retryNote}
TARGET KEYWORD: "${keyword}"
CATEGORY: "${category}"
MINIMUM LENGTH: 2200 words

══════════════════════════════════════════════
MANDATORY STRUCTURE — article WILL be rejected if any element is missing
══════════════════════════════════════════════

1. TITLE (H1) — must include the keyword, a power word, and either a number or the current year (2026)
   Examples: "7 Proven Ways to…", "The Complete 2026 Beginner's Guide to…"

2. INTRO (2 paragraphs max)
   - Para 1: Bold hook — a surprising stat OR a relatable "have you ever…" question
   - Para 2: Brief empathy + clear promise of what the reader will learn

3. TABLE OF CONTENTS — immediately after the intro, no exceptions:
   ## Table of Contents
   - [Section Title One](#section-title-one)
   - [Section Title Two](#section-title-two)
   ... (one entry per H2; anchor = lowercase title with spaces → hyphens)

4. MINIMUM 6 H2 SECTIONS (##) — use engaging titles, NOT generic ones.
   Required topics to cover (adapt wording):
   - What it is / Why it matters for beginners
   - Step-by-step how to get started
   - Common mistakes to avoid
   - Best tools or options compared
   - Expert tips & insider tricks
   - Conclusion + next steps

5. COMPARISON TABLE — mandatory, must use this exact format:
   | Option | Pros | Cons | Best For |
   |--------|------|------|----------|
   | …      | …    | …    | …        |

6. CALLOUT BOXES — at least 2, emoji is the first character after "> ":
   > 💡 **Pro Tip:** [actionable tip]
   > 📊 **By the Numbers:** [statistic with source]
   > ✅ **Key Takeaway:** [summary point]
   > ⚠️ **Warning:** [pitfall to avoid]

7. DATA CITATIONS — use "According to [source]," at least 3 times
   (sources: Federal Reserve, FDIC, Bankrate, NerdWallet, Vanguard, Fidelity, Bureau of Labor Statistics, CNBC, Investopedia)

8. FAQ SECTION — minimum 4 Q&A pairs:
   ## Frequently Asked Questions
   ### Q: [specific beginner question]?
   [2–3 sentence plain-English answer]

9. CONCLUSION H2 — friendly recap + 1–2 action steps the reader can take today

══════════════════════════════════════════════
SEO RULES
══════════════════════════════════════════════
- Include the exact keyword in: title, first sentence of intro, at least 2 H2 headings, conclusion
- Include 5 LSI (semantically related) keywords naturally through the article — list them in the JSON output
- Keep sentences varied: some short (under 12 words) for punch, some longer for explanation
- No keyword stuffing; no "In conclusion" or "In summary" phrases

══════════════════════════════════════════════
QUALITY SELF-CHECK before outputting
══════════════════════════════════════════════
[ ] Word count ≥ 2200
[ ] "## Table of Contents" present right after intro
[ ] H2 count ≥ 6
[ ] Table with |---| row present
[ ] ≥ 2 callout boxes ("> 💡/📊/✅/⚠️")
[ ] ≥ 3 "According to [source]" citations
[ ] "## Frequently Asked Questions" with ≥ 4 entries
[ ] Paragraphs are short (2–3 sentences), readable

No prohibited content: no gambling, adult, drugs, hate speech.

Respond ONLY with this exact JSON block (no text before or after):
\`\`\`json
{
  "title": "Engaging title with keyword, power word, and number or year",
  "slug": "url-friendly-slug-max-80-chars",
  "excerpt": "Compelling 150-160 character excerpt that makes readers click",
  "content": "# Full Title\\n\\n[complete markdown — intro, ToC, all H2 sections, table, callouts, FAQ, conclusion]",
  "metaTitle": "SEO meta title under 60 chars with keyword",
  "metaDesc": "150-160 char meta description, includes keyword, ends with a benefit",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "schemaJson": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"title\\",\\"description\\":\\"excerpt\\",\\"author\\":{\\"@type\\":\\"Organization\\",\\"name\\":\\"WealthBeginners\\"},\\"publisher\\":{\\"@type\\":\\"Organization\\",\\"name\\":\\"WealthBeginners\\",\\"logo\\":{\\"@type\\":\\"ImageObject\\",\\"url\\":\\"https://wealthbeginners.com/logo.png\\"}}}",
  "imagePrompt": "Professional editorial illustration for a personal finance blog: [describe visual concept without people or faces]. Flat design style.",
  "imageAlt": "SEO alt text describing the image content, under 125 chars, includes keyword",
  "lsiKeywords": ["semantic variant 1","semantic variant 2","semantic variant 3","semantic variant 4","semantic variant 5"]
}
\`\`\``

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
  const wordCount = content.trim().split(/\s+/).length

  if (wordCount < 1800)
    issues.push(`Word count too low: ${wordCount} (minimum 1800)`)

  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 5)
    issues.push(`Not enough H2 sections: ${h2Count} (minimum 5)`)

  if (!content.includes('|---|') && !content.includes('| --- |') && !/\|.+\|.+\|/.test(content))
    issues.push('No comparison table found')

  const calloutPattern = /^> [\u{1F4A1}\u{1F4CA}\u{2705}\u{26A0}]/gmu
  const callouts = (content.match(calloutPattern) ?? []).length
  if (callouts < 2)
    issues.push(`Not enough callout boxes: ${callouts} (minimum 2)`)

  if (!/##\s*(frequently asked questions|FAQ)/i.test(content))
    issues.push('Missing FAQ section (add ## Frequently Asked Questions)')

  if (!/according to/i.test(content))
    issues.push('No data citations found (add "According to [source]")')

  if (!/##\s*table of contents/i.test(content))
    issues.push('Missing Table of Contents (add "## Table of Contents" after intro)')

  const prohibited = [/\b(casino|gambling)\b/i, /\b(porn|xxx)\b/i, /\b(cocaine|heroin)\b/i]
  for (const p of prohibited)
    if (p.test(content)) issues.push(`Prohibited content: ${p.source}`)

  return { passed: issues.length === 0, wordCount, issues }
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
