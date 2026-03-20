import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition'
import { normalizeCategory } from './category-utils'

// ── Resolve env var names (Amplify strips AWS_ prefix at runtime) ─────────────
function getAwsCredentials() {
  const accessKeyId     = process.env.APP_KEY_ID     || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.APP_KEY_SECRET || process.env.AWS_SECRET_ACCESS_KEY
  if (accessKeyId && secretAccessKey) return { accessKeyId, secretAccessKey }
  return undefined // fall back to IAM role / instance profile
}

function getS3Bucket(): string {
  return (process.env.S3_BUCKET || process.env.AWS_S3_BUCKET)!
}

function makeS3Client() {
  const creds = getAwsCredentials()
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(creds ? { credentials: creds } : {}),
  })
}

function makeBedrockClient() {
  const creds = getAwsCredentials()
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(creds ? { credentials: creds } : {}),
  })
}

function makeRekognitionClient() {
  const creds = getAwsCredentials()
  return new RekognitionClient({
    region: process.env.AWS_REKOGNITION_REGION || process.env.AWS_REGION || 'us-east-1',
    ...(creds ? { credentials: creds } : {}),
  })
}

// ── Topic → Pexels search query map ──────────────────────────────────────────
const FINANCE_TOPIC_MAP: Record<string, string> = {
  'credit score':   'credit card financial planning desk',
  'credit':         'credit card wallet financial planning',
  'investing':      'stock market charts financial growth',
  'budgeting':      'budget planning money notebook calculator',
  'debt':           'financial freedom debt payoff concept',
  'saving':         'savings jar coins money growth',
  'retirement':     'retirement planning future financial security',
  'income':         'passive income laptop home office',
  'real estate':    'real estate house keys property',
  'real-estate':    'real estate house keys property',
  'emergency fund': 'safety net savings piggy bank',
  '401k':           'retirement fund investment growth',
  '401-k':          'retirement fund investment growth',
  'roth ira':       'investment account retirement planning',
  'roth-ira':       'investment account retirement planning',
}

function buildSearchQuery(title: string): string {
  const lower = title.toLowerCase()
  for (const [keyword, query] of Object.entries(FINANCE_TOPIC_MAP)) {
    if (lower.includes(keyword)) return query
  }
  const words = title.split(' ').slice(0, 3).join(' ')
  return `${words} personal finance money`
}

// ── Nova Canvas visual concept map ───────────────────────────────────────────
const NOVA_CANVAS_TOPIC_MAP: Record<string, string> = {
  budgeting:   'organized desk with budget spreadsheet and coffee',
  investing:   'stock market graph on modern monitor, professional office',
  credit:      'credit card on clean white surface, minimal',
  savings:     'glass jar with coins and dollar bills, natural light',
  saving:      'glass jar with coins and dollar bills, natural light',
  retirement:  'peaceful sunset over city skyline, financial freedom',
  taxes:       'tax documents and calculator on clean desk',
  debt:        'scissors cutting credit card, debt freedom concept',
  insurance:   'protective umbrella over house and family silhouette',
}

export function buildNovaCanvasPrompt(title: string, category: string): string {
  const cat = normalizeCategory(category)
  const titleWords = title.toLowerCase().split(' ')
  const visualConcept =
    NOVA_CANVAS_TOPIC_MAP[cat] ??
    titleWords.map(w => NOVA_CANVAS_TOPIC_MAP[w]).find(Boolean) ??
    'professional financial planning workspace, modern office'
  return (
    `Professional photorealistic finance photograph of ${visualConcept}, ` +
    'clean modern aesthetic, high resolution, editorial style, ' +
    `natural lighting, no people, suitable for financial blog, inspired by topic: ${title}`
  )
}

// Finance-related Rekognition label names for relevance check
const FINANCE_LABELS = [
  'Finance', 'Money', 'Currency', 'Business', 'Economy',
  'Chart', 'Graph', 'Stock', 'Budget', 'Calculator',
  'Desk', 'Office', 'Computer', 'Document', 'Investment',
]

