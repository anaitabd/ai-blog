#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  scripts/get-youtube-token.mjs
//
//  Run once:  node scripts/get-youtube-token.mjs
//
//  What it does:
//  1. Spins up a temporary HTTP server on localhost:3000/oauth2callback
//  2. Opens the browser to Google's OAuth consent page with youtube.upload scope
//  3. Google redirects back with ?code=...
//  4. Exchanges code for access_token + refresh_token
//  5. Stores refresh_token in SSM /wealthbeginners/youtube/refresh-token
//  6. Exits — you can then run `npm run deploy` or the CDK deploy command
//
//  Prerequisites:
//  - You must add  http://localhost:3000/oauth2callback  as an authorised
//    redirect URI in the Google Cloud Console for project "wealthbeginners".
//    (APIs & Services → Credentials → edit the OAuth 2.0 Client → add URI)
// ─────────────────────────────────────────────────────────────────────────────

import http   from 'http'
import { exec } from 'child_process'
import { promisify } from 'util'

const execP = promisify(exec)

const CLIENT_ID     = '557645947933-0j2jhhesm60qm0lqlp8mmuufv4aledb2.apps.googleusercontent.com'
const CLIENT_SECRET = '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'
const REDIRECT_URI  = 'http://localhost:3000/oauth2callback'
const SCOPES        = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube'
const REGION        = 'us-east-1'

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000')
  if (url.pathname !== '/oauth2callback') {
    res.end('Not found'); return
  }

  const code = url.searchParams.get('code')
  if (!code) {
    res.writeHead(400); res.end('Missing code parameter'); return
  }

  console.log('\n✅ Authorization code received — exchanging for tokens…\n')

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Token exchange failed: ${tokenRes.status} — ${errText}`)
    }

    const tokens = await tokenRes.json()
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      throw new Error('No refresh_token returned. Make sure prompt=consent is set and this is the first authorization.')
    }

    console.log('🔑 Refresh token obtained. Storing in SSM…')

    // Store in SSM
    const { stdout } = await execP(
      `aws ssm put-parameter ` +
      `--name "/wealthbeginners/youtube/refresh-token" ` +
      `--value "${refreshToken}" ` +
      `--type SecureString --overwrite --region ${REGION}`
    )

    console.log('✅ Refresh token stored in SSM /wealthbeginners/youtube/refresh-token')
    console.log('\n🚀 YouTube credentials are fully configured.\n')
    console.log('Next step — run CDK deploy:\n')
    console.log('  cd infra && npx cdk deploy --require-approval never\n')

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center">
        <h2 style="color:#0B1628">✅ YouTube connected!</h2>
        <p style="color:#555">Refresh token stored in AWS SSM.<br>You can close this tab.</p>
      </body></html>
    `)
  } catch (err) {
    console.error('❌ Error:', err.message)
    res.writeHead(500); res.end('Error: ' + err.message)
  } finally {
    server.close()
    process.exit(0)
  }
})

server.listen(3000, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  YouTube OAuth2 Setup')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('⚠️  First, add this URI to your Google Cloud OAuth client:')
  console.log('   http://localhost:3000/oauth2callback\n')
  console.log('   APIs & Services → Credentials → edit the OAuth 2.0 Client\n')
  console.log('Opening browser for authorization…\n')

  // Open browser (macOS)
  exec(`open "${authUrl}"`, (err) => {
    if (err) {
      console.log('Could not open browser automatically.')
      console.log('Please open this URL manually:\n')
      console.log(authUrl + '\n')
    }
  })
})

