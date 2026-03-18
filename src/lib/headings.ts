export interface Heading {
  text: string
  id: string
  level: 2 | 3
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const regex = /^(#{2,3})\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length as 2 | 3
    const text  = match[2].trim()
    headings.push({ text, id: slugifyHeading(text), level })
  }
  return headings
}