// ── PRIMARY: Amazon Nova Canvas ───────────────────────────────────────────────
export async function generateNovaCanvasImage(title: string, category: string): Promise<string | null> {
  try {
    const client = makeBedrockClient()
    const prompt = buildNovaCanvasPrompt(title, category)

    const command = new InvokeModelCommand({
      modelId: process.env.NOVA_CANVAS_MODEL_ID ?? 'amazon.nova-canvas-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          negativeText: 'text, watermark, logo, blurry, low quality, cartoon, illustration',
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          quality: 'premium',
          width: 1280,
          height: 720,
          cfgScale: 8.0,
        },
      }),
    })

    const response = await client.send(command)
    const body = JSON.parse(new TextDecoder().decode(response.body))
    const base64: string = body.images?.[0]
    if (!base64) return null

    // ── Rekognition validation ────────────────────────────────────────────────
    try {
      const rek = makeRekognitionClient()
      const { Labels = [] } = await rek.send(
        new DetectLabelsCommand({
          Image: { Bytes: Buffer.from(base64, 'base64') },
          MaxLabels: 20,
          MinConfidence: 50,
        })
      )

      // Reject inappropriate content immediately
      const inappropriateKeywords = ['Violence', 'Nudity', 'Explicit', 'Suggestive', 'Adult', 'Weapon']
      if (Labels.some(l => inappropriateKeywords.includes(l.Name ?? ''))) {
        console.warn('[nova-canvas] Rekognition detected inappropriate content, falling back')
        return null
      }

      // If finance labels are present, at least one must be ≥ 70% confident
      const financeLabels = Labels.filter(l =>
        FINANCE_LABELS.some(f => (l.Name ?? '').toLowerCase().includes(f.toLowerCase()))
      )
      const maxConfidence = financeLabels.reduce((max, l) => Math.max(max, l.Confidence ?? 0), 0)
      if (financeLabels.length > 0 && maxConfidence < 70) {
        console.warn(`[nova-canvas] Low finance label confidence (${maxConfidence.toFixed(1)}%), falling back to Pexels`)
        return null
      }
    } catch (rekErr) {
      // Rekognition failure is non-blocking — keep the generated image
      console.warn('[nova-canvas] Rekognition check failed (non-blocking):', rekErr)
    }

    return base64
  } catch (err) {
    console.warn('[nova-canvas] Image generation failed:', err)
    return null
  }
}

