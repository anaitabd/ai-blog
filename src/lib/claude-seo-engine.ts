import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface SEOAnalysis {
  optimizedTitle:           string
  titleScore:               number
  metaDescription:          string   // 150-155 chars
  primaryKeyword:           string
  secondaryKeywords:        string[]
  longTailKeywords:         string[]
  contentScore:             number
  readabilityScore:         number
  contentSuggestions:       string[]
  schemaMarkup:             object   // Article JSON-LD
  faqSchema:                object   // FAQ JSON-LD
  featuredSnippetParagraph: string
  internalLinkSuggestions:  string[]
  ogTitle:                  string
  ogDescription:            string
  twitterTitle:             string
  recommendedSlug:          string
}

export async function analyzeSEO(
  title: string,
  content: string,
  category: string
): Promise<SEOAnalysis> {
  const currentYear = new Date().getFullYear()

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are a senior SEO strategist specializing in personal finance content.

Analyze this blog post and return a complete SEO optimization plan.
Return ONLY valid JSON — no explanation, no markdown, no code blocks.

TITLE: ${title}
CATEGORY: ${category}
CONTENT SAMPLE: ${content.substring(0, 2000)}
SITE: wealthbeginners.com
AUDIENCE: US beginners learning personal finance
CURRENT YEAR: ${currentYear}

Return this exact JSON structure:
{
  "optimizedTitle": "Primary Keyword: Compelling Title ${currentYear} (under 60 chars)",
  "titleScore": 8,
  "metaDescription": "Exactly 150-155 character meta description with primary keyword early and a clear call to action at the end.",
  "primaryKeyword": "main keyword people Google",
  "secondaryKeywords": ["keyword2", "keyword3", "keyword4"],
  "longTailKeywords": [
    "how to [topic] for beginners ${currentYear}",
    "best way to [topic] with no experience",
    "[topic] step by step guide"
  ],
  "contentScore": 8,
  "readabilityScore": 9,
  "contentSuggestions": [
    "Add a comparison table showing X vs Y",
    "Include specific dollar amounts as examples"
  ],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "description": "meta description here",
    "author": { "@type": "Organization", "name": "WealthBeginners", "url": "https://www.wealthbeginners.com" },
    "publisher": { "@type": "Organization", "name": "WealthBeginners", "url": "https://www.wealthbeginners.com" },
    "datePublished": "${new Date().toISOString().split('T')[0]}",
    "articleSection": "${category}",
    "inLanguage": "en-US"
  },
  "faqSchema": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Most commonly Googled question?", "acceptedAnswer": { "@type": "Answer", "text": "Concise answer." } },
      { "@type": "Question", "name": "Second common question?",         "acceptedAnswer": { "@type": "Answer", "text": "Concise answer." } },
      { "@type": "Question", "name": "Third common question?",          "acceptedAnswer": { "@type": "Answer", "text": "Concise answer." } }
    ]
  },
  "featuredSnippetParagraph": "A 40-60 word direct answer to the main question. Starts with the answer immediately.",
  "internalLinkSuggestions": ["budgeting for beginners", "emergency fund guide", "investing basics"],
  "ogTitle": "Social-optimized title under 60 chars",
  "ogDescription": "Facebook/LinkedIn description under 160 chars",
  "twitterTitle": "Twitter hook title — punchy, creates curiosity",
  "recommendedSlug": "primary-keyword-guide-${currentYear}"
}`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}'
  const clean = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(clean) as SEOAnalysis
}

// Enhance post content with SEO improvements (add featured snippet, internal links, keywords)
export async function enhancePostContent(
  title: string,
  content: string,
  seoAnalysis: SEOAnalysis
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `You are a personal finance content editor optimizing for Google rankings.

Enhance this blog post for SEO without changing the core meaning or advice.

PRIMARY KEYWORD: ${seoAnalysis.primaryKeyword}
SECONDARY KEYWORDS: ${seoAnalysis.secondaryKeywords.join(', ')}
FEATURED SNIPPET TO ADD: "${seoAnalysis.featuredSnippetParagraph}"
INTERNAL LINK TOPICS: ${seoAnalysis.internalLinkSuggestions.join(', ')}

RULES:
- Add the featured snippet paragraph right after the introduction (first 2-3 paragraphs)
- Naturally include secondary keywords where they fit (don't force them)
- For internal link topics, add: <a href="/search?q=TOPIC" class="internal-link">anchor text</a>
- Make sure primary keyword appears in the first 100 words
- Do NOT change any facts, numbers, or advice
- Do NOT add more than 250 words total to the post
- Keep all existing HTML/markdown structure intact
- Remove any [INSERT...] or [TODO...] placeholder text you find
- Return ONLY the enhanced content — nothing else

ORIGINAL CONTENT:
${content}`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : content
}

// Generate 14-topic content calendar
export async function generateContentCalendar(existingTopics: string[]): Promise<
  Array<{
    title: string
    primaryKeyword: string
    searchVolume: 'high' | 'medium' | 'low'
    category: string
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedTraffic: string
    publishDate: string
    hook: string
  }>
> {
  const currentYear = new Date().getFullYear()

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are an SEO content strategist for WealthBeginners.com.
Site: personal finance blog for US beginners.

Generate 14 unique blog topics for the next 14 days (2 per day).
DO NOT repeat these existing topics: ${existingTopics.slice(0, 20).join(', ')}

REQUIREMENTS:
- High actual Google search volume
- Beginner-friendly angle
- Include ${currentYear} where relevant
- Mix: how-to, listicles, comparisons, guides

DISTRIBUTE:
Investing: 3 | Budgeting: 2 | Credit: 2 | Debt: 2 | Saving: 2 | Income: 2 | Retirement: 1

Return ONLY a valid JSON array:
[{
  "title": "How to Start Investing With $100 in ${currentYear}",
  "primaryKeyword": "investing with 100 dollars",
  "searchVolume": "high",
  "category": "investing",
  "difficulty": "easy",
  "estimatedTraffic": "1000-3000/month",
  "publishDate": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}",
  "hook": "Most people think investing requires thousands of dollars. It doesn't."
}]`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '[]'
  const clean = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(clean)
}

