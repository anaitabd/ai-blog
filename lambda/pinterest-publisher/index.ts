// ─────────────────────────────────────────────────────────────────────────────
//  Auto-pins articles to Pinterest when they are published.
//  Supports two action modes called from Step Functions:
//    action = "generate_image" → generate a Nova Canvas Pinterest image
//    action = "publish_pin"    → create the Pinterest pin with a given imageUrl
//  Legacy direct-publish (no action) also supported for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────────

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { getBoardIdForCategory, createPin, buildPinDescription, buildPinTitle } from '../shared/pinterest'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const s3      = new S3Client({ region: process.env.AWS_REGION })
const ssm     = new SSMClient({ region: process.env.AWS_REGION })

// ── SSM-backed credential cache (one cold-start fetch) ────────────────────────
let _boardId: string | undefined
let _accessToken: string | undefined

async function getPinterestCredentials(): Promise<{ boardId: string; accessToken: string }> {
  if (_boardId !== undefined && _accessToken !== undefined) {
    return { boardId: _boardId, accessToken: _accessToken }
  }

  // Board ID — read from SSM, fall back to env var
  try {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: '/wealthbeginners/pinterest/board-id', WithDecryption: false })
    )
    _boardId = Parameter?.Value ?? process.env.PINTEREST_BOARD_ID ?? ''
  } catch {
    _boardId = process.env.PINTEREST_BOARD_ID ?? ''
  }

  // Access token — stored as SecureString in SSM
  try {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: '/wealthbeginners/pinterest/access-token', WithDecryption: true })
    )
    _accessToken = Parameter?.Value ?? process.env.PINTEREST_ACCESS_TOKEN ?? ''
  } catch {
    _accessToken = process.env.PINTEREST_ACCESS_TOKEN ?? ''
  }

  return { boardId: _boardId, accessToken: _accessToken }
}

// ── Pinterest-optimised image prompt (portrait 2:3) ───────────────────────────
const PINTEREST_VISUAL_MAP: Record<string, string> = {
  budgeting:  'organized desk with budget spreadsheet and coffee',
  investing:  'stock market graph on modern monitor, professional office',
  credit:     'credit card on clean white surface, minimal',
  savings:    'glass jar with coins and dollar bills, natural light',
  saving:     'glass jar with coins and dollar bills, natural light',
  retirement: 'peaceful sunset over city skyline, financial freedom',
  taxes:      'tax documents and calculator on clean desk',
  debt:       'scissors cutting credit card, debt freedom concept',
  insurance:  'protective umbrella over house and family silhouette',
}

function buildPinterestImagePrompt(title: string, category: string): string {
  const cat = category.toLowerCase().trim()
  const visualConcept =
    PINTEREST_VISUAL_MAP[cat] ??
    'professional financial planning workspace, modern office'
  return (
    `Professional photorealistic finance photograph of ${visualConcept}, ` +
    'Pinterest portrait format, clean modern aesthetic, high resolution, editorial style, ' +
    `natural lighting, no people, no text overlay, bold colors suitable for Pinterest feed, topic: ${title}`
  )
}

// ── Action type definitions ───────────────────────────────────────────────────
interface GenerateImageEvent {
  action: 'generate_image'
  postId: string
  title: string
  slug: string
  category: string
}

interface PublishPinEvent {
  action: 'publish_pin'
  postId: string
  imageUrl: string
  title: string
  slug: string
}

interface LegacyPublishEvent {
  postId: string
  slug: string
  title: string
  excerpt: string
  keyword: string
  category: string
  tags: string[]
  pinterestImageUrl: string
}

type PinterestEvent = GenerateImageEvent | PublishPinEvent | LegacyPublishEvent

// ── Router ────────────────────────────────────────────────────────────────────
export const handler = async (event: PinterestEvent) => {
  if ('action' in event) {
    if (event.action === 'generate_image') return handleGenerateImage(event as GenerateImageEvent)
    if (event.action === 'publish_pin')   return handlePublishPin(event as PublishPinEvent)
  }
  return handleLegacyPublish(event as LegacyPublishEvent)
}

