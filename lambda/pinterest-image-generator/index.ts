// ─────────────────────────────────────────────────────────────────────────────
//  Generates Pinterest-optimized VERTICAL images (1000x1500px, 2:3 ratio)
//  using AWS Bedrock Titan Image Generator
//  Pinterest vertical images get 60% more engagement than horizontal ones
// ─────────────────────────────────────────────────────────────────────────────

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })
const s3 = new S3Client({ region: process.env.AWS_REGION })

interface PinterestImageEvent {
  slug: string
  title: string
  category: string
  keyword: string
  excerpt: string
}

export const handler = async (event: PinterestImageEvent): Promise<{ imageUrl: string }> => {
  const { slug, title, category, keyword } = event

  const imagePrompt = buildPinterestImagePrompt(title, category, keyword)

  // Generate vertical 2:3 image optimized for Pinterest
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-image-generator-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: imagePrompt,
        negativeText: [
          'blurry', 'low quality', 'watermark', 'text overlay', 'words',
          'faces', 'people', 'nsfw', 'logo', 'brand', 'copyright',
          'ugly', 'distorted', 'pixelated', 'dark', 'cluttered',
        ].join(', '),
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        height: 1500,  // Pinterest optimal height
        width: 1000,   // Pinterest optimal width (2:3 ratio)
        cfgScale: 8.5,
        seed: Math.floor(Math.random() * 2147483647),
      },
    }),
  })

  const response = await bedrock.send(command)
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const imageBase64: string = body.images[0]

  // Upload to S3 in a pinterest-specific folder
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const key = `pinterest-images/${slug}-pinterest-${uniqueSuffix}.jpg`
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: Buffer.from(imageBase64, 'base64'),
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      'pinterest-optimized': 'true',
      'aspect-ratio': '2:3',
      'article-slug': slug,
    },
  }))

  const imageUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`
  console.log(`Pinterest image created: ${imageUrl}`)
  return { imageUrl }
}

function buildPinterestImagePrompt(title: string, category: string, keyword: string): string {
  // Pinterest performs best with:
  // - Clean, minimal designs
  // - Strong contrast
  // - Vertical composition with "empty" top third for text overlay
  // - Aspirational imagery (success, growth, achievement)
  // - Brand colors: navy #0B1628 + gold #C9A84C

  const categoryPrompts: Record<string, string> = {
    'Investing': 'golden coins stacked in ascending columns forming a bar chart, clean flat design, aspirational wealth symbolism',
    'Budgeting': 'organized budget planner with gold pen, minimalist flat lay composition, financial planning aesthetic',
    'Debt': 'broken chain links transforming into gold coins, freedom and relief symbolism, clean vector illustration',
    'Income': 'multiple income stream symbols flowing into a central gold circle, passive income concept, clean infographic style',
    'Saving': 'clear glass jar filling with gold coins, growth and progress concept, clean minimal background',
    'Credit': 'credit score meter rising to excellent, clean dashboard design, progress symbolism',
    'Retirement': 'sunrise over a calm horizon with gold coins in foreground, freedom and future concept',
    'Financial Literacy': 'open book with financial charts and gold icons floating above, knowledge and growth concept',
  }

  const basePrompt = categoryPrompts[category] || 'financial growth concept with gold coins and upward arrows, clean minimal design'

  return [
    `Pinterest vertical infographic style illustration,`,
    basePrompt,
    `navy blue (#0B1628) background gradient,`,
    `gold (#C9A84C) and cream accent colors,`,
    `clean flat design illustration style,`,
    `financial editorial magazine quality,`,
    `strong visual composition with clear focal point in center,`,
    `top third of image intentionally minimal for text overlay,`,
    `2:3 vertical portrait aspect ratio,`,
    `no text, no words, no faces, no people, no logos,`,
    `professional high quality render,`,
    `aspirational personal finance aesthetic`,
  ].join(' ')
}
