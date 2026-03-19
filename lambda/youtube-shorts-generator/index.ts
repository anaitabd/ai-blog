// ─────────────────────────────────────────────────────────────────────────────
//  YouTube Shorts Generator
//  1. Calls Bedrock Claude to generate 3 short video scripts from the blog post
//  2. Calls Amazon Nova Reel (StartAsyncInvoke) for each script
//  3. Polls until SUCCEEDED (max 12 minutes)
//  4. Uploads the resulting .mp4 to S3 under youtube-shorts/{postId}/
//  Lambda timeout: 14 minutes   Memory: 1024 MB
// ─────────────────────────────────────────────────────────────────────────────

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  StartAsyncInvokeCommand,
  GetAsyncInvokeCommand,
} from '@aws-sdk/client-bedrock-runtime'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { log } from '../shared/logger'

// ─── AWS clients ──────────────────────────────────────────────────────────────
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const s3      = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const ssm     = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

// ─── Constants ───────────────────────────────────────────────────────────────
const NOVA_REEL_MODEL   = 'amazon.nova-reel-v1:0'
const CLAUDE_MODEL      = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
const POLL_INTERVAL_MS  = 15_000   // 15 seconds
const MAX_POLL_MS       = 12 * 60 * 1000 // 12 minutes

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeneratorEvent {
  postId:   string
  title:    string
  content:  string
  url:      string
  excerpt:  string
}

interface ReelScript {
  hook:       string
  body:       string
  cta:        string
  fullScript: string
}

