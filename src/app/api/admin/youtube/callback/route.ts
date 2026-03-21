import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

async function putParam(name: string, value: string, type: 'String' | 'SecureString' = 'SecureString') {
  await ssm.send(new PutParameterCommand({
    Name:      name,
    Value:     value,
    Type:      type,
    Overwrite: true,
  }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  const adminUrl = new URL('/admin/youtube', req.nextUrl.origin)

  if (error) {
    adminUrl.searchParams.set('oauth_error', error)
    return NextResponse.redirect(adminUrl)
  }

  if (!code) {
    adminUrl.searchParams.set('oauth_error', 'missing_code')
    return NextResponse.redirect(adminUrl)
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/admin/youtube/callback`

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    adminUrl.searchParams.set('oauth_error', `token_exchange_failed: ${text}`)
    return NextResponse.redirect(adminUrl)
  }

  const { access_token, refresh_token } = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
  }

  if (!refresh_token) {
    adminUrl.searchParams.set('oauth_error', 'no_refresh_token — revoke app access and retry')
    return NextResponse.redirect(adminUrl)
  }

  if (!access_token) {
    adminUrl.searchParams.set('oauth_error', 'no_access_token')
    return NextResponse.redirect(adminUrl)
  }

  // ── Save credentials to SSM ───────────────────────────────────────────────
  await putParam('/wealthbeginners/youtube/refresh-token', refresh_token, 'SecureString')
  await putParam('/wealthbeginners/youtube/client-id', process.env.GOOGLE_CLIENT_ID ?? '', 'String')

  // ── Fetch channel info ────────────────────────────────────────────────────
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${access_token}` } },
  )

  if (channelRes.ok) {
    const channelData = await channelRes.json() as {
      items?: Array<{
        id: string
        snippet: { title: string }
      }>
    }
    const channel = channelData.items?.[0]
    if (channel) {
      await putParam('/wealthbeginners/youtube/channel-id',   channel.id,             'String')
      await putParam('/wealthbeginners/youtube/channel-name', channel.snippet.title,  'String')
    }
  }

  adminUrl.searchParams.set('connected', 'true')
  return NextResponse.redirect(adminUrl)
}
