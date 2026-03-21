import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

async function getSSMParams(names: string[]): Promise<Record<string, string>> {
  const res = await ssm.send(new GetParametersCommand({ Names: names, WithDecryption: true }))
  const map: Record<string, string> = {}
  for (const p of res.Parameters ?? []) {
    if (p.Name && p.Value) map[p.Name] = p.Value
  }
  return map
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const params = await getSSMParams([
    '/wealthbeginners/youtube/refresh-token',
    '/wealthbeginners/youtube/channel-id',
    '/wealthbeginners/youtube/channel-name',
  ])

  const refreshToken = params['/wealthbeginners/youtube/refresh-token']
  const channelId    = params['/wealthbeginners/youtube/channel-id']
  const channelName  = params['/wealthbeginners/youtube/channel-name']

  if (!refreshToken) {
    return NextResponse.json({ connected: false })
  }

  // ── Verify token is still valid by fetching live channel info ────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }).toString(),
  })

  if (!tokenRes.ok) {
    return NextResponse.json({ connected: false, error: 'token_invalid' })
  }

  const { access_token } = await tokenRes.json() as { access_token?: string }
  if (!access_token) {
    return NextResponse.json({ connected: false, error: 'token_invalid' })
  }

  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${access_token}` } },
  )

  if (!channelRes.ok) {
    return NextResponse.json({ connected: false, error: 'token_invalid' })
  }

  const channelData = await channelRes.json() as {
    items?: Array<{
      id: string
      snippet: {
        title: string
        thumbnails?: { default?: { url: string } }
      }
      statistics?: {
        subscriberCount?: string
        videoCount?: string
      }
    }>
  }

  const channel = channelData.items?.[0]
  if (!channel) {
    return NextResponse.json({ connected: false, error: 'token_invalid' })
  }

  return NextResponse.json({
    connected:         true,
    channelId:         channel.id ?? channelId,
    channelName:       channel.snippet.title ?? channelName,
    channelThumbnail:  channel.snippet.thumbnails?.default?.url ?? null,
    subscriberCount:   channel.statistics?.subscriberCount ?? '0',
    videoCount:        channel.statistics?.videoCount ?? '0',
    lastChecked:       new Date().toISOString(),
  })
}
