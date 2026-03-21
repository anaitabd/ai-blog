// ──────────────────────────────────────────────────────────────────────────
//  YouTube Shorts Generator — Cinematic 9-Scene Pipeline
//  Step 0 : Background music  (Pixabay API -> S3 fallback -> silence)
//  Step 1 : 9-scene script    (Claude)
//  Step 2 : Avatar image      (Nova Canvas 768x1024 -> FFmpeg vignette)
//  Step 3 : Per-scene audio   (Polly Neural Stephen, SSML prosody, loudnorm)
//  Step 4 : Per-scene visual  (Nova Reel v1:1 | Nova Canvas | FFmpeg avatar)
//  Step 5 : Text overlays     (FFmpeg drawtext - branding + dynamic copy)
//  Step 6 : Mux audio         (FFmpeg apad -> muxed-{id}.mp4)
//  Step 7 : xfade + assemble  (720x1280, 60fps, CRF 14, AAC 192k)
//  Step 8 : ffprobe validation (codec / resolution / duration checks)
//  Step 9 : Upload to SHORTS_BUCKET
//  Lambda timeout: 25 min   Memory: 10240 MB   /tmp: 10240 MB
// ──────────────────────────────────────────────────────────────────────────

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
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { execFileSync } from 'child_process'
import * as fs    from 'fs'
import * as https from 'https'
import { log } from '../shared/logger'

// --- AWS clients --------------------------------------------------------------
const REGION  = process.env.AWS_REGION ?? 'us-east-1'
const bedrock = new BedrockRuntimeClient({ region: REGION })
const s3      = new S3Client({ region: REGION })
const polly   = new PollyClient({ region: REGION })

// --- Constants ----------------------------------------------------------------
const NOVA_REEL_MODEL   = process.env.NOVA_REEL_MODEL   ?? 'amazon.nova-reel-v1:1'
const NOVA_CANVAS_MODEL = process.env.NOVA_CANVAS_MODEL ?? 'amazon.nova-canvas-v1:0'
const CLAUDE_MODEL      = process.env.BEDROCK_MODEL_ID  ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const POLLY_VOICE_ID    = (process.env.POLLY_VOICE_ID   ?? 'Stephen') as 'Stephen'
const FFMPEG            = process.env.FFMPEG_PATH        ?? '/opt/bin/ffmpeg'
const FFPROBE           = '/opt/bin/ffprobe'
const POLL_INTERVAL_MS  = 12_000
const MAX_POLL_MS       = 15 * 60 * 1000

// --- Types -------------------------------------------------------------------
interface GeneratorEvent {
  postId:   string
  title:    string
  content:  string
  url:      string
  excerpt:  string
}

type SceneType   = 'motion_graphic' | 'avatar' | 'infographic'
type MusicSource = 'pixabay' | 's3_fallback' | 'silent_fallback'

interface Scene {
  id:              string
  type:            SceneType
  durationSeconds: number
  narration:       string
  visualPrompt?:   string
  overlayText?:    string
  overlaySubtext?: string
  stat?:           string
  statLabel?:      string
}

interface ScriptResult {
  videoTitle:       string
  videoDescription: string
  videoTags:        string[]
  scenes:           Scene[]
}

