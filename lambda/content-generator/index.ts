import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })

interface Event {
  topicId: string
  keyword: string
  category: string
  retryCount?: number
}

export const handler = async (event: Event) => {
  const { topicId, keyword, category, retryCount = 0 } = event
  console.log(`Generating article for: "${keyword}" (attempt ${retryCount + 1})`)

  try {
    const article = await callBedrock(keyword, category, retryCount > 0)
    const quality = checkQuality(article.content)

    if (!quality.passed) {
      console.warn('Quality gate failed:', quality.issues)
      if (retryCount < 2) {
        return { ...event, retryCount: retryCount + 1, shouldRetry: true }
      }
      await updateTopic(topicId, 'FAILED', quality.issues.join('; '))
      throw new Error(`Quality gate failed after ${retryCount + 1} attempts`)
    }

    return { topicId, keyword, category, article, wordCount: quality.wordCount, readingTime: Math.ceil(quality.wordCount / 200), shouldRetry: false }
  } catch (err) {
    await updateTopic(topicId, 'FAILED', String(err))
    throw err
  }
}

async function callBedrock(keyword: string, category: string, isRetry: boolean) {
  const retryNote = isRetry ? '\n\nIMPORTANT: Previous attempt failed quality checks. Write AT LEAST 2000 words with minimum 5 H2 sections.\n' : ''

  const prompt = `You are a professional SEO content writer for a monetized blog.
${retryNote}
Write a comprehensive, 100% original article:
- Target keyword: "${keyword}"
- Category: "${category}"
- Minimum words: 1800

Requirements:
1. Compelling H1 title with keyword
2. Hook introduction grabbing attention in first 2 sentences
3. Minimum 5 H2 sections
4. H3 subsections where helpful
5. Practical tips, examples, real data
6. Strong conclusion with call to action
7. No prohibited content (adult, gambling, drugs, hate speech)
8. Natural keyword usage, no stuffing

SEO: keyword in title, first paragraph, 2+ H2s, and conclusion.

Respond ONLY with this JSON:
\`\`\`json
{
  "title": "Full article title",
  "slug": "url-friendly-slug",
  "excerpt": "150-160 char excerpt",
  "content": "# Title\\n\\nFull markdown...",
  "metaTitle": "SEO meta title under 60 chars",
  "metaDesc": "Meta description 150-160 chars",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "schemaJson": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"...\\",...}",
  "imagePrompt": "Professional blog featured image about..."
}
\`\`\``

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 8000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await bedrock.send(command)
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text
  const match = text.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Invalid JSON response from Bedrock')
  return JSON.parse(match[1])
}

function checkQuality(content: string) {
  const issues: string[] = []
  const wordCount = content.trim().split(/\s+/).length
  if (wordCount < 1500) issues.push(`Word count too low: ${wordCount}`)
  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count < 3) issues.push(`Not enough H2s: ${h2Count}`)
  const prohibited = [/\b(casino|gambling)\b/i, /\b(porn|xxx)\b/i, /\b(cocaine|heroin)\b/i]
  for (const p of prohibited) if (p.test(content)) issues.push(`Prohibited: ${p.source}`)
  return { passed: issues.length === 0, wordCount, issues }
}

async function updateTopic(topicId: string, status: string, reason?: string) {
  await dynamo.send(new UpdateItemCommand({
    TableName: process.env.TOPICS_TABLE!,
    Key: { id: { S: topicId } },
    UpdateExpression: 'SET #s = :s, processedAt = :now' + (reason ? ', failReason = :r' : ''),
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':s': { S: status },
      ':now': { S: new Date().toISOString() },
      ...(reason ? { ':r': { S: reason } } : {}),
    },
  }))
}
