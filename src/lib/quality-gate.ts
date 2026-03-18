export interface QualityReport {
  passed: boolean
  wordCount: number
  issues: string[]
}

const PROHIBITED = [
  /\b(casino|gambling|bet365|poker site)\b/i,
  /\b(porn|xxx|escort|onlyfans|adult content)\b/i,
  /\b(cocaine|heroin|meth|fentanyl|buy drugs)\b/i,
  /\b(hate speech|slurs|racism)\b/i,
]

export function runQualityGate(content: string): QualityReport {
  const issues: string[] = []
  const wordCount = content.trim().split(/\s+/).length

  if (wordCount < 1800)
    issues.push(`Word count too low: ${wordCount} (minimum 1800)`)

  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 5)
    issues.push(`Not enough H2 sections: ${h2Count} (minimum 5)`)

  // Require Table of Contents
  if (!/##\s*table of contents/i.test(content))
    issues.push('Missing Table of Contents — add "## Table of Contents" after the intro')

  // Require at least one comparison table
  const tablePattern = /\|.+\|.+\|/
  if (!content.includes('|---|') && !content.includes('| --- |') && !tablePattern.exec(content))
    issues.push('No comparison table found — add at least one markdown table')

  // Require at least 2 callout boxes (💡 📊 ✅ ⚠)
  const calloutPattern = /^> [💡📊✅⚠]/gm
  const callouts = (content.match(calloutPattern) ?? []).length
  if (callouts < 2)
    issues.push(`Not enough callout boxes: ${callouts} (minimum 2)`)

  // Require FAQ section
  if (!/##\s*(frequently asked questions|FAQ)/i.test(content))
    issues.push('Missing FAQ section (add ## Frequently Asked Questions)')

  // Require at least one data citation
  if (!/according to/i.test(content))
    issues.push('No data citations found — add "According to [source]" at least once')

  for (const pattern of PROHIBITED) {
    if (pattern.test(content))
      issues.push(`Prohibited content detected: ${pattern.source}`)
  }

  // Paragraph readability — check avg sentence length
  const sentences = content.split(/[.!?]+/).filter(Boolean)
  const avgLen =
    sentences.reduce((acc, s) => acc + s.split(' ').length, 0) /
    (sentences.length || 1)
  if (avgLen > 40)
    issues.push('Sentences too long — readability score will suffer')

  // Minimum paragraph count — ensures conversational, scannable structure
  const paragraphCount = (content.match(/\n\n/g) || []).length
  if (paragraphCount < 10)
    issues.push(`Too few paragraphs: ${paragraphCount} (minimum 10) — break up the text`)

  return { passed: issues.length === 0, wordCount, issues }
}

export function calcReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 200)
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
    .slice(0, 80)
}
