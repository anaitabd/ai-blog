import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { status } = await req.json()

  if (!['PUBLISHED', 'REJECTED', 'DRAFT'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const post = await prisma.post.update({
    where: { id: params.id },
    data: {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    },
  })

  revalidatePath('/')
  revalidatePath(`/${post.slug}`)
  revalidatePath('/sitemap.xml')

  return NextResponse.json({ success: true, post })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = req.headers.get('x-admin-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.post.delete({ where: { id: params.id } })
  revalidatePath('/')

  return NextResponse.json({ success: true })
}