// ─── SSM helper ──────────────────────────────────────────────────────────────
async function getParam(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))
  return res.Parameter?.Value ?? ''
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: GeneratorEvent) => {
  const { postId, title, content, url, excerpt } = event

  log({ lambda: 'youtube-shorts-generator', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, title } })

  const s3Bucket = process.env.S3_BUCKET!

  try {
    // ── Step 1: Generate 3 scripts via Claude ────────────────────────────────
    log({ lambda: 'youtube-shorts-generator', step: 'script-generation', status: 'start', pct: 5,
      meta: { postId } })

    const scripts = await generateScripts(title, content)

    log({ lambda: 'youtube-shorts-generator', step: 'script-generation', status: 'complete', pct: 15,
      meta: { count: scripts.length } })

    // ── Step 2: Generate videos via Nova Reel (parallel start, serial poll) ──
    const videoResults: Array<{ s3Url: string; script: ReelScript }> = []

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i]
      const outputPrefix = `youtube-shorts/${postId}/reel-${i + 1}`

      log({ lambda: 'youtube-shorts-generator', step: 'nova-reel-start', status: 'start', pct: 15 + i * 20,
        meta: { reelIndex: i + 1, hook: script.hook.slice(0, 60) } })

      // Start async Nova Reel job
      const invocationArn = await startNovaReelJob(script.fullScript, s3Bucket, outputPrefix)

      log({ lambda: 'youtube-shorts-generator', step: 'nova-reel-polling', status: 'start', pct: 20 + i * 20,
        meta: { reelIndex: i + 1, invocationArn } })

      // Poll until complete
      const outputS3Uri = await pollUntilComplete(invocationArn)

      log({ lambda: 'youtube-shorts-generator', step: 'nova-reel-complete', status: 'complete',
        pct: 30 + i * 20, meta: { reelIndex: i + 1, outputS3Uri } })

      // Copy from Nova Reel output path → our organised path
      const finalKey = `youtube-shorts/${postId}/reel-${i + 1}-${Date.now()}.mp4`
      await copyS3Object(outputS3Uri, s3Bucket, finalKey)

      const s3Url = `s3://${s3Bucket}/${finalKey}`
      videoResults.push({ s3Url, script })
    }

    const videoUrls = videoResults.map((r) => r.s3Url)
    const scriptsOut = videoResults.map((r) => r.script)

    log({ lambda: 'youtube-shorts-generator', step: 'handler-complete', status: 'complete', pct: 100,
      meta: { postId, videoCount: videoUrls.length } })

    return {
      postId,
      title,
      url,
      excerpt,
      videoUrls,
      scripts: scriptsOut,
    }
  } catch (err) {
    log({ lambda: 'youtube-shorts-generator', step: 'handler-error', status: 'error', pct: 0,
      meta: { error: String(err), postId } })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Script generation — Claude claude-3-5-sonnet
// ─────────────────────────────────────────────────────────────────────────────
async function generateScripts(title: string, content: string): Promise<ReelScript[]> {
  const truncatedContent = content.slice(0, 4000) // keep within context budget

  const prompt = `You are a YouTube Shorts scriptwriter for WealthBeginners, a personal finance channel for beginners.
Write 3 different SHORT video scripts (max 130 words each) based on this blog post.
Each script must have: a strong hook (5s), key value body (40s), and CTA (10s) to wealthbeginners.com
The CTA must always say: "Full guide at wealthbeginners.com — link in description"
Blog title: ${title}
Blog content: ${truncatedContent}
Return ONLY a valid JSON array (no markdown, no explanation) with exactly this shape:
[{ "hook": "...", "body": "...", "cta": "Full guide at wealthbeginners.com — link in description", "fullScript": "..." }]`

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await bedrock.send(command)
  const body     = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text.trim()

  // Strip markdown code fences if present
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const scripts: ReelScript[] = JSON.parse(jsonText)

  if (!Array.isArray(scripts) || scripts.length === 0) {
    throw new Error('Claude returned an unexpected script format')
  }

  // Ensure CTA is always correct
  return scripts.map((s) => ({
    ...s,
    cta: 'Full guide at wealthbeginners.com — link in description',
    fullScript: `${s.hook}\n\n${s.body}\n\n${s.cta}`,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nova Reel — start async job
// ─────────────────────────────────────────────────────────────────────────────
async function startNovaReelJob(
  scriptText: string,
  bucket:     string,
  outputPrefix: string,
): Promise<string> {
  // Nova Reel generates 6-second 9:16 vertical clips from a text prompt
  const visualPrompt = buildVisualPrompt(scriptText)

  const command = new StartAsyncInvokeCommand({
    modelId: NOVA_REEL_MODEL,
    modelInput: {
      taskType:    'TEXT_VIDEO',
      textToVideoParams: {
        text: visualPrompt,
      },
      videoGenerationConfig: {
        durationSeconds: 6,
        fps:             24,
        dimension:       '1280x720',  // Nova Reel supported: will be letterboxed to 9:16
      },
    },
    outputDataConfig: {
      s3OutputDataConfig: {
        s3Uri: `s3://${bucket}/${outputPrefix}/`,
      },
    },
  })

  const response = await bedrock.send(command)
  if (!response.invocationArn) {
    throw new Error('Nova Reel did not return an invocationArn')
  }
  return response.invocationArn
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nova Reel — poll until SUCCEEDED or throw on failure / timeout
// ─────────────────────────────────────────────────────────────────────────────
async function pollUntilComplete(invocationArn: string): Promise<string> {
  const deadline = Date.now() + MAX_POLL_MS

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    const command  = new GetAsyncInvokeCommand({ invocationArn })
    const response = await bedrock.send(command)
    const status   = response.status

    log({ lambda: 'youtube-shorts-generator', step: 'poll', status: 'start', pct: 50,
      meta: { status, invocationArn: invocationArn.slice(-20) } })

    if (status === 'Completed') {
      const s3Uri = response.outputDataConfig?.s3OutputDataConfig?.s3Uri
      if (!s3Uri) throw new Error(`Nova Reel completed but no S3 URI returned for ${invocationArn}`)
      return s3Uri
    }

    if (status === 'Failed') {
      const reason = (response as any).failureMessage ?? 'Unknown reason'
      throw new Error(`Nova Reel job failed: ${reason}`)
    }
    // InProgress — keep polling
  }

  throw new Error(`Nova Reel polling timed out after 12 minutes for ${invocationArn}`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Copy from Nova Reel output folder → final key
//  Nova Reel writes: s3://{bucket}/{prefix}/output.mp4
// ─────────────────────────────────────────────────────────────────────────────
async function copyS3Object(
  outputFolderUri: string,
  destBucket: string,
  destKey:    string,
): Promise<void> {
  // outputFolderUri is the folder prefix; the actual file is output.mp4 inside it
  const withoutScheme = outputFolderUri.replace('s3://', '')
  const slashIdx  = withoutScheme.indexOf('/')
  const srcBucket = withoutScheme.slice(0, slashIdx)
  const srcPrefix = withoutScheme.slice(slashIdx + 1).replace(/\/$/, '')
  const srcKey    = `${srcPrefix}/output.mp4`

  // Download from S3
  const getCmd = new GetObjectCommand({ Bucket: srcBucket, Key: srcKey })
  const getRes = await s3.send(getCmd)
  const chunks: Uint8Array[] = []
  for await (const chunk of getRes.Body as any) {
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)

  // Re-upload to final path
  await s3.send(new PutObjectCommand({
    Bucket:       destBucket,
    Key:          destKey,
    Body:         body,
    ContentType:  'video/mp4',
    CacheControl: 'public, max-age=31536000',
    Metadata: { 'source': 'nova-reel', 'platform': 'youtube-shorts' },
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
//  Build a visual prompt from the script text for Nova Reel
// ─────────────────────────────────────────────────────────────────────────────
function buildVisualPrompt(script: string): string {
  // Summarise to ~200 chars for the visual model — keep cinematic instructions
  const summary = script.slice(0, 200)
  return (
    `Cinematic 9:16 vertical personal finance visual. ${summary}. ` +
    'Style: clean modern animation, navy blue #0B1628 and gold #C9A84C color palette, ' +
    'bold typography motion graphics, no people, no faces, no text overlays, ' +
    'professional financial education aesthetic, smooth transitions, 6 seconds'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

