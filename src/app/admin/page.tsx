import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import TriggerButton from './TriggerButton'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [pending, published, rejected, queueCount] = await Promise.all([
    prisma.post.count({ where: { status: 'REVIEW' } }),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'REJECTED' } }),
    prisma.topicQueue.count({ where: { status: 'PENDING' } }),
  ])

  const recentPosts = await prisma.post.findMany({
    where: { status: 'REVIEW' },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { category: true },
  })

  const stats = [
    { label: 'Pending Review', value: pending, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Published', value: published, color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Rejected', value: rejected, color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Topics in Queue', value: queueCount, color: 'bg-blue-50 border-blue-200 text-blue-700' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <TriggerButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.color} border rounded-xl p-4`}>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-sm mt-1 opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-medium">Pending Review</h3>
          <Link href="/admin/posts?status=REVIEW" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="px-6 py-10 text-gray-400 text-sm text-center">
            No posts pending review. Trigger the pipeline to generate content.
          </p>
        ) : (
          <ul className="divide-y">
            {recentPosts.map((post) => (
              <li key={post.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {post.category.name} · {post.wordCount} words ·{' '}
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="text-sm text-blue-600 hover:underline shrink-0"
                >
                  Review →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          href="/admin/topics"
          className="bg-white border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          Manage topic queue
        </Link>
        <Link
          href="/admin/posts?status=PUBLISHED"
          className="bg-white border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          View published posts
        </Link>
      </div>
    </div>
  )
}
