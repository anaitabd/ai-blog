import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const s3 = new S3Client({ region: process.env.AWS_REGION })
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION })

interface Event {
  topicId: string
  keyword: string
  category: string
  wordCount: number
  readingTime: number
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
  }
}

export const handler = async (event: Event) => {
  const { topicId, category, wordCount, readingTime, article } = event

  let featuredImage: string | undefined
  try {
    featuredImage = await generateAndUploadImage(article.imagePrompt, article.slug)
    console.log(`Image uploaded: ${featuredImage}`)
  } catch (err) {
    console.warn('Image generation failed, continuing without image:', err)
  }

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
      wordCount,
      readingTime,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    await updateTopic(topicId, 'FAILED', err)
    throw new Error(`Webhook failed: ${res.status} — ${err}`)
  }

  const result = await res.json()
  await updateTopic(topicId, 'DONE')

  console.log(`Published postId: ${result.postId}`)
  return { success: true, postId: result.postId, slug: article.slug }
}

async function generateAndUploadImage(prompt: string, slug: string): Promise<string> {
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
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const imageBase64: string = body.images[0]

  const key = `blog-images/${slug}-${Date.now()}.jpg`
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: Buffer.from(imageBase64, 'base64'),
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }))

  return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
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
