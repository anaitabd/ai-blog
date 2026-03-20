import { NextRequest, NextResponse } from 'next/server'
import {
  BedrockClient,
  GetFoundationModelCommand,
} from '@aws-sdk/client-bedrock'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const REQUIRED_MODELS = [
  { id: 'anthropic.claude-opus-4-5',             name: 'Claude Opus 4.5 (content)' },
  { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude Sonnet 3.5 v2' },
  { id: 'anthropic.claude-3-haiku-20240307-v1:0',    name: 'Claude Haiku 3' },
  { id: 'amazon.nova-canvas-v1:0',               name: 'Nova Canvas (images)' },
  { id: 'amazon.nova-reel-v1:0',                 name: 'Nova Reel (video)' },
  { id: 'amazon.titan-image-generator-v2:0',     name: 'Titan Image v2 (fallback)' },
]

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const bedrock = new BedrockClient({ region: process.env.REGION ?? 'us-east-1', credentials })

  const results = await Promise.allSettled(
    REQUIRED_MODELS.map(async m => {
      await bedrock.send(new GetFoundationModelCommand({ modelIdentifier: m.id }))
      return { ...m, available: true }
    })
  )

  const models = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      ...REQUIRED_MODELS[i],
      available: false,
      error: (r.reason as Error)?.message ?? 'Unknown error',
    }
  })

  return NextResponse.json({ models })
}
