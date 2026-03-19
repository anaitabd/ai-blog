import { NextRequest, NextResponse } from 'next/server'
import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
} from '@aws-sdk/client-sfn'
import { prisma } from '@/lib/prisma'

const REGION = process.env.REGION ?? 'us-east-1'
const _creds = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined
const sfn = new SFNClient({ region: REGION, ...(_creds && { credentials: _creds }) })

function adminAuth(req: NextRequest) {
  return req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY
}

// ─── POST — start generation + publish ───────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const arn = process.env.YOUTUBE_ON_DEMAND_ARN
  if (!arn) return NextResponse.json({ error: 'YOUTUBE_ON_DEMAND_ARN not configured' }, { status: 500 })

  const post = await prisma.post.findUnique({
    where:  { id: params.id },
    select: { id: true, title: true, content: true, excerpt: true, slug: true },
  })
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wealthbeginners.com'

  const execution = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: arn,
      name:  `yt-admin-${params.id}-${Date.now()}`,
      input: JSON.stringify({
        postId:  post.id,
        title:   post.title,
        content: post.content,
        url:     `${siteUrl}/${post.slug}`,
        excerpt: post.excerpt,
      }),
    }),
  )

  return NextResponse.json({ success: true, executionArn: execution.executionArn })
}

// ─── GET — poll execution status ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params: _params }: { params: { id: string } },
) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const executionArn = new URL(req.url).searchParams.get('executionArn')
  if (!executionArn) return NextResponse.json({ error: 'Missing executionArn' }, { status: 400 })

  const result = await sfn.send(new DescribeExecutionCommand({ executionArn }))

  return NextResponse.json({
    status:    result.status,   // RUNNING | SUCCEEDED | FAILED | TIMED_OUT | ABORTED
    startDate: result.startDate,
    stopDate:  result.stopDate,
  })
}