// --- Handler -----------------------------------------------------------------
export const handler = async (event: GeneratorEvent) => {
  const { postId, title, content, url, excerpt } = event

  log({ lambda: 'youtube-shorts-generator', step: 'handler-start', status: 'start', pct: 0,
    meta: { postId, title } })

  const shortsBucket  = process.env.SHORTS_BUCKET!
  const assetsBucket  = process.env.ASSETS_BUCKET!
  const reelBucket    = process.env.S3_BUCKET!
  const pipelineStart = Date.now()

  log({ lambda: 'youtube-shorts-generator', step: 'step0-music',  status: 'start', pct: 3 })
  log({ lambda: 'youtube-shorts-generator', step: 'step1-script', status: 'start', pct: 5 })

  let musicSource: MusicSource = 'silent_fallback'
  const musicTmpPath = '/tmp/bg-music.mp3'

  const [script] = await Promise.all([
    generateScript(title, content, excerpt, url),
    fetchBackgroundMusic(assetsBucket, musicTmpPath).then(src => { musicSource = src }),
  ])

  log({ lambda: 'youtube-shorts-generator', step: 'step1-script', status: 'complete', pct: 20,
    meta: { sceneCount: script.scenes.length, musicSource } })

  log({ lambda: 'youtube-shorts-generator', step: 'step2-avatar', status: 'start', pct: 22 })
  await generateAvatarImage(title)
  log({ lambda: 'youtube-shorts-generator', step: 'step2-avatar', status: 'complete', pct: 28 })

  log({ lambda: 'youtube-shorts-generator', step: 'step3-audio', status: 'start', pct: 30 })
  await Promise.all(script.scenes.map(s => generateSceneAudio(s)))
  log({ lambda: 'youtube-shorts-generator', step: 'step3-audio', status: 'complete', pct: 42 })

  log({ lambda: 'youtube-shorts-generator', step: 'step4-visual', status: 'start', pct: 44 })
  await generateAllVisuals(script.scenes, reelBucket)
  log({ lambda: 'youtube-shorts-generator', step: 'step4-visual', status: 'complete', pct: 70 })

  log({ lambda: 'youtube-shorts-generator', step: 'step5-overlay', status: 'start', pct: 72 })
  for (const scene of script.scenes) { addTextOverlays(scene) }
  log({ lambda: 'youtube-shorts-generator', step: 'step5-overlay', status: 'complete', pct: 78 })

  log({ lambda: 'youtube-shorts-generator', step: 'step6-mux', status: 'start', pct: 80 })
  for (const scene of script.scenes) { muxSceneAudio(scene) }
  log({ lambda: 'youtube-shorts-generator', step: 'step6-mux', status: 'complete', pct: 84 })

  log({ lambda: 'youtube-shorts-generator', step: 'step7-assemble', status: 'start', pct: 86 })
  const finalPath = '/tmp/final.mp4'
  assembleFinal(script.scenes, musicTmpPath, musicSource, finalPath)
  log({ lambda: 'youtube-shorts-generator', step: 'step7-assemble', status: 'complete', pct: 92 })

  log({ lambda: 'youtube-shorts-generator', step: 'step8-validate', status: 'start', pct: 93 })
  validateOutput(finalPath)
  log({ lambda: 'youtube-shorts-generator', step: 'step8-validate', status: 'complete', pct: 95 })

  log({ lambda: 'youtube-shorts-generator', step: 'step9-upload', status: 'start', pct: 96 })
  const timestamp = Date.now()
  const s3Key     = `shorts/${postId}/${timestamp}-final.mp4`
  await uploadToS3(finalPath, shortsBucket, s3Key, script)
  log({ lambda: 'youtube-shorts-generator', step: 'step9-upload', status: 'complete', pct: 100,
    meta: { s3Key } })

  const totalPipelineDurationMs = Date.now() - pipelineStart
  log({ lambda: 'youtube-shorts-generator', step: 'complete', status: 'complete', pct: 100,
    meta: { postId, s3Key, totalPipelineDurationMs, musicSource } })

  return {
    s3Key,
    videoTitle:       script.videoTitle,
    videoDescription: script.videoDescription,
    videoTags:        script.videoTags,
    sceneSummary:     script.scenes.map(s => ({ id: s.id, type: s.type, durationSeconds: s.durationSeconds })),
    totalPipelineDurationMs,
  }
}

// --- STEP 0: Background music ------------------------------------------------
async function fetchBackgroundMusic(assetsBucket: string, tmpPath: string): Promise<MusicSource> {
  const pixabayKey = process.env.PIXABAY_API_KEY

  if (pixabayKey) {
    try {
      const apiUrl = `https://pixabay.com/api/music/?key=${encodeURIComponent(pixabayKey)}&mood=corporate&category=corporate&per_page=3`
      const tracks = await httpGetJson<{ hits: Array<{ audio: string }> }>(apiUrl)
      const track  = tracks.hits?.[0]?.audio
      if (track) {
        await downloadHttpToFile(track, tmpPath)
        log({ lambda: 'youtube-shorts-generator', step: 'step0-music', status: 'complete', pct: 6,
          meta: { source: 'pixabay' } })
        return 'pixabay'
      }
    } catch (e) {
      log({ lambda: 'youtube-shorts-generator', step: 'step0-music', status: 'warn', pct: 6,
        meta: { error: String(e), fallback: 's3' } })
    }
  }

  try {
    const res    = await s3.send(new GetObjectCommand({ Bucket: assetsBucket, Key: 'bg-music-finance.mp3' }))
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as any) chunks.push(chunk)
    fs.writeFileSync(tmpPath, Buffer.concat(chunks))
    log({ lambda: 'youtube-shorts-generator', step: 'step0-music', status: 'complete', pct: 6,
      meta: { source: 's3_fallback' } })
    return 's3_fallback'
  } catch (e) {
    log({ lambda: 'youtube-shorts-generator', step: 'step0-music', status: 'warn', pct: 6,
      meta: { error: String(e), fallback: 'silence' } })
  }

  runFFmpeg(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '65', '-q:a', '0', tmpPath], 'silence-gen')
  return 'silent_fallback'
}