// ── Step 1: Generate a Pinterest-sized Nova Canvas image ─────────────────────
async function handleGenerateImage(
  event: GenerateImageEvent,
): Promise<{ pinterestImageUrl: string; postId: string; title: string; slug: string }> {
  const { postId, title, slug, category } = event
  console.log(`[pinterest] Generating image for: "${title}"`)

  const prompt = buildPinterestImagePrompt(title, category)

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-canvas-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt,
        negativeText: 'text, watermark, logo, blurry, low quality, cartoon, illustration, people, faces',
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        quality: 'premium',
        width: 1000,
        height: 1500,
        cfgScale: 8.0,
      },
    }),
  })

  const response = await bedrock.send(command)
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const base64: string = body.images?.[0]
  if (!base64) throw new Error('[pinterest] Nova Canvas returned no image')

  const key = `pinterest-images/${slug}-${Date.now()}.jpg`
  await s3.send(
    new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET!,
      Key:         key,
      Body:        Buffer.from(base64, 'base64'),
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
      Metadata:    { source: 'nova-canvas', topic: title, platform: 'pinterest' },
    }),
  )

  const pinterestImageUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
  console.log(`[pinterest] Image uploaded: ${pinterestImageUrl}`)

  return { pinterestImageUrl, postId, title, slug }
}

// ── Step 2: Publish pin with the generated image URL ─────────────────────────
async function handlePublishPin(
  event: PublishPinEvent,
): Promise<{ success: boolean; pinId?: string; pinUrl?: string }> {
  const { postId, imageUrl, title, slug } = event
  console.log(`[pinterest] Publishing pin for: "${title}"`)

  const { boardId, accessToken } = await getPinterestCredentials()
  process.env.PINTEREST_ACCESS_TOKEN = accessToken

  const siteUrl    = (process.env.NEXTJS_SITE_URL ?? 'https://wealthbeginners.com').replace(/\/$/, '')
  const articleUrl = `${siteUrl}/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=autopublish`

  const pin = await createPin({
    title:       buildPinTitle(title),
    description: `${title}\n\n💰 Read the full guide on WealthBeginners.com\n\n#personalfinance #moneytips #wealthbeginners #financialfreedom`,
    link:        articleUrl,
    imageUrl,
    boardId,
    altText:     `${title} — WealthBeginners personal finance guide`,
  })

  console.log(`[pinterest] Pinned successfully: ${pin.url}`)

  try {
    await fetch(`${siteUrl}/api/admin/posts/${postId}/pinterest`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET! },
      body:    JSON.stringify({
        pinterestPinId:    pin.id,
        pinterestPinUrl:   pin.url,
        pinterestImage:    imageUrl,
        pinterestPinnedAt: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.warn('[pinterest] Failed to update post record (non-blocking):', err)
  }

  return { success: true, pinId: pin.id, pinUrl: pin.url }
}

// ── Legacy: direct-publish (used by older code paths) ────────────────────────
async function handleLegacyPublish(
  event: LegacyPublishEvent,
): Promise<{ success: boolean; pinId?: string; pinUrl?: string; error?: string }> {
  const { postId, slug, title, excerpt, keyword, category, tags, pinterestImageUrl } = event
  console.log(`[pinterest] Legacy publish: "${title}"`)

  try {
    const { boardId, accessToken } = await getPinterestCredentials()
    process.env.PINTEREST_ACCESS_TOKEN = accessToken

    const resolvedBoardId = boardId || getBoardIdForCategory(category)
    const siteUrl    = (process.env.NEXTJS_SITE_URL ?? 'https://wealthbeginners.com').replace(/\/$/, '')
    const articleUrl = `${siteUrl}/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=autopublish`

    const pin = await createPin({
      title:       buildPinTitle(title),
      description: buildPinDescription({ title, excerpt, tags, keyword }),
      link:        articleUrl,
      imageUrl:    pinterestImageUrl,
      boardId:     resolvedBoardId,
      altText:     `${title} — WealthBeginners personal finance guide`,
    })

    console.log(`[pinterest] Pinned successfully: ${pin.url}`)

    await fetch(`${siteUrl}/api/admin/posts/${postId}/pinterest`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.WEBHOOK_SECRET! },
      body:    JSON.stringify({
        pinterestPinId:    pin.id,
        pinterestPinUrl:   pin.url,
        pinterestImage:    pinterestImageUrl,
        pinterestPinnedAt: new Date().toISOString(),
      }),
    })

    return { success: true, pinId: pin.id, pinUrl: pin.url }
  } catch (err) {
    console.error('[pinterest] Publish failed (non-blocking):', err)
    return { success: false, error: String(err) }
  }
}

