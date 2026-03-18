// ─────────────────────────────────────────────────────────────────────────────
//  WealthBeginners Quality Gate — Cyborg Blogger Edition
//  Enforces the 6 WealthBeginners writing rules on every article
// ─────────────────────────────────────────────────────────────────────────────

export interface QualityReport {
  passed: boolean
  wordCount: number
  score: number
  issues: string[]
  warnings: string[]
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

export function runQualityGate(content: string): QualityReport {
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

export function calcReadingTime(wordCount: number): number {
  // Average adult reads 200–220 words per minute
  // WealthBeginners target: 7-minute reads = 1,400–1,540 words
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