// --- STEP 1: Script generation (Claude) --------------------------------------
async function generateScript(title: string, content: string, excerpt: string, url: string): Promise<ScriptResult> {
  const contentSnippet = content.replace(/<[^>]+>/g, '').slice(0, 1500)

  const prompt = `You are a professional short-form video scriptwriter for financial education YouTube Shorts.

Create a 9-scene script for a 60-second YouTube Short about: "${title}"

Article excerpt: ${excerpt}
Key content: ${contentSnippet}
Article URL: ${url}

CRITICAL rules:
- Exactly 9 scenes with these IDs and types (total MUST be 55-65 seconds):
  1. hook (7s) -- motion_graphic -- attention-grabbing question or stat
  2. avatar_intro (6s) -- avatar -- presenter introduces the topic
  3. problem (6s) -- motion_graphic -- relatable pain point
  4. stat1 (6s) -- infographic -- compelling statistic with number
  5. tip1 (6s) -- motion_graphic -- first actionable tip
  6. tip2 (6s) -- motion_graphic -- second actionable tip
  7. avatar_tip (7s) -- avatar -- presenter shares insider knowledge
  8. proof (6s) -- infographic -- social proof or result statistic
  9. cta (6s) -- motion_graphic -- CTA ending with "Full guide at wealthbeginners.com"
- Each narration: max 35 words, natural spoken cadence
- visualPrompt (motion_graphic/infographic only): max 80 words, photorealistic
- overlayText: concise headline (max 6 words)
- overlaySubtext: supporting line (max 10 words)
- stat/statLabel for infographic scenes only
- CTA narration MUST end with: "Full guide at wealthbeginners.com -- link in description"

Return ONLY valid JSON (no markdown):
{
  "videoTitle": "string (70 chars max)",
  "videoDescription": "string (2-3 sentences, include wealthbeginners.com URL)",
  "videoTags": ["8-12 relevant tags"],
  "scenes": [{"id":"hook","type":"motion_graphic","durationSeconds":7,"narration":"...","visualPrompt":"...","overlayText":"...","overlaySubtext":"..."}]
}`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await bedrock.send(new InvokeModelCommand({
        modelId:     CLAUDE_MODEL,
        contentType: 'application/json',
        accept:      'application/json',
        body:        JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens:        2000,
          messages:          [{ role: 'user', content: prompt }],
        }),
      }))

      const raw    = JSON.parse(Buffer.from(response.body).toString())
      const text   = raw.content?.[0]?.text ?? ''
      const parsed = JSON.parse(text) as ScriptResult

      if (!parsed.scenes || parsed.scenes.length !== 9) throw new Error(`Expected 9 scenes, got ${parsed.scenes?.length}`)
      const totalDuration = parsed.scenes.reduce((a, s) => a + s.durationSeconds, 0)
      if (totalDuration < 55 || totalDuration > 65) throw new Error(`Total duration ${totalDuration}s out of 55-65s range`)

      const cta = parsed.scenes[8]
      if (!cta.narration.includes('wealthbeginners.com')) {
        cta.narration = `${cta.narration.replace(/\.$/, '')}. Full guide at wealthbeginners.com -- link in description`
      }
      return parsed
    } catch (err) {
      if (attempt === 1) throw new Error(`Script generation failed after 2 attempts: ${err}`)
      log({ lambda: 'youtube-shorts-generator', step: 'step1-script', status: 'warn', pct: 10, meta: { attempt, error: String(err) } })
    }
  }
  throw new Error('generateScript: unreachable')
}

