import { NextRequest, NextResponse } from 'next/server'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

const ssm = new SSMClient({ region: process.env.REGION ?? 'us-east-1', credentials })

async function getParam(name: string): Promise<string | null> {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))
    return res.Parameter?.Value ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  try {
    const refreshToken = await getParam('/wealthbeginners/youtube/refresh-token')

    if (!refreshToken) {
      return NextResponse.json({
        channelId: '',
        title: 'Not connected',
        subscriberCount: '0',
        videoCount: '0',
        customUrl: '',
        tokenStatus: 'missing',
        tokenExpiry: null,
      })
    }

    // Exchange refresh token for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.YOUTUBE_CLIENT_ID ?? '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }).toString(),
    })

    if (!tokenRes.ok) {
      return NextResponse.json({
        channelId: '',
        title: 'Token expired',
        subscriberCount: '0',
        videoCount: '0',
        customUrl: '',
        tokenStatus: 'expired',
        tokenExpiry: null,
      })
    }

    const { access_token, expires_in } = await tokenRes.json()

    // Fetch channel info
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const channelData = await channelRes.json()
    const channel = channelData.items?.[0]

    if (!channel) {
      return NextResponse.json({
        channelId: '',
        title: 'No channel found',
        subscriberCount: '0',
        videoCount: '0',
        customUrl: '',
        tokenStatus: 'connected',
        tokenExpiry: new Date(Date.now() + expires_in * 1000).toISOString(),
      })
    }

    return NextResponse.json({
      channelId: channel.id,
      title: channel.snippet.title,
      subscriberCount: channel.statistics.subscriberCount ?? '0',
      videoCount: channel.statistics.videoCount ?? '0',
      customUrl: channel.snippet.customUrl ?? '',
      tokenStatus: 'connected',
      tokenExpiry: new Date(Date.now() + expires_in * 1000).toISOString(),
    })
  } catch (err) {
    console.error('[youtube/channel] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
