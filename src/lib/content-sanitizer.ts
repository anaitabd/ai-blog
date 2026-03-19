/**
 * Strips AI-generated placeholder tokens that sometimes leak into published posts.
 * Apply this before saving to DB AND before rendering content.
 */
export function sanitizePostContent(content: string): string {
  return content
    // Generic bracket placeholders: [INSERT PERSONAL ANECDOTE], [TODO: ...], etc.
    .replace(/\[INSERT[^\]]*\]/gi, '')
    .replace(/\[TODO[^\]]*\]/gi, '')
    .replace(/\[PLACEHOLDER[^\]]*\]/gi, '')
    .replace(/\[ADD[^\]]*\]/gi, '')
    .replace(/\[ANECDOTE[^\]]*\]/gi, '')
    .replace(/\[INCLUDE[^\]]*\]/gi, '')
    .replace(/\[FILL[^\]]*\]/gi, '')
    .replace(/\[REPLACE[^\]]*\]/gi, '')
    .replace(/\[EXAMPLE[^\]]*\]/gi, '')
    .replace(/\[YOUR[^\]]*\]/gi, '')
    // Empty HTML paragraphs left after placeholder removal
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*&nbsp;\s*<\/p>/g, '')
    // Collapse excessive blank lines (markdown)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