// --- STEP 2: Avatar image (Nova Canvas) --------------------------------------
async function generateAvatarImage(title: string): Promise<void> {
  const avatarPrompt = (
    'Professional financial advisor, friendly and trustworthy, smart casual attire, ' +
    'clean dark navy background, confident relaxed smile, direct eye contact with camera, ' +
    `photorealistic portrait, soft studio lighting, 8K ultra-sharp. Topic: ${title.slice(0, 50)}`
  ).slice(0, 512)

  const response = await bedrock.send(new InvokeModelCommand({
    modelId:     NOVA_CANVAS_MODEL,
    contentType: 'application/json',
    accept:      'application/json',
    body:        JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: avatarPrompt,
        negativeText: 'cartoon, anime, illustration, blurry, text, watermark, logo, extra fingers',
      },
      imageGenerationConfig: { width: 768, height: 1024, cfgScale: 8.0, quality: 'premium', numberOfImages: 1 },
    }),
  }))

  const body = JSON.parse(Buffer.from(response.body).toString())
  const b64  = body.images?.[0]
  if (!b64) throw new Error('Nova Canvas avatar returned no image')

  const rawPath = '/tmp/avatar-raw.png'
  fs.writeFileSync(rawPath, Buffer.from(b64, 'base64'))

  runFFmpeg(['-y', '-i', rawPath, '-vf', 'scale=480:640,vignette=PI/5', '-compression_level', '6', '/tmp/avatar.png'], 'avatar-postprocess')

  // Gold glow ring 520x520 PNG using geq filter
  runFFmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:size=520x520:rate=1',
    '-vf', [
      "geq=r='if(gt(hypot(X-260\,Y-260)\,240)*lt(hypot(X-260\,Y-260)\,260)\,201\,0)'",
      "g='if(gt(hypot(X-260\,Y-260)\,240)*lt(hypot(X-260\,Y-260)\,260)\,169\,0)'",
      "b='if(gt(hypot(X-260\,Y-260)\,240)*lt(hypot(X-260\,Y-260)\,260)\,76\,0)'",
      "a='if(gt(hypot(X-260\,Y-260)\,240)*lt(hypot(X-260\,Y-260)\,260)\,255\,0)'",
    ].join(':'),
    '-frames:v', '1', '/tmp/glow-ring.png',
  ], 'glow-ring-gen')
}

// --- STEP 3: Per-scene Polly TTS ---------------------------------------------
async function generateSceneAudio(scene: Scene): Promise<void> {
  const ssml    = buildSceneSSML(scene.narration, scene.type)
  const rawPath = `/tmp/audio-${scene.id}-raw.mp3`
  const outPath = `/tmp/audio-${scene.id}-processed.mp3`

  const response = await polly.send(new SynthesizeSpeechCommand({
    Engine: 'neural', VoiceId: POLLY_VOICE_ID, LanguageCode: 'en-US',
    OutputFormat: 'mp3', TextType: 'ssml', Text: ssml, SampleRate: '24000',
  } as any))

  if (!response.AudioStream) throw new Error(`Polly returned no audio for scene ${scene.id}`)
  const chunks: Uint8Array[] = []
  for await (const chunk of response.AudioStream as any) chunks.push(chunk)
  fs.writeFileSync(rawPath, Buffer.concat(chunks))

  runFFmpeg(['-y', '-i', rawPath, '-af', 'loudnorm=I=-14:TP=-1:LRA=7,aecho=0.8:0.88:60:0.4', '-ar', '44100', outPath], `audio-process-${scene.id}`)
}

function buildSceneSSML(narration: string, type: SceneType): string {
  const escaped = narration.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rate    = type === 'motion_graphic' ? '95%' : '90%'
  const pitch   = type === 'avatar'         ? 'medium' : 'low'
  return `<speak><prosody rate="${rate}" pitch="${pitch}"><p>${escaped}</p></prosody></speak>`
}

// --- STEP 4: Visual content per scene ----------------------------------------
async function generateAllVisuals(scenes: Scene[], reelBucket: string): Promise<void> {
  const reelScenes   = scenes.filter(s => s.type === 'motion_graphic')
  const canvasScenes = scenes.filter(s => s.type === 'infographic')
  const avatarScenes = scenes.filter(s => s.type === 'avatar')

  // Fire all Nova Reel jobs first (concurrent), then do Canvas + Avatar while polling
  const reelArns = await Promise.all(
    reelScenes.map(s => startNovaReelJob(s.visualPrompt ?? s.narration, reelBucket, `reel/${s.id}-${Date.now()}`))
  )

  await Promise.all(canvasScenes.map(s => generateInfographic(s)))
  for (const scene of avatarScenes) { generateAvatarScene(scene) }

  const reelOutputUris = await Promise.all(reelArns.map(arn => pollUntilComplete(arn)))

  await Promise.all(
    reelScenes.map(async (scene, i) => {
      const rawPath  = `/tmp/reel-raw-${scene.id}.mp4`
      const vertPath = `/tmp/visual-${scene.id}.mp4`
      await downloadS3ToLocal(reelOutputUris[i], rawPath)
      convertToVertical(rawPath, vertPath, scene.durationSeconds)
    })
  )
}

