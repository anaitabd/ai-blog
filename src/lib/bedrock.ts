import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION!,
})

export interface ArticleInput {
  keyword: string
  category: string
  wordCount?: number
  isRetry?: boolean
}

export interface GeneratedArticle {
  title: string
  slug: string
  excerpt: string
  content: string
  metaTitle: string
  metaDesc: string
  tags: string[]
  schemaJson: string
  imagePrompt: string
}

export async function generateArticle(
  input: ArticleInput
): Promise<GeneratedArticle> {
  const prompt = buildArticlePrompt(input)

  const command = new InvokeModelCommand({
    modelId: process.env.AWS_BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-5',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 8000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await client.send(command)
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
  if (!jsonMatch) throw new Error('Could not parse Bedrock response as JSON')

  return JSON.parse(jsonMatch[1])
}

function buildArticlePrompt(input: ArticleInput): string {
  const retryNote = input.isRetry
    ? '\n\nIMPORTANT: Previous attempt was rejected. Write AT LEAST 2000 words with minimum 5 H2 sections.\n'
    : ''

  return `You are a professional SEO content writer for a monetized blog.
${retryNote}
Write a comprehensive, 100% original article for:
- Target keyword: "${input.keyword}"
- Category: "${input.category}"
- Minimum words: ${input.wordCount ?? 1800}

Requirements:
1. Compelling title with target keyword
2. Hook introduction (first 2 sentences grab attention)
3. Minimum 5 H2 sections with descriptive headings
4. H3 subsections where appropriate
5. Practical tips, examples, and data
6. Natural internal linking placeholders: [INTERNAL_LINK: topic]
7. Strong conclusion with call to action
8. No keyword stuffing — use LSI keywords naturally
9. No prohibited content (adult, gambling, drugs, weapons, hate speech)
10. 100% original content

SEO:
- Keyword in title, first paragraph, 2+ H2s, conclusion
- Meta title: 50-60 chars
- Meta description: 150-160 chars
- Article schema markup

Respond ONLY with this exact JSON format:
\`\`\`json
{
  "title": "Full article title",
  "slug": "url-friendly-slug",
  "excerpt": "150-160 char excerpt",
  "content": "# Title\\n\\nFull markdown content...",
  "metaTitle": "SEO meta title under 60 chars",
  "metaDesc": "Meta description 150-160 chars",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "schemaJson": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"...\\",...}",
  "imagePrompt": "Professional blog featured image about..."
}
\`\`\``
}
