import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PostReviewer from './PostReviewer'

export const dynamic = 'force-dynamic'

export default async function ReviewPostPage({
  params,
}: {
  params: { id: string }
}) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { category: true, tags: true },
  })

  if (!post) notFound()

  return <PostReviewer post={JSON.parse(JSON.stringify(post))} />
}
