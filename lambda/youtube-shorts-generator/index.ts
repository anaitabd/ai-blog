// ─────────────────────────────────────────────────────────────────────────────
//  YouTube Shorts Generator — Pro Quality
//  1. Claude generates a 3-scene script (hook / body / cta) with scene-specific
//     cinematic visual prompts for each scene
//  2. Amazon Nova Reel renders one 6-second 1280×720 clip per scene
//  3. FFmpeg converts each landscape clip → 720×1280 portrait (blur-bars)
//  4. AWS Polly Neural TTS (Stephen, en-US) narrates the full script (SSML)
//  5. FFmpeg: concat vertical clips → loop video → mux audio → final.mp4
//  6. Uploads the single broadcast-quality .mp4 to S3
//  Lambda timeout: 15 minutes   Memory: 3008 MB   /tmp: 4096 MB
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
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import { log } from '../shared/logger'

// ─── AWS clients ──────────────────────────────────────────────────────────────
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const s3      = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const ssm     = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const polly   = new PollyClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

// ─── Constants ───────────────────────────────────────────────────────────────
const NOVA_REEL_MODEL  = 'amazon.nova-reel-v1:0'
const CLAUDE_MODEL     = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const POLL_INTERVAL_MS = 15_000
const MAX_POLL_MS      = 13 * 60 * 1000   // 13 min (Lambda budget = 15 min)
const FFMPEG           = process.env.FFMPEG_PATH ?? '/opt/bin/ffmpeg'
const SCENE_COUNT      = 3

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeneratorEvent {
  postId:   string
  title:    string
  content:  string
  url:      string
  excerpt:  string
}

interface SceneScript {
  scene:        'hook' | 'body' | 'cta'
  narration:    string
  visualPrompt: string
}

