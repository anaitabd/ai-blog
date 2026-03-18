import { prisma } from '@/lib/prisma'
import NewPostForm from './NewPostForm'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#1A1A2E]">New Post</h2>
        <p className="text-sm text-muted mt-1">Create a post manually. It will be saved as DRAFT.</p>
      </div>
      <NewPostForm categories={categories} />
    </div>
  )
}
