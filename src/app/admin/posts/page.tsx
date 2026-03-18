import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { PostStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<PostStatus, string> = {
  REVIEW:     'bg-amber-100 text-amber-700',
  PUBLISHED:  'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
  DRAFT:      'bg-gray-100 text-gray-600',
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string }
}) {
  const status   = (searchParams.status as PostStatus) ?? 'REVIEW'
  const query    = searchParams.q?.toLowerCase() ?? ''

  const [allPosts, counts] = await Promise.all([
    prisma.post.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    }),
    Promise.all(
      (['REVIEW', 'PUBLISHED', 'REJECTED', 'DRAFT'] as PostStatus[]).map((s) =>
        prisma.post.count({ where: { status: s } }).then((n) => [s, n] as [PostStatus, number])
      )
    ).then(Object.fromEntries<number>),
  ])

  const posts = query
    ? allPosts.filter((p) => p.title.toLowerCase().includes(query))
    : allPosts

  const statuses: PostStatus[] = ['REVIEW', 'PUBLISHED', 'REJECTED', 'DRAFT']

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl font-bold text-[#1A1A2E]">Posts</h2>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/posts?status=${s}`}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              status === s
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-muted border-border hover:border-navy hover:text-navy'
            }`}
          >
            {s} <span className="opacity-60 ml-1">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search by title…"
          className="w-full max-w-sm bg-white border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-navy"
        />
      </form>

      {/* Posts table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-cream-2 text-xs text-muted uppercase tracking-wide font-semibold border-b border-border">
          <span className="col-span-5">Title</span>
          <span className="col-span-2">Category</span>
          <span className="col-span-1 text-right">Words</span>
          <span className="col-span-2">Date</span>
          <span className="col-span-1 text-center">Status</span>
          <span className="col-span-1" />
        </div>

        {posts.length === 0 ? (
          <p className="px-6 py-10 text-muted text-center text-sm">
            No posts with status: {status}{query ? ` matching "${query}"` : ''}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((post) => (
              <li key={post.id} className="px-6 py-4 grid md:grid-cols-12 items-center gap-2">
                <div className="md:col-span-5 min-w-0">
                  <p className="font-medium text-sm text-[#1A1A2E] truncate">{post.title}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">{post.excerpt}</p>
                </div>
                <span className="md:col-span-2 text-xs text-muted">{post.category.name}</span>
                <span className="md:col-span-1 text-xs text-muted text-right">{post.wordCount.toLocaleString()}</span>
                <span className="md:col-span-2 text-xs text-muted">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
                <span className="md:col-span-1 flex justify-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[post.status]}`}>
                    {post.status}
                  </span>
                </span>
                <div className="md:col-span-1 flex justify-end">
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="text-sm text-gold hover:underline shrink-0"
                  >
                    {status === 'REVIEW' ? 'Review →' : 'View →'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
