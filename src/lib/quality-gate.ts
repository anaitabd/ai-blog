// ─────────────────────────────────────────────────────────────────────────────
//  WealthBeginners Quality Gate — Cyborg Blogger Edition
//  Enforces the 6 WealthBeginners writing rules on every article
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from '@prisma/client'

// PASS_THRESHOLD: minimum score to avoid immediate FAILED status (goes to REVIEW)
const PASS_THRESHOLD    = 85
// PUBLISH_THRESHOLD: score required for automatic PUBLISHED status
const PUBLISH_THRESHOLD = 95

export interface QualityIssue {
  severity: 'HARD_FAIL' | 'WARN'
  code:     string
  message:  string
  points:   number
}

export interface QualityResult {
  passed:        boolean
  status:        'PUBLISHED' | 'REVIEW' | 'FAILED'
  score:         number
  seoScore:      number
  wordCount:     number
  h2Count:       number
  sourceCount:   number
  statsCount:    number
  issues:        string[]
  warnings:      string[]
  checkedAt:     string
  attemptNumber: number
}

// Legacy shape — kept for backward compat with publish route + tests
export interface QualityReport {
  passed:    boolean
  wordCount: number
  score:     number
  issues:    string[]
  warnings:  string[]
}

// Banned AI words — immediate score penalty
const BANNED_WORDS = [
  'delve', 'tapestry', 'testament', 'crucial', 'furthermore',
  'undeniably', 'navigate', 'beacon', 'embark', 'robust',
  'foster', 'leverage', 'utilize', 'multifaceted', 'holistic',
  'groundbreaking', "it's worth noting", "in today's world",
  'in conclusion', 'to summarize', 'remember that',
]

// Prohibited content — hard block
const PROHIBITED = [
  /\b(casino|gambling|poker|bet365)\b/i,
  /\b(porn|xxx|adult content|escort)\b/i,
  /\b(cocaine|heroin|meth|fentanyl)\b/i,
  /\b(hack account|crack password|pirate software)\b/i,
]

// ─── NEW CHECK A — Source credibility ────────────────────────────────────────
function checkSourceCredibility(content: string): QualityIssue[] {
  const statsMatches  = content.match(/\d+%|\$[\d,]+|[\d.]+ (?:million|billion)/gi) ?? []
  const sourceMatches = content.match(/according to|reported by|per [A-Z]/gi) ?? []
  const statsCount    = statsMatches.length
  const sourceCount   = sourceMatches.length
  const result: QualityIssue[] = []

  if (statsCount > 0 && sourceCount === 0) {
    result.push({
      severity: 'HARD_FAIL',
      code:     'NO_SOURCES',
      points:   -30,
      message:  'Article contains statistics but cites zero sources',
    })
  } else if (statsCount > 4 && sourceCount < 2) {
    result.push({
      severity: 'HARD_FAIL',
      code:     'UNSOURCED_STATS',
      points:   -20,
      message:  `${statsCount} statistics found but fewer than 2 sources cited`,
    })
  }

  return result
}

// ─── NEW CHECK B — Slug uniqueness ───────────────────────────────────────────
async function checkSlugUnique(slug: string, prisma: PrismaClient): Promise<QualityIssue[]> {
  const existing = await prisma.post.findUnique({ where: { slug } })
  if (existing) {
    return [{
      severity: 'HARD_FAIL',
      code:     'DUPLICATE_SLUG',
      points:   -100,
      message:  `Slug "${slug}" already exists`,
    }]
  }
  return []
}

