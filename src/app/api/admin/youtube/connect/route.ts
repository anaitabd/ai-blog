import { NextRequest, NextResponse } from 'next/server'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/admin/youtube/callback`

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri:  redirectUri,
    response_type: 'code',
    access_type:   'offline',
    prompt:        'consent',
    scope:         'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',
  })

  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return Response.json({ url: oauthUrl })
}
