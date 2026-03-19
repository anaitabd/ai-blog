// ─────────────────────────────────────────────────────────────────────────────
//  YouTube Shorts Publisher
//  1. Reads each video from S3 into /tmp
//  2. Refreshes a YouTube OAuth2 access token from SSM
//  3. Uploads to YouTube Data API v3 via resumable upload
//  4. Notifies Next.js via POST /api/publish/youtube
//  Lambda timeout: 10 minutes   Memory: 512 MB
// ─────────────────────────────────────────────────────────────────────────────

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'
import * as fs   from 'fs'
import * as path from 'path'
import { log }   from '../shared/logger'

// ─── AWS clients ──────────────────────────────────────────────────────────────
const s3  = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReelScript {
  hook:       string
  body:       string
  cta:        string
  fullScript: string
}

interface PublisherEvent {
  postId:    string
  title:     string
  url:       string
  excerpt:   string
  videoUrls: string[]          // s3:// URIs
  scripts:   ReelScript[]
}

interface PublishedVideo {
  youtubeVideoId:  string
  youtubeVideoUrl: string
  s3VideoUrl:      string
  title:           string
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: PublisherEvent) => {
  const { postId, title, url, videoUrls, scripts } = event

  log({ lambda: 'youtube-shorts-publisher', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, videoCount: videoUrls.length } })

  // ── Load credentials from SSM ─────────────────────────────────────────────
  const params = await getSSMParams([
    '/wealthbeginners/youtube/client-id',
    '/wealthbeginners/youtube/client-secret',
    '/wealthbeginners/youtube/refresh-token',
  ])
  const clientId     = params['/wealthbeginners/youtube/client-id']
  const clientSecret = params['/wealthbeginners/youtube/client-secret']
  const refreshToken = params['/wealthbeginners/youtube/refresh-token']

  const nextjsUrl    = process.env.NEXTJS_SITE_URL!
  const internalSecret = process.env.INTERNAL_SECRET!

  // ── Refresh access token once ─────────────────────────────────────────────
  log({ lambda: 'youtube-shorts-publisher', step: 'oauth-refresh', status: 'start', pct: 5 })
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken)
  log({ lambda: 'youtube-shorts-publisher', step: 'oauth-refresh', status: 'complete', pct: 10 })

  const publishedVideos: PublishedVideo[] = []

  for (let i = 0; i < videoUrls.length; i++) {
    const s3Uri  = videoUrls[i]
    const script = scripts[i] ?? scripts[0]
    const pct    = 10 + i * 28

    log({ lambda: 'youtube-shorts-publisher', step: 'upload-start', status: 'start', pct,
      meta: { index: i + 1, s3Uri } })

    try {
      // ── Download .mp4 from S3 into Lambda /tmp ──────────────────────────
      const tmpPath = await downloadFromS3(s3Uri, `/tmp/short-${i}.mp4`)

      // ── Build YouTube metadata ───────────────────────────────────────────
      const videoTitle = buildYouTubeTitle(title, i + 1)
      const description = buildYouTubeDescription(script, url)

      // ── Resumable upload to YouTube ──────────────────────────────────────
      const videoId = await uploadToYouTube(tmpPath, videoTitle, description, accessToken)
      const videoUrl = `https://www.youtube.com/shorts/${videoId}`

      log({ lambda: 'youtube-shorts-publisher', step: 'youtube-uploaded', status: 'complete',
        pct: pct + 15, meta: { index: i + 1, videoId, videoUrl } })

      // ── Notify Next.js ────────────────────────────────────────────────────
      await notifyNextJs(nextjsUrl, internalSecret, {
        postId,
        youtubeVideoId:  videoId,
        youtubeVideoUrl: videoUrl,
        s3VideoUrl:      s3Uri,
        title:           videoTitle,
        caption:         script.hook,
        script:          script.fullScript,
      })

      publishedVideos.push({ youtubeVideoId: videoId, youtubeVideoUrl: videoUrl, s3VideoUrl: s3Uri, title: videoTitle })

      // Clean up /tmp to avoid storage exhaustion
      try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }

      // 30 second delay between uploads to respect YouTube rate limits
      if (i < videoUrls.length - 1) {
        log({ lambda: 'youtube-shorts-publisher', step: 'rate-limit-delay', status: 'start',
          pct: pct + 20, meta: { nextIn: '30s' } })
        await sleep(30_000)
      }
    } catch (err) {
      log({ lambda: 'youtube-shorts-publisher', step: 'upload-error', status: 'error', pct,
        meta: { index: i + 1, error: String(err) } })
      // Continue to next video — don't let one failure block the rest
    }
  }

  log({ lambda: 'youtube-shorts-publisher', step: 'handler-complete', status: 'complete', pct: 100,
    meta: { postId, publishedCount: publishedVideos.length } })

  return { publishedVideos }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SSM — batch fetch SecureString parameters
