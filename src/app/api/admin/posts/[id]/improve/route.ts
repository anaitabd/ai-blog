import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const REGION = process.env.REGION ?? 'us-east-1'
const _creds = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const bedrock = new BedrockRuntimeClient({ region: REGION, ...(_creds && { credentials: _creds }) })

const INSTRUCTIONS: Record<string, string> = {
  metaTitle:  'Rewrite the meta title to be exactly 50-60 characters. Include the main keyword near the start.',
  metaDesc:   'Rewrite the meta description to be exactly 145-158 characters. Include a clear benefit and the main keyword.',
  wordCount:  'Expand the article content to at least 1,500 words. Add more actionable tips, examples, and explanation.',
  stats:      'Weave in 2-3 real statistics with source attribution (e.g. "According to Experian, ...") naturally into the body.',
  table:      'Add one comparison or summary table using markdown pipe syntax (| Col1 | Col2 |\\n|---|---|\\n| ... |).',
  callouts:   'Add 2-3 inline callout boxes using the format: 💡 **Tip:** ... or 📊 **Did you know:** ... or ⚠️ **Warning:** ...',
  anecdotes:  'Insert exactly 3 E-E-A-T anecdote placeholders at relevant points: [INSERT PERSONAL ANECDOTE: <brief description>]',
  h2count:    'Restructure the content to have at least 4 H2 (##) sections with clear, SEO-friendly headings.',
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content, metaTitle, metaDesc, keyword, failingChecks } = await req.json() as {
    content:      string
    metaTitle:    string
    metaDesc:     string
    keyword:      string
    failingChecks: string[]
  }

  const valid = (failingChecks ?? []).filter((k) => k in INSTRUCTIONS)
  if (valid.length === 0) {
    return NextResponse.json({ error: 'No fixable issues' }, { status: 400 })
  }

  const instructionList = valid
    .map((k, i) => `${i + 1}. ${INSTRUCTIONS[k]}`)
    .join('\n')

  const contentFields  = ['wordCount', 'stats', 'table', 'callouts', 'anecdotes', 'h2count']
  const needsContent   = valid.some((k) => contentFields.includes(k))
  const needsMetaTitle = valid.includes('metaTitle')
  const needsMetaDesc  = valid.includes('metaDesc')

  const returnFields: string[] = []
  if (needsMetaTitle) returnFields.push('"metaTitle": "50-60 char rewritten title"')
  if (needsMetaDesc)  returnFields.push('"metaDesc":  "145-158 char rewritten description"')
  if (needsContent)   returnFields.push('"content":   "full improved markdown article"')

  const prompt = `You are an expert SEO content editor for WealthBeginners, a personal finance blog aimed at beginners.

CURRENT ARTICLE
Keyword / topic : ${keyword}
Meta title      : ${metaTitle}
Meta description: ${metaDesc}

--- CONTENT (Markdown) ---
${content}
--- END CONTENT ---

TASK
Apply ONLY the following targeted improvements. Keep the exact same keyword, writing style, and any content that already passes:

${instructionList}

RULES
- Return ONLY a valid JSON object — no markdown fences, no commentary.
- Include ONLY the fields that changed.
- "content" must be the FULL revised markdown (not a diff).
- "metaTitle" must be exactly 50-60 characters.
- "metaDesc" must be exactly 145-158 characters.
- Never truncate the content; always return the complete article.

RESPONSE FORMAT
{
${returnFields.join(',\n')}
}`

  try {
    const raw = await bedrock.send(
      new InvokeModelCommand({
        modelId:     process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        contentType: 'application/json',
        accept:      'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }],
        }),
      }),
    )

    const text: string = JSON.parse(new TextDecoder().decode(raw.body)).content[0].text
    const result = parseClaudeJson(text) as {
      metaTitle?: string
      metaDesc?:  string
      content?:   string
    }

    return NextResponse.json({ success: true, improved: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[improve] error:', msg)
    return NextResponse.json({ error: 'AI improvement failed', detail: msg }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Robust JSON parser — handles Claude's common failure modes:
//    • Response wrapped in ```json ... ``` fences
//    • Raw newlines / tabs inside string values (LLMs emit these instead of \n)
//  Strategy: try multiple candidate extractions, each with and without repair.
// ─────────────────────────────────────────────────────────────────────────────
function parseClaudeJson(text: string): Record<string, string> {
  const candidates: string[] = []

  // 1. Content inside ```json ... ``` or ``` ... ``` fences (greedy — captures
  //    inner ``` blocks that appear inside a markdown content field correctly)
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*)\n?\s*```/)
  if (fenced) candidates.push(fenced[1].trim())

  // 2. First outermost { … } block
  const brace = text.match(/(\{[\s\S]*\})/)
  if (brace) candidates.push(brace[1].trim())

  // 3. Whole text as-is
  candidates.push(text.trim())

  for (const raw of candidates) {
    if (!raw) continue
    for (const candidate of [raw, repairJsonStrings(raw)]) {
      try { return JSON.parse(candidate) } catch { /* try next */ }
    }
  }

  throw new Error(
    `Could not parse Claude JSON response. Raw (first 300 chars): ${text.slice(0, 300)}`
  )
}

/**
 * Escape unescaped control characters (newline, carriage-return, tab) that
 * appear inside JSON string literals — LLMs frequently emit bare newlines
 * inside string values instead of the required \\n escape sequences.
 */
function repairJsonStrings(text: string): string {
  let inString = false
  let escape   = false
  let out      = ''

  for (const ch of text) {
    if (escape)                      { escape = false; out += ch; continue }
    if (ch === '\\' && inString)     { escape = true;  out += ch; continue }
    if (ch === '"')                  { inString = !inString; out += ch; continue }
    if (inString) {
      if (ch === '\n')               { out += '\\n'; continue }
      if (ch === '\r')               { out += '\\r'; continue }
      if (ch === '\t')               { out += '\\t'; continue }
    }
    out += ch
  }
  return out
}