async function startNovaReelJob(visualPrompt: string, bucket: string, outputPrefix: string): Promise<string> {
  const enhancedPrompt = (
    `Ultra-cinematic personal finance short-form video. ${visualPrompt} ` +
    'Dark navy background #0B1628, gold accents #C9A84C, professional typography, smooth motion.'
  ).slice(0, 512)

  const response = await bedrock.send(new StartAsyncInvokeCommand({
    modelId: NOVA_REEL_MODEL,
    modelInput: {
      taskType: 'TEXT_VIDEO',
      textToVideoParams: { text: enhancedPrompt },
      videoGenerationConfig: { durationSeconds: 6, fps: 24, dimension: '1280x720' },
    },
    outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${bucket}/${outputPrefix}/` } },
  }))

  if (!response.invocationArn) throw new Error('Nova Reel did not return invocationArn')
  return response.invocationArn
}

async function pollUntilComplete(invocationArn: string): Promise<string> {
  const deadline = Date.now() + MAX_POLL_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const response = await bedrock.send(new GetAsyncInvokeCommand({ invocationArn }))
    const status   = response.status
    log({ lambda: 'youtube-shorts-generator', step: 'reel-poll', status: 'start', pct: 60,
      meta: { status, arn: invocationArn.slice(-24) } })
    if (status === 'Completed') {
      const s3Uri = response.outputDataConfig?.s3OutputDataConfig?.s3Uri
      if (!s3Uri) throw new Error(`Nova Reel completed but no S3 URI: ${invocationArn}`)
      return s3Uri
    }
    if (status === 'Failed') throw new Error(`Nova Reel job failed: ${(response as any).failureMessage ?? 'unknown'}`)
  }
  throw new Error(`Nova Reel polling timed out (15 min) for ${invocationArn}`)
}

async function downloadS3ToLocal(outputFolderUri: string, localPath: string): Promise<void> {
  const withoutScheme = outputFolderUri.replace('s3://', '')
  const slashIdx      = withoutScheme.indexOf('/')
  const srcBucket     = withoutScheme.slice(0, slashIdx)
  const srcKey        = `${withoutScheme.slice(slashIdx + 1).replace(/\/$/,'')}/output.mp4`
  const res           = await s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: srcKey }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as any) chunks.push(chunk)
  fs.writeFileSync(localPath, Buffer.concat(chunks))
}

function convertToVertical(inputPath: string, outputPath: string, durationSeconds: number): void {
  runFFmpeg([
    '-y', '-i', inputPath, '-t', String(durationSeconds),
    '-filter_complex', '[0:v]scale=720:405[fg];[0:v]scale=720:1280,boxblur=luma_radius=25:luma_power=2[bg];[bg][fg]overlay=0:437',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-r', '60', '-an',
    outputPath,
  ], `convert-vertical-${inputPath.slice(-20)}`)
}

async function generateInfographic(scene: Scene): Promise<void> {
  const textContent = [scene.visualPrompt ?? '', scene.stat ? `Key stat: ${scene.stat} ${scene.statLabel ?? ''}` : ''].filter(Boolean).join('. ')
  const imgPrompt   = (`Clean financial infographic, dark navy #0B1628 background, gold accent #C9A84C, modern typography, ${textContent}. No embedded text.`).slice(0, 512)

  const response = await bedrock.send(new InvokeModelCommand({
    modelId:     NOVA_CANVAS_MODEL,
    contentType: 'application/json',
    accept:      'application/json',
    body:        JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: { text: imgPrompt, negativeText: 'cartoon, watermark, blurry, text' },
      imageGenerationConfig: { width: 720, height: 1280, cfgScale: 7.5, quality: 'premium', numberOfImages: 1 },
    }),
  }))

  const body = JSON.parse(Buffer.from(response.body).toString())
  const b64  = body.images?.[0]
  if (!b64) throw new Error(`Nova Canvas returned no image for scene ${scene.id}`)
  const rawPath = `/tmp/infographic-${scene.id}.png`
  fs.writeFileSync(rawPath, Buffer.from(b64, 'base64'))

  runFFmpeg([
    '-y', '-loop', '1', '-i', rawPath,
    '-vf', `scale=8000:-1,zoompan=z='min(zoom+0.0008,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${scene.durationSeconds * 60}:s=720x1280:fps=60`,
    '-t', String(scene.durationSeconds), '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-an',
    `/tmp/visual-${scene.id}.mp4`,
  ], `infographic-kenburns-${scene.id}`)
}

function generateAvatarScene(scene: Scene): void {
  const duration = scene.durationSeconds
  runFFmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'color=c=0x0B1628:size=720x1280:rate=60',
    '-loop', '1', '-i', '/tmp/avatar.png',
    '-loop', '1', '-i', '/tmp/glow-ring.png',
    '-filter_complex', [
      '[1:v]scale=480:640[avatar]',
      '[2:v]scale=520:520[ring]',
      '[0:v]setpts=PTS-STARTPTS[bg]',
      '[bg][ring]overlay=100:380[bgring]',
      '[bgring][avatar]overlay=120:320[composed]',
      `[composed]zoompan=z='1.0+0.012*sin(t*2*PI/3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * 60}:s=720x1280:fps=60[final]`,
    ].join(';'),
    '-map', '[final]', '-t', String(duration),
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-an',
    `/tmp/visual-${scene.id}.mp4`,
  ], `avatar-scene-${scene.id}`)
}

