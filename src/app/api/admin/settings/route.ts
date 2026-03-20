import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'
import bcrypt from 'bcryptjs'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

function ssmParamForSection(section: string): string {
  return `/wealthbeginners/admin/settings/${section}`
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { searchParams } = new URL(req.url)
  const section = searchParams.get('section') ?? 'pipeline'

  try {
    const res = await ssm.send(new GetParameterCommand({
      Name: ssmParamForSection(section),
      WithDecryption: false,
    }))
    const settings = JSON.parse(res.Parameter?.Value ?? '{}')
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ settings: {} })
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const body = await req.json() as { section?: string; settings?: Record<string, unknown> }
  const { section, settings } = body

  if (!section) return NextResponse.json({ error: 'Missing section' }, { status: 400 })

  // Password change is special — validate current password against env
  if (section === 'password') {
    const { current, next } = settings as { current?: string; next?: string }
    if (!current || !next) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const storedKey = process.env.ADMIN_API_KEY ?? ''
    const valid = storedKey === current || await bcrypt.compare(current, storedKey)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })

    // We can't update env vars at runtime — instruct the user to update the secret
    return NextResponse.json({
      ok: false,
      error: 'To change the admin password, update the ADMIN_API_KEY environment variable in AWS Amplify and redeploy.',
    }, { status: 422 })
  }

  if (!settings) return NextResponse.json({ error: 'Missing settings' }, { status: 400 })

  await ssm.send(new PutParameterCommand({
    Name:      ssmParamForSection(section),
    Value:     JSON.stringify(settings),
    Type:      'String',
    Overwrite: true,
  }))

  return NextResponse.json({ ok: true })
}
