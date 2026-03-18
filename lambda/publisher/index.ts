import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { log, updateTopicStep } from '../shared/logger'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const s3      = new S3Client({ region: process.env.AWS_REGION })
const dynamo  = new DynamoDBClient({ region: process.env.AWS_REGION })

interface Event {
  topicId: string
  keyword: string
  category: string
  wordCount: number
  readingTime: number
  retryCount?: number
  article: {
    title: string
    slug: string
    excerpt: string
    content: string
    metaTitle: string
    metaDesc: string
    tags: string[]
    schemaJson: string
    imagePrompt: string
    imageAlt?: string
    lsiKeywords?: string[]
  }
}

export const handler = async (event: Event) => {
  const { topicId, category, wordCount, readingTime, article } = event

  log({ lambda: 'publisher', step: 'handler-start', status: 'start', pct: 0,
    meta: { topicId, slug: article.slug } })

  // ── Step 1: Image generation ──────────────────────────────────────────
  let featuredImage: string | undefined
  try {
    await updateTopicStep(topicId, 'Generating featured image…', dynamo, process.env.TOPICS_TABLE!)
    log({ lambda: 'publisher', step: 'image-generation', status: 'start', pct: 10 })

    featuredImage = await generateAndUploadImage(article.imagePrompt, article.slug)

    log({ lambda: 'publisher', step: 'image-generation', status: 'complete', pct: 50,
      meta: { url: featuredImage } })
  } catch (err) {
    log({ lambda: 'publisher', step: 'image-generation', status: 'warn', pct: 50,
      meta: { error: String(err) } })
    console.warn('Image generation failed, continuing without image:', err)
  }

  // ── Step 2: Publish webhook ───────────────────────────────────────────
  await updateTopicStep(topicId, 'Publishing to Next.js…', dynamo, process.env.TOPICS_TABLE!)
  log({ lambda: 'publisher', step: 'publish-webhook', status: 'start', pct: 55 })

  const res = await fetch(`${process.env.NEXTJS_SITE_URL}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.WEBHOOK_SECRET,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      metaTitle: article.metaTitle,
      metaDesc: article.metaDesc,
      categoryName: category,
      tags: article.tags,
      schemaJson: article.schemaJson,
      featuredImage,
      imageAlt: article.imageAlt ?? article.title,
      wordCount,
      readingTime,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()

    if (res.status === 422) {
      let issues: string[] = []
      try { issues = JSON.parse(errText)?.issues ?? [] } catch { /* ignore */ }
      log({ lambda: 'publisher', step: 'publish-webhook', status: 'warn', pct: 55,
        meta: { issues } })
      console.warn('Quality gate rejection from publish API:', issues)
      await updateTopic(topicId, 'PENDING', `Quality gate: ${issues.join('; ')}`)
      return { ...event, retryCount: (event.retryCount ?? 0) + 1, shouldRetry: true }
    }

    log({ lambda: 'publisher', step: 'publish-webhook', status: 'error', pct: 55,
      meta: { status: res.status, body: errText } })
    await updateTopic(topicId, 'FAILED', errText)
    throw new Error(`Webhook failed: ${res.status} — ${errText}`)
  }

  const result = await res.json()
  await updateTopic(topicId, 'DONE')
  await updateTopicStep(topicId, `Published — postId: ${result.postId}`, dynamo, process.env.TOPICS_TABLE!)

  log({ lambda: 'publisher', step: 'done', status: 'complete', pct: 100,
    meta: { postId: result.postId, slug: article.slug } })

  return { success: true, postId: result.postId, slug: article.slug }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Image generation — Amazon Nova Canvas v1
// ─────────────────────────────────────────────────────────────────────────────

function buildImagePrompt(rawPrompt: string): string {
  return (
    `${rawPrompt}. ` +
    'Style: professional editorial flat design illustration, navy blue #0B1628 and gold #C9A84C color palette, ' +
    'clean minimalist composition, high contrast, no text overlays, no human faces, no people, no watermarks'
  )
}

async function generateAndUploadImage(rawPrompt: string, slug: string): Promise<string> {
  const prompt = buildImagePrompt(rawPrompt)

  let body: Record<string, unknown>
  try {
    // Try Nova Canvas first (premium quality)
    const command = new InvokeModelCommand({
      modelId: 'amazon.nova-canvas-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          negativeText: 'blurry, low quality, watermark, text overlay, faces, persons, nsfw, stock photo style',
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: 1024,
          width: 1792,
          cfgScale: 7.5,
          quality: 'premium',
        },
      }),
    })
    const response = await bedrock.send(command)
    body = JSON.parse(new TextDecoder().decode(response.body))
  } catch (novaErr) {
    // Fallback to Titan if Nova Canvas is unavailable in this region
    console.warn('Nova Canvas failed, falling back to Titan Image:', novaErr)
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-image-generator-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          negativeText: 'blurry, low quality, watermark, text overlay, faces, nsfw',
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: 1024,
          width: 1792,
          cfgScale: 8.0,
        },
      }),
    })
    const response = await bedrock.send(command)
    body = JSON.parse(new TextDecoder().decode(response.body))
  }

  const imageBase64: string = (body.images as string[])[0]

  const key = `blog-images/${slug}-${Date.now()}.jpg`
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: Buffer.from(imageBase64, 'base64'),
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
    }),
  )

  return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function updateTopic(topicId: string | undefined, status: string, reason?: string) {
  if (!topicId) return
  await dynamo.send(
    new UpdateItemCommand({
      TableName: process.env.TOPICS_TABLE!,
      Key: { id: { S: topicId } },
      UpdateExpression:
        'SET #s = :s, processedAt = :now' + (reason ? ', failReason = :r' : ''),
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s':   { S: status },
        ':now': { S: new Date().toISOString() },
        ...(reason ? { ':r': { S: reason } } : {}),
      },
    }),
  )
}