// ─────────────────────────────────────────────────────────────────────────────
async function getSSMParams(names: string[]): Promise<Record<string, string>> {
  const res = await ssm.send(new GetParametersCommand({ Names: names, WithDecryption: true }))
  const map: Record<string, string> = {}
  for (const p of res.Parameters ?? []) {
    if (p.Name && p.Value) map[p.Name] = p.Value
  }
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
//  OAuth2 — refresh YouTube access token
// ─────────────────────────────────────────────────────────────────────────────
async function refreshAccessToken(
  clientId:     string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to refresh YouTube token: ${res.status} — ${text}`)
  }

  const json = await res.json() as { access_token: string }
  return json.access_token
}

// ─────────────────────────────────────────────────────────────────────────────
//  S3 → /tmp download
// ─────────────────────────────────────────────────────────────────────────────
async function downloadFromS3(s3Uri: string, localPath: string): Promise<string> {
  const withoutScheme = s3Uri.replace('s3://', '')
  const slashIdx  = withoutScheme.indexOf('/')
  const bucket    = withoutScheme.slice(0, slashIdx)
  const key       = withoutScheme.slice(slashIdx + 1)

  const res    = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as any) {
    chunks.push(chunk)
  }
  fs.writeFileSync(localPath, Buffer.concat(chunks))
  return localPath
}

// ─────────────────────────────────────────────────────────────────────────────
//  YouTube Data API v3 — resumable upload
// ─────────────────────────────────────────────────────────────────────────────
async function uploadToYouTube(
  filePath:    string,
  title:       string,
  description: string,
  accessToken: string,
): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath)
  const fileSize   = fileBuffer.byteLength

  // ── Step 1: Initiate resumable session ───────────────────────────────────
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos' +
    '?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${accessToken}`,
        'Content-Type':    'application/json',
        'X-Upload-Content-Type':  'video/mp4',
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          tags: [
            'personal finance',
            'wealth beginners',
            'investing for beginners',
            'money tips',
            'financial freedom',
            'shorts',
          ],
          categoryId: '27',  // Education
        },
        status: {
          privacyStatus:            'public',
          selfDeclaredMadeForKids:  false,
        },
      }),
    },
  )

  if (!initRes.ok) {
    const text = await initRes.text()
    throw new Error(`YouTube resumable init failed: ${initRes.status} — ${text}`)
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')

  // ── Step 2: Upload binary content ────────────────────────────────────────
  const uploadRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: {
      'Content-Type':   'video/mp4',
      'Content-Length': String(fileSize),
    },
    body: fileBuffer,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`YouTube upload PUT failed: ${uploadRes.status} — ${text}`)
  }

  const json = await uploadRes.json() as { id: string }
  if (!json.id) throw new Error('YouTube upload succeeded but returned no video ID')
  return json.id
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST to Next.js /api/publish/youtube
// ─────────────────────────────────────────────────────────────────────────────
async function notifyNextJs(
  baseUrl:        string,
  internalSecret: string,
  payload: {
    postId:          string
    youtubeVideoId:  string
    youtubeVideoUrl: string
    s3VideoUrl:      string
    title:           string
    caption?:        string
    script?:         string
  },
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/publish/youtube`, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'x-internal-secret': internalSecret,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Next.js /api/publish/youtube returned ${res.status}: ${text}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildYouTubeTitle(postTitle: string, index: number): string {
  const base = `${postTitle} #Shorts`
  return base.length <= 100 ? base : `${base.slice(0, 97)}…`
}

function buildYouTubeDescription(script: ReelScript, postUrl: string): string {
  return [
    script.hook,
    '',
    script.body,
    '',
    `Full guide 👉 ${postUrl}`,
    '',
    '#PersonalFinance #WealthBeginners #Investing #MoneyTips #Shorts',
  ].join('\n')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

