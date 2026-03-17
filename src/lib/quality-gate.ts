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

  if (wordCount < 1500)
    issues.push(`Word count too low: ${wordCount} (minimum 1500)`)

  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 3)
    issues.push(`Not enough H2 sections: ${h2Count} (minimum 3)`)

  if (!content.includes('## '))
    issues.push('No H2 headings found — poor structure')

  for (const pattern of PROHIBITED) {
    if (pattern.test(content))
      issues.push(`Prohibited content detected: ${pattern.source}`)
  }

  const sentences = content.split(/[.!?]+/).filter(Boolean)
  const avgLen =
    sentences.reduce((acc, s) => acc + s.split(' ').length, 0) /
    (sentences.length || 1)
  if (avgLen > 40)
    issues.push('Sentences too long — readability score will suffer')

  return { passed: issues.length === 0, wordCount, issues }
}

export function calcReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 200)
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}
