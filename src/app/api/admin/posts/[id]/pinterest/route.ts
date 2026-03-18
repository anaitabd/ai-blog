import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify webhook secret (called by Lambda, not user)
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pinterestPinId, pinterestPinUrl, pinterestImage, pinterestPinnedAt } = await req.json()

  // Validate required fields
  if (!pinterestPinId || !pinterestPinUrl || !pinterestPinnedAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const pinnedAt = new Date(pinterestPinnedAt)
  if (isNaN(pinnedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid pinterestPinnedAt date' }, { status: 400 })
  }

  await prisma.post.update({
    where: { id: params.id },
    data: {
      pinterestPinId,
      pinterestPinUrl,
      pinterestImage: pinterestImage ?? null,
      pinterestPinnedAt: pinnedAt,
    },
  })

  return NextResponse.json({ success: true })
}