// ── PEXELS fallback ───────────────────────────────────────────────────────────
export async function fetchPexelsImage(title: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null
  try {
    const query = buildSearchQuery(title)
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=large`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.photos?.[0]?.src?.large2x as string) || null
  } catch {
    return null
  }
}

// ── SECONDARY: AWS Bedrock Titan Image ───────────────────────────────────────
const CATEGORY_PROMPTS: Record<string, string> = {
  investing:   'upward trending stock charts, financial growth graphs, dark navy background, gold accent colors, professional cinematic quality, no text',
  budgeting:   'organized budget planner, calculator, clean minimal desk, warm professional lighting, navy and gold tones, no text',
  credit:      'credit card floating in dark space, financial data visualization, navy blue background, gold and white colors, no text',
  debt:        'chains breaking apart revealing light, financial freedom concept, dark navy to bright gradient, gold accents, no text',
  saving:      'glass jar filled with gold coins, money growing concept, dark navy background, warm lighting, no text',
  retirement:  'calm sunset over water, financial charts subtly overlaid, gold and navy blue palette, peaceful prosperity, no text',
  income:      'multiple streams flowing into one, money tree concept, dark background gold accents, professional, no text',
  default:     'professional finance concept, dark navy background, gold accent lines, modern minimalist, cinematic quality, no text',
}

export async function generateBedrockImage(title: string, category: string): Promise<string | null> {
  try {
    const client = makeBedrockClient()
    const cat    = normalizeCategory(category)
    const style  = CATEGORY_PROMPTS[cat] || CATEGORY_PROMPTS.default
    const prompt = `${title}, ${style}`

    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-image-generator-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          negativeText: 'text, words, letters, watermark, logo, cartoon, anime, blurry, faces, people, low quality',
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: 630,
          width: 1200,
          cfgScale: 8.0,
          seed: Math.floor(Math.random() * 1000),
        },
      }),
    })

    const response = await client.send(command)
    const body = JSON.parse(new TextDecoder().decode(response.body))
    return (body.images?.[0] as string) || null // base64
  } catch {
    return null
  }
}

// ── BACKUP: Unsplash ──────────────────────────────────────────────────────────
export async function fetchUnsplashImage(title: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null
  try {
    const query = buildSearchQuery(title)
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.results?.[0]?.urls?.regular as string) || null
  } catch {
    return null
  }
}

// ── S3 Upload helpers ─────────────────────────────────────────────────────────
async function makeSlug(title: string): Promise<string> {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)
}

export async function uploadImageToS3(imageUrl: string, title: string): Promise<string> {
  const client = makeS3Client()
  const res    = await fetch(imageUrl)
  const buffer = Buffer.from(await res.arrayBuffer())
  const slug   = await makeSlug(title)
  const key    = `blog-images/${slug}-${Date.now()}.jpg`

  await client.send(
    new PutObjectCommand({
      Bucket:       getS3Bucket(),
      Key:          key,
      Body:         buffer,
      ContentType:  'image/jpeg',
      CacheControl: 'max-age=31536000',
    })
  )

  const cdn = process.env.CLOUDFRONT_DOMAIN || 'd1vqj5mvj2lux4.cloudfront.net'
  return `https://${cdn}/${key}`
}

export async function uploadBase64ToS3(base64: string, title: string, metadata?: Record<string, string>): Promise<string> {
  const client = makeS3Client()
  const buffer = Buffer.from(base64, 'base64')
  const slug   = await makeSlug(title)
  const key    = `blog-images/${slug}-${Date.now()}.jpg`

  await client.send(
    new PutObjectCommand({
      Bucket:       getS3Bucket(),
      Key:          key,
      Body:         buffer,
      ContentType:  'image/jpeg',
      CacheControl: 'max-age=31536000',
      ...(metadata ? { Metadata: metadata } : {}),
    })
  )

  const cdn = process.env.CLOUDFRONT_DOMAIN || 'd1vqj5mvj2lux4.cloudfront.net'
  return `https://${cdn}/${key}`
}

// ── MAIN FUNCTION ─────────────────────────────────────────────────────────────
export async function getPostImage(
  title: string,
  category: string
): Promise<{ url: string; source: 'nova-canvas' | 'pexels' | 'bedrock' | 'unsplash' | 'default' }> {
  const hasBucket = !!(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET)

  // 1. Nova Canvas (PRIMARY — AI-generated photorealistic finance image)
  if (hasBucket) {
    const base64 = await generateNovaCanvasImage(title, category)
    if (base64) {
      try {
        const url = await uploadBase64ToS3(base64, title, {
          source: 'nova-canvas',
          topic: title,
          generatedAt: new Date().toISOString(),
        })
        return { url, source: 'nova-canvas' }
      } catch { /* fall through */ }
    }
  }

  // 2. Pexels (fallback — commercial license, high quality)
  const pexelsUrl = await fetchPexelsImage(title)
  if (pexelsUrl && hasBucket) {
    try {
      const url = await uploadImageToS3(pexelsUrl, title)
      return { url, source: 'pexels' }
    } catch { /* fall through */ }
  } else if (pexelsUrl) {
    return { url: pexelsUrl, source: 'pexels' }
  }

  // 3. Unsplash (fallback)
  const unsplashUrl = await fetchUnsplashImage(title)
  if (unsplashUrl && hasBucket) {
    try {
      const url = await uploadImageToS3(unsplashUrl, title)
      return { url, source: 'unsplash' }
    } catch { /* fall through */ }
  } else if (unsplashUrl) {
    return { url: unsplashUrl, source: 'unsplash' }
  }

  // 4. Titan Image Generator (last resort)
  if (hasBucket) {
    const base64 = await generateBedrockImage(title, category)
    if (base64) {
      try {
        const url = await uploadBase64ToS3(base64, title)
        return { url, source: 'bedrock' }
      } catch { /* fall through */ }
    }
  }

  // Default brand image
  return { url: '/brand/og-default.jpg', source: 'default' }
}
