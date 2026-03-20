import { describe, it, expect } from 'vitest'
import { sanitizePostContent } from '@/lib/content-sanitizer'

describe('sanitizePostContent', () => {
  it('removes [INSERT ...] placeholders', () => {
    const input = 'Here is some text [INSERT PERSONAL ANECDOTE] and more text.'
    expect(sanitizePostContent(input)).toBe('Here is some text  and more text.')
  })

  it('removes [TODO ...] placeholders', () => {
    expect(sanitizePostContent('Intro [TODO: add stats here] done.')).toBe('Intro  done.')
  })

  it('removes [PLACEHOLDER] tokens', () => {
    expect(sanitizePostContent('[PLACEHOLDER TEXT]')).toBe('')
  })

  it('removes [YOUR ...] tokens', () => {
    expect(sanitizePostContent('Call [YOUR NAME] today.')).toBe('Call  today.')
  })

  it('removes empty HTML paragraphs', () => {
    expect(sanitizePostContent('<p>Hello</p><p></p><p>World</p>')).toBe('<p>Hello</p><p>World</p>')
  })

  it('removes &nbsp; paragraphs', () => {
    expect(sanitizePostContent('<p>&nbsp;</p>')).toBe('')
  })

  it('collapses triple blank lines to double', () => {
    expect(sanitizePostContent('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizePostContent('  hello world  ')).toBe('hello world')
  })

  it('handles content with no placeholders unchanged', () => {
    const clean = 'This is a normal sentence about saving money.'
    expect(sanitizePostContent(clean)).toBe(clean)
  })

  it('handles empty string input', () => {
    expect(sanitizePostContent('')).toBe('')
  })
})
