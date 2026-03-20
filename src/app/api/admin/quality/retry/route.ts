import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'

function unauth() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const credentials = process.env.APP_KEY_ID
  ? { accessKeyId: process.env.APP_KEY_ID!, secretAccessKey: process.env.APP_KEY_SECRET! }
  : undefined

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_API_KEY) return unauth()

  const body = await req.json() as { postId?: string }
  const { postId } = body

  if (!postId) {
    return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, status: true } })
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Post is not in REJECTED status' }, { status: 400 })
  }

  // Reset the post to DRAFT so it can be retried
  await prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT' } })

  // Optionally trigger the pipeline if STATE_MACHINE_ARN is set
  const stateMachineArn = process.env.STATE_MACHINE_ARN
  if (stateMachineArn) {
    try {
      const sfn = new SFNClient({ region: process.env.REGION ?? 'us-east-1', credentials })
      await sfn.send(new StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify({ postId, retry: true }),
        name: `retry-${postId}-${Date.now()}`,
      }))
    } catch (err) {
      console.error('[quality/retry] SFN start failed', err)
      // Non-fatal: post is already reset to DRAFT
    }
  }

  return NextResponse.json({ ok: true, postId })
}
