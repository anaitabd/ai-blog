import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const PARAM = '/wealthbeginners/youtube/settings'

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  try {
    const res = await ssm.send(new GetParameterCommand({ Name: PARAM, WithDecryption: false }))
    const settings = JSON.parse(res.Parameter?.Value ?? '{}')
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ settings: {} })
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const body = await req.json() as { settings?: Record<string, unknown> }
  if (!body.settings) return NextResponse.json({ error: 'Missing settings' }, { status: 400 })

  await ssm.send(new PutParameterCommand({
    Name:      PARAM,
    Value:     JSON.stringify(body.settings),
    Type:      'String',
    Overwrite: true,
  }))

  return NextResponse.json({ ok: true })
}
