import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

/**
 * GET  — return the Google OAuth2 URL for the admin to visit
 * POST — exchange OAuth2 code for tokens and store in SSM
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/admin/youtube/reconnect`

  const params = new URLSearchParams({
    client_id:    process.env.YOUTUBE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  return NextResponse.redirect(authUrl)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { code } = await req.json() as { code?: string }
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/admin/youtube/reconnect`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID ?? '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
      code,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return NextResponse.json({ error: `OAuth token exchange failed: ${text}` }, { status: 400 })
  }

  const { refresh_token, access_token } = await tokenRes.json()

  if (!refresh_token) {
    return NextResponse.json({ error: 'No refresh_token returned. Revoke app access and retry.' }, { status: 400 })
  }

  await ssm.send(new PutParameterCommand({
    Name:      '/wealthbeginners/youtube/refresh-token',
    Value:     refresh_token,
    Type:      'SecureString',
    Overwrite: true,
  }))

  return NextResponse.json({ ok: true, access_token })
}