interface ReelScript {
  hook:       string
  body:       string
  cta:        string
  fullScript: string
  scenes:     SceneScript[]
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: GeneratorEvent) => {
  const { postId, title, content, url, excerpt } = event

  log({ lambda: 'youtube-shorts-generator', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, title } })

  const s3Bucket = process.env.S3_BUCKET!

  try {
    // ── Step 1: Generate scene scripts + cinematic prompts via Claude ─────
    log({ lambda: 'youtube-shorts-generator', step: 'script-generation', status: 'start', pct: 5,
      meta: { postId } })

    const script = await generateScript(title, content)

    log({ lambda: 'youtube-shorts-generator', step: 'script-generation', status: 'complete', pct: 10,
      meta: { preview: script.fullScript.slice(0, 80) } })

    // ── Step 2: Render each scene with Nova Reel (serial) ─────────────────
    const rawClipPaths: string[] = []

    for (let i = 0; i < script.scenes.length; i++) {
      const scene        = script.scenes[i]
      const outputPrefix = `youtube-shorts/${postId}/raw-scene-${i + 1}`
      const pct          = 10 + i * 15

      log({ lambda: 'youtube-shorts-generator', step: 'nova-reel-start', status: 'start', pct,
        meta: { scene: scene.scene, index: i + 1 } })

      const invocationArn = await startNovaReelJob(scene.visualPrompt, s3Bucket, outputPrefix)
      const outputS3Uri   = await pollUntilComplete(invocationArn)

      log({ lambda: 'youtube-shorts-generator', step: 'nova-reel-complete', status: 'complete',
        pct: pct + 10, meta: { scene: scene.scene, outputS3Uri } })

      const tmpRawPath = `/tmp/raw-scene-${i + 1}.mp4`
      await downloadS3ToLocal(outputS3Uri, tmpRawPath)
      rawClipPaths.push(tmpRawPath)
    }

    log({ lambda: 'youtube-shorts-generator', step: 'clips-downloaded', status: 'complete', pct: 57,
      meta: { clipCount: rawClipPaths.length } })

    // ── Step 3: Convert each 1280×720 clip → 720×1280 portrait ───────────
    log({ lambda: 'youtube-shorts-generator', step: 'vertical-convert', status: 'start', pct: 59 })

    const verticalClipPaths: string[] = []
    for (let i = 0; i < rawClipPaths.length; i++) {
      const vertPath = `/tmp/scene-${i + 1}-vertical.mp4`
      convertToVertical(rawClipPaths[i], vertPath)
      verticalClipPaths.push(vertPath)
    }

    log({ lambda: 'youtube-shorts-generator', step: 'vertical-convert', status: 'complete', pct: 65 })

    // ── Step 4: AWS Polly Neural TTS narration ────────────────────────────
    log({ lambda: 'youtube-shorts-generator', step: 'polly-tts', status: 'start', pct: 67 })

    const narrationPath = '/tmp/narration.mp3'
    await generateNarration(script.fullScript, narrationPath)

    const narrationKB = Math.round(fs.statSync(narrationPath).size / 1024)
    log({ lambda: 'youtube-shorts-generator', step: 'polly-tts', status: 'complete', pct: 73,
      meta: { narrationKB } })

    // ── Step 5: FFmpeg — concat + loop + mux → broadcast-quality Short ────
    log({ lambda: 'youtube-shorts-generator', step: 'ffmpeg-assembly', status: 'start', pct: 74 })

    const finalPath = '/tmp/final.mp4'
    assembleShort(verticalClipPaths, narrationPath, finalPath)

    const finalMB = Math.round(fs.statSync(finalPath).size / (1024 * 1024))
    log({ lambda: 'youtube-shorts-generator', step: 'ffmpeg-assembly', status: 'complete', pct: 88,
      meta: { finalMB } })

    // ── Step 6: Upload final.mp4 to S3 ────────────────────────────────────
    const finalKey   = `youtube-shorts/${postId}/final-${Date.now()}.mp4`
    const fileBuffer = fs.readFileSync(finalPath)

    await s3.send(new PutObjectCommand({
      Bucket:       s3Bucket,
      Key:          finalKey,
      Body:         fileBuffer,
      ContentType:  'video/mp4',
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        source:   'nova-reel-polly-ffmpeg',
        platform: 'youtube-shorts',
        postId,
      },
    }))

    cleanupTmp([
      ...rawClipPaths,
      ...verticalClipPaths,
      narrationPath,
      finalPath,
      '/tmp/filelist.txt',
      '/tmp/combined.mp4',
    ])

    const s3Url = `s3://${s3Bucket}/${finalKey}`

    log({ lambda: 'youtube-shorts-generator', step: 'handler-complete', status: 'complete', pct: 100,
      meta: { postId, s3Url, finalMB } })

    return {
      postId,
      title,
      url,
      excerpt,
      videoUrls: [s3Url],
      scripts:   [script],
    }
  } catch (err) {
    log({ lambda: 'youtube-shorts-generator', step: 'handler-error', status: 'error', pct: 0,
      meta: { error: String(err), postId } })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Script generation — Claude (scene-aware, 3 cinematic scenes + prompts)
// ─────────────────────────────────────────────────────────────────────────────
async function generateScript(title: string, content: string): Promise<ReelScript> {
  const truncatedContent = content.slice(0, 4000)

  const prompt = `You are a YouTube Shorts scriptwriter AND visual director for WealthBeginners, a personal finance channel for beginners.

Create ONE compelling YouTube Short script with exactly 3 cinematic scenes based on this blog post.

Blog title: ${title}
Blog content: ${truncatedContent}

NARRATION RULES:
- Total narration ≤ 55 words (fits ~20 seconds of speech with natural pauses)
- Scene 1 (hook, 6s): scroll-stopping opener that sparks immediate curiosity
- Scene 2 (body, 6s): the single most actionable insight from the post
- Scene 3 (cta, 6s): direct call-to-action → wealthbeginners.com

VISUAL PROMPT RULES (each scene prompt ≤ 150 chars, for Amazon Nova Reel AI):
- No people, no faces, no text overlays
- Cinematic camera motion: slow zoom, dolly, pan, tilt, particle reveal
- Color palette: deep navy #0B1628 background with gold #C9A84C accents
- Scene 1: dramatic gold coin/money reveal — fast zoom in, high energy motion
- Scene 2: sleek glowing chart/data animation — smooth slow pan, data points light up
- Scene 3: radiant gold light burst with particle explosion — brand identity reveal

Return ONLY valid JSON (no markdown, no code fences):
{
  "hook": "<hook narration>",
  "body": "<body narration>",
  "cta": "Full guide at wealthbeginners.com — link in description",
  "fullScript": "<hook>\\n\\n<body>\\n\\nFull guide at wealthbeginners.com — link in description",
  "scenes": [
    { "scene": "hook", "narration": "<hook narration>", "visualPrompt": "<≤150 char prompt>" },
    { "scene": "body", "narration": "<body narration>", "visualPrompt": "<≤150 char prompt>" },
    { "scene": "cta",  "narration": "Full guide at wealthbeginners.com — link in description", "visualPrompt": "<≤150 char prompt>" }
  ]
}`

  const command = new InvokeModelCommand({
    modelId:     CLAUDE_MODEL,
    contentType: 'application/json',
    accept:      'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const response = await bedrock.send(command)
  const body     = JSON.parse(new TextDecoder().decode(response.body))
  const text: string = body.content[0].text.trim()

  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed: ReelScript = JSON.parse(jsonText)

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length !== SCENE_COUNT) {
    throw new Error(`Claude returned ${parsed.scenes?.length ?? 0} scenes, expected ${SCENE_COUNT}`)
  }

  // Enforce canonical CTA
  parsed.cta = 'Full guide at wealthbeginners.com — link in description'
  parsed.scenes[2].narration = parsed.cta
  parsed.fullScript = `${parsed.hook}\n\n${parsed.body}\n\n${parsed.cta}`

  return parsed
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nova Reel — start async job (1280×720 native, enhanced cinematic prompt)
// ─────────────────────────────────────────────────────────────────────────────
async function startNovaReelJob(
  visualPrompt: string,
  bucket:       string,
  outputPrefix: string,
): Promise<string> {
  // Prepend quality booster — truncate at 512 chars (Nova Reel prompt cap)
  const enhancedPrompt = (
    `Ultra-cinematic 6-second personal finance motion graphic. ${visualPrompt} ` +
    'Photorealistic 4K quality, professional color grading, smooth 24fps motion, ' +
    'deep navy background, gold accents, premium financial brand aesthetic.'
  ).slice(0, 512)

  const command = new StartAsyncInvokeCommand({
    modelId: NOVA_REEL_MODEL,
    modelInput: {
      taskType: 'TEXT_VIDEO',
      textToVideoParams: {
        text: enhancedPrompt,
      },
      videoGenerationConfig: {
        durationSeconds: 6,
        fps:             24,
        dimension:       '1280x720',   // Nova Reel native — FFmpeg converts to 9:16
      },
    },
    outputDataConfig: {
      s3OutputDataConfig: {
        s3Uri: `s3://${bucket}/${outputPrefix}/`,
      },
    },
  })

  const response = await bedrock.send(command)
  if (!response.invocationArn) throw new Error('Nova Reel did not return an invocationArn')
  return response.invocationArn
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nova Reel — poll until Completed | Failed | timeout
// ─────────────────────────────────────────────────────────────────────────────
async function pollUntilComplete(invocationArn: string): Promise<string> {
  const deadline = Date.now() + MAX_POLL_MS

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    const command  = new GetAsyncInvokeCommand({ invocationArn })
    const response = await bedrock.send(command)
    const status   = response.status

    log({ lambda: 'youtube-shorts-generator', step: 'poll', status: 'start', pct: 50,
      meta: { status, arn: invocationArn.slice(-24) } })

    if (status === 'Completed') {
      const s3Uri = response.outputDataConfig?.s3OutputDataConfig?.s3Uri
      if (!s3Uri) throw new Error(`Nova Reel completed but returned no S3 URI: ${invocationArn}`)
      return s3Uri
    }

    if (status === 'Failed') {
      const reason = (response as any).failureMessage ?? 'unknown reason'
      throw new Error(`Nova Reel job failed: ${reason}`)
    }
    // InProgress — keep polling
  }

  throw new Error(`Nova Reel polling timed out (13 min) for ${invocationArn}`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  S3 → /tmp  (Nova Reel writes output.mp4 inside the prefix folder)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadS3ToLocal(outputFolderUri: string, localPath: string): Promise<void> {
  const withoutScheme = outputFolderUri.replace('s3://', '')
  const slashIdx  = withoutScheme.indexOf('/')
  const srcBucket = withoutScheme.slice(0, slashIdx)
  const srcPrefix = withoutScheme.slice(slashIdx + 1).replace(/\/$/, '')
  const srcKey    = `${srcPrefix}/output.mp4`

  const res    = await s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: srcKey }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as any) chunks.push(chunk)
  fs.writeFileSync(localPath, Buffer.concat(chunks))
}

// ─────────────────────────────────────────────────────────────────────────────
//  FFmpeg — convert 1280×720 landscape → 720×1280 portrait (blur-bars)
//
//  Layout (720×1280 canvas):
//    • Background: input stretched to 720×1280 → heavy box-blur (fills frame)
//    • Foreground: input scaled to 720×405 (sharp, aspect-preserved), centered
//      → overlayY = (1280 - 405) / 2 = 437 px from top
// ─────────────────────────────────────────────────────────────────────────────
function convertToVertical(inputPath: string, outputPath: string): void {
  const filterComplex = [
    '[0:v]scale=720:405[fg]',
    '[0:v]scale=720:1280,boxblur=luma_radius=25:luma_power=2[bg]',
    '[bg][fg]overlay=0:437',
  ].join(';')

  try {
    execFileSync(FFMPEG, [
      '-y',
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'fast',
      '-profile:v', 'high',
      '-level',    '4.0',
      '-pix_fmt',  'yuv420p',
      '-an',             // no audio in raw clips
      outputPath,
    ], { stdio: 'pipe' })
  } catch (err: any) {
    throw new Error(
      `FFmpeg vertical convert failed [${inputPath}]: ${err.stderr?.toString() ?? err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AWS Polly Neural TTS — fullScript → /tmp/narration.mp3
//  Voice  : Stephen (en-US Neural) — authoritative, warm, natural cadence
//  SSML   : 95% rate + +2% pitch + 450 ms paragraph breaks
// ─────────────────────────────────────────────────────────────────────────────
async function generateNarration(script: string, outputPath: string): Promise<void> {
  const ssml = buildNarrationSSML(script)

  const command = new SynthesizeSpeechCommand({
    Engine:       'neural',
    VoiceId:      'Stephen',
    LanguageCode: 'en-US',
    OutputFormat: 'mp3',
    TextType:     'ssml',
    Text:         ssml,
    SampleRate:   '44100',
  } as any)  // cast to bypass strict enum typing — string values are valid at runtime

  const response = await polly.send(command)
  if (!response.AudioStream) throw new Error('Polly returned no audio stream')

  const chunks: Uint8Array[] = []
  for await (const chunk of response.AudioStream as any) chunks.push(chunk)
  fs.writeFileSync(outputPath, Buffer.concat(chunks))
}

function buildNarrationSSML(script: string): string {
  const escaped = script
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><break time="450ms"/><p>')
    .replace(/\n/g, ' ')

  return (
    '<speak>' +
      '<prosody rate="95%">' +        // pitch not supported by Polly Neural voices
        `<p>${escaped}</p>` +
      '</prosody>' +
    '</speak>'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  FFmpeg — final assembly pipeline
//
//  1. Concat list → combined.mp4  (3 × 6s = 18s, silent, 720×1280)
//  2. Loop combined.mp4 + mux Polly narration audio → final.mp4
//     -stream_loop -1 : loops video infinitely
//     -shortest       : stop when narration audio ends (~20s)
//     CRF 18 / aac 192k / yuv420p / faststart = broadcast-quality YouTube Short
// ─────────────────────────────────────────────────────────────────────────────
function assembleShort(
  clipPaths:     string[],
  narrationPath: string,
  outputPath:    string,
): void {
  const combinedPath = '/tmp/combined.mp4'
  const filelistPath = '/tmp/filelist.txt'

  // ── 1. Write concat list & join vertical clips ──────────────────────────
  fs.writeFileSync(filelistPath, clipPaths.map(p => `file '${p}'`).join('\n'))

  try {
    execFileSync(FFMPEG, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', filelistPath,
      '-c', 'copy',
      combinedPath,
    ], { stdio: 'pipe' })
  } catch (err: any) {
    throw new Error(`FFmpeg concat failed: ${err.stderr?.toString() ?? err.message}`)
  }

  // ── 2. Loop video + mux narration → final Short ─────────────────────────
  try {
    execFileSync(FFMPEG, [
      '-y',
      '-stream_loop', '-1',        // infinite video loop
      '-i', combinedPath,
      '-i', narrationPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'libx264',
      '-crf', '18',                // visually lossless quality
      '-preset', 'fast',
      '-profile:v', 'high',
      '-level',    '4.0',
      '-pix_fmt',  'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',              // broadcast audio quality
      '-ar', '44100',
      '-shortest',                 // stop at end of narration
      '-movflags', '+faststart',   // YouTube streaming optimisation
      outputPath,
    ], { stdio: 'pipe' })
  } catch (err: any) {
    throw new Error(`FFmpeg mux failed: ${err.stderr?.toString() ?? err.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function cleanupTmp(paths: string[]): void {
  for (const p of paths) {
    try { fs.unlinkSync(p) } catch { /* ignore */ }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