// ─── NEW CHECK C — Content uniqueness (Jaccard similarity) ───────────────────
async function checkContentUniqueness(title: string, prisma: PrismaClient): Promise<QualityIssue[]> {
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const recentPosts = await prisma.post.findMany({
    where: { publishedAt: { gte: since } },
    select: { title: true },
  })

  const titleWords = new Set(title.toLowerCase().split(/\s+/))

  for (const post of recentPosts) {
    const postWords   = new Set(post.title.toLowerCase().split(/\s+/))
    const intersection = new Set(Array.from(titleWords).filter(w => postWords.has(w)))
    const union        = new Set([...Array.from(titleWords), ...Array.from(postWords)])
    const similarity   = union.size === 0 ? 0 : intersection.size / union.size

    if (similarity > 0.65) {
      return [{
        severity: 'HARD_FAIL',
        code:     'SIMILAR_CONTENT',
        points:   -50,
        message:  `Too similar to existing post: "${post.title}"`,
      }]
    }
  }

  return []
}

// ─── NEW CHECK D — SEO score ─────────────────────────────────────────────────
function checkSEOScore(content: string, title: string, slug: string): number {
  let seo = 0
  if (title.length >= 40 && title.length <= 65)  seo += 25
  if (slug.length <= 60)                          seo += 15
  if ((content.match(/^## /gm) ?? []).length >= 5) seo += 20
  const internalLinks = (content.match(/\[.+?\]\(\/.+?\)/g) ?? []).length +
                        (content.match(/wealthbeginners\.com\//gi) ?? []).length
  if (internalLinks >= 3)                         seo += 20
  if (content.length >= 7000)                     seo += 20
  return seo
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main quality gate — async for DB checks
// ─────────────────────────────────────────────────────────────────────────────
export async function runQualityGate(
  content: string,
  opts?: {
    slug?:          string
    title?:         string
    prisma?:        PrismaClient
    attemptNumber?: number
  },
): Promise<QualityResult> {
  const issues: string[]   = []
  const warnings: string[] = []
  let score = 100

  const slug          = opts?.slug          ?? ''
  const title         = opts?.title         ?? ''
  const prismaClient  = opts?.prisma
  const attemptNumber = opts?.attemptNumber ?? 1

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
  if (anecdoteCount === 0) {
    issues.push(`Only ${anecdoteCount} E-E-A-T placeholders (need exactly 3 — Google requires Experience signals)`)
    score -= 20
  } else if (anecdoteCount < 3) {
    warnings.push(`Only ${anecdoteCount} E-E-A-T placeholder(s) — auto-repair injected the rest`)
    score -= 5
  }

  // ── Real Data (Rule 4 support) ─────────────────────────────────────────
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
  for (const pattern of PROHIBITED) {
    if (pattern.test(content)) {
      issues.push(`Prohibited content detected: ${pattern.source}`)
      score -= 50
    }
  }

  // ── NEW CHECK A — Source credibility ──────────────────────────────────
  const statsMatches  = content.match(/\d+%|\$[\d,]+|[\d.]+ (?:million|billion)/gi) ?? []
  const sourceMatches = content.match(/according to|reported by|per [A-Z]/gi) ?? []
  const statsCount    = statsMatches.length
  const sourceCount   = sourceMatches.length

  const credibilityIssues = checkSourceCredibility(content)
  for (const ci of credibilityIssues) {
    issues.push(ci.message)
    score += ci.points // points are negative
  }

  // ── NEW CHECK D — SEO score ────────────────────────────────────────────
  const seoScore = checkSEOScore(content, title, slug)

  // ── NEW CHECK B & C — async DB checks (only when prisma provided) ──────
  if (prismaClient) {
    if (slug) {
      const slugIssues = await checkSlugUnique(slug, prismaClient)
      for (const si of slugIssues) {
        issues.push(si.message)
        score += si.points
      }
    }
    if (title) {
      const uniqueIssues = await checkContentUniqueness(title, prismaClient)
      for (const ui of uniqueIssues) {
        issues.push(ui.message)
        score += ui.points
      }
    }
  }

  const finalScore = Math.max(0, score)

  const status: 'PUBLISHED' | 'REVIEW' | 'FAILED' =
    finalScore >= PUBLISH_THRESHOLD ? 'PUBLISHED' :
    finalScore >= PASS_THRESHOLD    ? 'REVIEW'    :
    'FAILED'

  return {
    passed:        issues.length === 0 && finalScore >= PASS_THRESHOLD,
    status,
    score:         finalScore,
    seoScore,
    wordCount,
    h2Count,
    sourceCount,
    statsCount,
    issues,
    warnings,
    checkedAt:     new Date().toISOString(),
    attemptNumber,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Synchronous wrapper — backward compat for publish route + tests
//  (skips async DB checks — use runQualityGate() directly for full validation)
// ─────────────────────────────────────────────────────────────────────────────
export function runQualityGateSync(content: string): QualityReport {
  const issues: string[]   = []
  const warnings: string[] = []
  let score = 100

  const wordCount = content.trim().split(/\s+/).length
  if (wordCount < 1400) { issues.push(`Too short: ${wordCount} words (minimum 1,400)`);          score -= 30 }
  else if (wordCount > 2100) { issues.push(`Too long: ${wordCount} words (maximum 2,000 — trim it down)`); score -= 20 }
  else if (wordCount > 1900) { warnings.push(`Word count ${wordCount} is close to the 2,000 cap — consider trimming`); score -= 5 }

  const foundBanned: string[] = []
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(content)) foundBanned.push(word)
  }
  if (foundBanned.length > 0) { warnings.push(`Banned AI words found: ${foundBanned.join(', ')} — regenerate`); score -= foundBanned.length * 5 }

  const genericIntros = [/^in today'?s (world|financial landscape|economy)/im,/^are you (looking|struggling|trying) to/im,/^managing (your )?finances (can be|is)/im,/^when it comes to/im]
  for (const p of genericIntros) { if (p.test(content.slice(0, 300))) { warnings.push('Generic intro detected — first sentence should be a hook (stat, pain point, or hard truth)'); score -= 10; break } }

  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 4) { issues.push(`Only ${h2Count} H2 sections (minimum 4 needed)`); score -= 15 }
  if (!/\*\*[^*]{10,}\*\*/.test(content)) { warnings.push('No bolded sentences found — bold the key takeaway in each section'); score -= 5 }

  const totalCallouts = (content.match(/💡/g)||[]).length + (content.match(/⚠️/g)||[]).length + (content.match(/📊/g)||[]).length
  if (totalCallouts < 3) { warnings.push(`Only ${totalCallouts} callout boxes (need at least 3: 💡 ⚠️ 📊)`); score -= 8 }
  if (!content.includes('|---|') && !content.includes('| --- |')) { warnings.push('No comparison table found — add one for scannability and SEO'); score -= 5 }
  if (!/\[INTERNAL_LINK:/i.test(content) && !/wealthbeginners\.com\//i.test(content)) { warnings.push('No internal link placeholder found — add [INTERNAL_LINK: topic] in the middle'); score -= 8 }

  const anecdoteCount = (content.match(/\[INSERT PERSONAL ANECDOTE/gi) || []).length
  if (anecdoteCount === 0) { issues.push(`Only ${anecdoteCount} E-E-A-T placeholders (need exactly 3 — Google requires Experience signals)`); score -= 20 }
  else if (anecdoteCount < 3) { warnings.push(`Only ${anecdoteCount} E-E-A-T placeholder(s) — auto-repair injected the rest`); score -= 5 }

  if (!/according to|per the|data from|research (shows|found)|survey (found|shows)|reports that/i.test(content)) { warnings.push('No cited statistics found — add at least 3 real data points with source names'); score -= 10 }
  if (/in conclusion|to summarize|to wrap up|in summary|as we've (seen|discussed)/.test(content.slice(-500).toLowerCase())) { warnings.push('Generic AI conclusion detected — remove it, end with the CTA directly'); score -= 10 }

  for (const pattern of PROHIBITED) {
    if (pattern.test(content)) { issues.push(`Prohibited content detected: ${pattern.source}`); score -= 50 }
  }

  return { passed: issues.length === 0 && score >= 60, wordCount, score: Math.max(0, score), issues, warnings }
}

export function calcReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 215)
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 75)
    .replace(/^-|-$/g, '')
}

