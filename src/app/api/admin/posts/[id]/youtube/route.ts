import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function adminAuth(req: NextRequest): boolean {
  return req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY
}

// ─── GET — list all YouTube Shorts for a post ─────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shorts = await prisma.youtubeShort.findMany({
    where:   { postId: params.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ shorts })
}

// ─── PATCH — update caption or script ────────────────────────────────────────
const PatchSchema = z.object({
  id:      z.string().min(1),
  caption: z.string().optional(),
  script:  z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id, caption, script } = parsed.data

  const updated = await prisma.youtubeShort.updateMany({
    where: { id, postId: params.id },
    data:  {
      ...(caption !== undefined ? { caption } : {}),
      ...(script  !== undefined ? { script }  : {}),
    },
  })

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Short not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

// ─── DELETE — remove a YouTube Short record ───────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const shortId = searchParams.get('shortId')
  if (!shortId) return NextResponse.json({ error: 'Missing ?shortId=' }, { status: 400 })

  const deleted = await prisma.youtubeShort.deleteMany({
    where: { id: shortId, postId: params.id },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Short not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