// --- STEP 5: Text overlays ---------------------------------------------------
function addTextOverlays(scene: Scene): void {
  const inputPath  = `/tmp/visual-${scene.id}.mp4`
  const outputPath = `/tmp/overlay-${scene.id}.mp4`
  const duration   = scene.durationSeconds
  const filters: string[] = []

  filters.push(
    'drawbox=x=0:y=0:w=720:h=80:color=0x0B1628@0.9:t=fill',
    "drawtext=text='WealthBeginners.com':x=(w-text_w)/2:y=25:fontsize=22:fontcolor=0xC9A84C:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:shadowx=1:shadowy=1:shadowcolor=black",
    'drawbox=x=0:y=1200:w=720:h=80:color=0x0B1628@0.9:t=fill',
    "drawtext=text='Link in description':x=(w-text_w)/2:y=1220:fontsize=20:fontcolor=white:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  )

  if (scene.overlayText) {
    const safe = scene.overlayText.replace(/'/g, "\\'").replace(/:/g, '\\:')
    filters.push(
      'drawbox=x=0:y=500:w=720:h=100:color=0xC9A84C@0.85:t=fill',
      `drawtext=text='${safe}':x=(w-text_w)/2:y=530:fontsize=36:fontcolor=0x0B1628:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`,
    )
  }

  if (scene.overlaySubtext) {
    const safe = scene.overlaySubtext.replace(/'/g, "\\'").replace(/:/g, '\\:')
    filters.push(`drawtext=text='${safe}':x=(w-text_w)/2:y=625:fontsize=26:fontcolor=white:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:box=1:boxcolor=black@0.5:boxborderw=8`)
  }

  if (scene.stat && scene.statLabel) {
    const safeStat  = scene.stat.replace(/'/g, "\\'").replace(/:/g, '\\:')
    const safeLabel = scene.statLabel.replace(/'/g, "\\'").replace(/:/g, '\\:')
    filters.push(
      'drawbox=x=60:y=750:w=600:h=170:color=0x0B1628@0.85:t=fill',
      `drawtext=text='${safeStat}':x=(w-text_w)/2:y=775:fontsize=72:fontcolor=0xC9A84C:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`,
      `drawtext=text='${safeLabel}':x=(w-text_w)/2:y=875:fontsize=24:fontcolor=white:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`,
    )
  }

  runFFmpeg([
    '-y', '-i', inputPath, '-vf', filters.join(','),
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-an', '-t', String(duration),
    outputPath,
  ], `overlay-${scene.id}`)
}

// --- STEP 6: Mux audio per scene ---------------------------------------------
function muxSceneAudio(scene: Scene): void {
  runFFmpeg([
    '-y',
    '-i', `/tmp/overlay-${scene.id}.mp4`,
    '-i', `/tmp/audio-${scene.id}-processed.mp3`,
    '-filter_complex', `[1:a]apad=whole_dur=${scene.durationSeconds}[aout]`,
    '-map', '0:v', '-map', '[aout]',
    '-t', String(scene.durationSeconds),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    `/tmp/muxed-${scene.id}.mp4`,
  ], `mux-${scene.id}`)
}

// --- STEP 7: xfade + final assembly ------------------------------------------
function assembleFinal(scenes: Scene[], musicPath: string, _musicSource: MusicSource, outputPath: string): void {
  const TRANSITIONS    = ['fade', 'slideleft', 'slideup', 'dissolve', 'wipeleft', 'fadeblack', 'slideleft', 'dissolve']
  const TRANSITION_DUR = 0.5

  const inputArgs: string[] = []
  for (const scene of scenes) { inputArgs.push('-i', `/tmp/muxed-${scene.id}.mp4`) }
  const musicIdx = scenes.length
  inputArgs.push('-i', musicPath)

  const durations    = scenes.map(s => s.durationSeconds)
  const filterLines: string[] = []

  let prevVLabel = '[0:v]'
  for (let i = 0; i < scenes.length - 1; i++) {
    const offset     = durations.slice(0, i + 1).reduce((a, b) => a + b, 0) - (i + 1) * TRANSITION_DUR
    const transition = TRANSITIONS[i] ?? 'fade'
    const outLabel   = i === scenes.length - 2 ? '[vout]' : `[v${i + 1}]`
    filterLines.push(`${prevVLabel}[${i + 1}:v]xfade=transition=${transition}:duration=${TRANSITION_DUR}:offset=${offset.toFixed(3)}${outLabel}`)
    prevVLabel = outLabel
  }

  filterLines.push(`${scenes.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${scenes.length}:duration=longest[amixed]`)
  filterLines.push(`[${musicIdx}:a]volume=0.09,afade=t=in:st=0:d=3,afade=t=out:st=56:d=4[music]`)
  filterLines.push('[amixed][music]amix=inputs=2:duration=longest[aout]')

  runFFmpeg([
    '-y', ...inputArgs,
    '-filter_complex', filterLines.join(';\n'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-r', '60', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart',
    outputPath,
  ], 'final-assemble')
}

// --- STEP 8: ffprobe validation -----------------------------------------------
function validateOutput(filePath: string): void {
  let probeOutput: string
  try {
    probeOutput = execFileSync(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath], { stdio: 'pipe' }).toString()
  } catch (err: any) {
    throw new Error(`ffprobe failed: ${err.stderr?.toString() ?? err.message}`)
  }
  const probe       = JSON.parse(probeOutput)
  const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video')
  const duration    = parseFloat(probe.format?.duration ?? '0')
  if (!videoStream)                   throw new Error('Validation: no video stream')
  const { codec_name, width, height } = videoStream
  if (codec_name !== 'h264')          throw new Error(`Validation: expected h264, got ${codec_name}`)
  if (width !== 720 || height !== 1280) throw new Error(`Validation: expected 720x1280, got ${width}x${height}`)
  if (duration < 50 || duration > 70)   throw new Error(`Validation: duration ${duration}s out of range`)
  log({ lambda: 'youtube-shorts-generator', step: 'step8-validate', status: 'complete', pct: 95,
    meta: { codec_name, width, height, duration } })
}

// --- STEP 9: Upload to SHORTS_BUCKET -----------------------------------------
async function uploadToS3(filePath: string, bucket: string, key: string, script: ScriptResult): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath)
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        fileBuffer,
    ContentType: 'video/mp4',
    Metadata: {
      videoTitle:       script.videoTitle,
      videoDescription: script.videoDescription.slice(0, 256),
      videoTags:        script.videoTags.join(','),
    },
  }))
}

// --- Helpers -----------------------------------------------------------------
function runFFmpeg(args: string[], label = 'ffmpeg'): void {
  try {
    execFileSync(FFMPEG, args, { stdio: 'pipe' })
  } catch (err: any) {
    throw new Error(`FFmpeg [${label}] failed: ${err.stderr?.toString().slice(0, 500) ?? err.message}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function httpGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('HTTP timeout')) })
  })
}

function downloadHttpToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const req  = https.get(url, res => {
      if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    })
    req.on('error', err => { file.close(); reject(err) })
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Download timeout')) })
  })
}
