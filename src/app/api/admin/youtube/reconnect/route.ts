import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wealthbeginners.com'}/api/admin/youtube/reconnect`

/**
 * GET (no ?code) — initiate OAuth2 flow: redirect admin to Google consent screen.
 * GET (?code=...) — OAuth2 callback from Google: exchange code → store refresh_token in SSM → redirect to /admin/youtube.
 * POST            — legacy: exchange code sent as JSON body.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  // ── OAuth2 callback from Google ──────────────────────────────────────────
  if (error) {
    const adminUrl = new URL('/admin/youtube', req.nextUrl.origin)
    adminUrl.searchParams.set('oauth_error', error)
    return NextResponse.redirect(adminUrl)
  }

  if (code) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.YOUTUBE_CLIENT_ID ?? '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
        code,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      const adminUrl = new URL('/admin/youtube', req.nextUrl.origin)
      adminUrl.searchParams.set('oauth_error', `token_exchange_failed: ${text}`)
      return NextResponse.redirect(adminUrl)
    }

    const { refresh_token } = await tokenRes.json() as { refresh_token?: string }

    if (!refresh_token) {
      const adminUrl = new URL('/admin/youtube', req.nextUrl.origin)
      adminUrl.searchParams.set('oauth_error', 'no_refresh_token — revoke app access and retry')
      return NextResponse.redirect(adminUrl)
    }

    await ssm.send(new PutParameterCommand({
      Name:      '/wealthbeginners/youtube/refresh-token',
      Value:     refresh_token,
      Type:      'SecureString',
      Overwrite: true,
    }))

    const adminUrl = new URL('/admin/youtube', req.nextUrl.origin)
    adminUrl.searchParams.set('connected', '1')
    return NextResponse.redirect(adminUrl)
  }

  // ── Initiate OAuth2 flow ─────────────────────────────────────────────────
  const params = new URLSearchParams({
    client_id:     process.env.YOUTUBE_CLIENT_ID ?? '',
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type:   'offline',
    prompt:        'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const { code } = await req.json() as { code?: string }
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID ?? '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
      code,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return NextResponse.json({ error: `OAuth token exchange failed: ${text}` }, { status: 400 })
  }

  const { refresh_token, access_token } = await tokenRes.json() as { refresh_token?: string; access_token?: string }

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
