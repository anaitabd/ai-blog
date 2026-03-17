import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { PostStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status = (searchParams.status as PostStatus) ?? 'REVIEW'

  const posts = await prisma.post.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    include: { category: true },
  })

  const statuses: PostStatus[] = ['REVIEW', 'PUBLISHED', 'REJECTED', 'DRAFT']

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Posts</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/posts?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              status === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border divide-y">
        {posts.length === 0 ? (
          <p className="px-6 py-10 text-gray-400 text-center text-sm">
            No posts with status: {status}
          </p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{post.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {post.category.name} · {post.wordCount} words ·{' '}
                  {post.readingTime} min ·{' '}
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {post.excerpt}
                </p>
              </div>
              <Link
                href={`/admin/posts/${post.id}`}
                className="text-sm text-blue-600 hover:underline shrink-0"
              >
                {status === 'REVIEW' ? 'Review →' : 'View →'}
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
