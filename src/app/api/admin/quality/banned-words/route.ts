import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const PARAM = '/wealthbeginners/quality/banned-words'

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  try {
    const res = await ssm.send(new GetParameterCommand({ Name: PARAM, WithDecryption: false }))
    const words: string[] = JSON.parse(res.Parameter?.Value ?? '[]')
    return NextResponse.json({ words })
  } catch {
    return NextResponse.json({ words: [] })
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const body = await req.json() as { words?: string[] }
  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: 'words must be an array' }, { status: 400 })
  }

  // Sanitize: lowercase, trim, deduplicate
  const words = Array.from(new Set(body.words.map(w => w.toLowerCase().trim()).filter(Boolean)))

  await ssm.send(new PutParameterCommand({
    Name:      PARAM,
    Value:     JSON.stringify(words),
    Type:      'String',
    Overwrite: true,
  }))

  return NextResponse.json({ ok: true, count: words.length })
}
