import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import TriggerButton from './TriggerButton'
import PipelineActivity from './PipelineActivity'

export const dynamic = 'force-dynamic'

const STATUS_CARD = [
  { label: 'Pending Review', key: 'REVIEW',     bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', href: '/admin/posts?status=REVIEW' },
  { label: 'Published',      key: 'PUBLISHED',  bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', href: '/admin/posts?status=PUBLISHED' },
  { label: 'Rejected',       key: 'REJECTED',   bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   href: '/admin/posts?status=REJECTED' },
  { label: 'Topics in Queue',key: 'queue',      bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',  href: '/admin/topics' },
] as const

export default async function AdminPage() {
  const [review, published, rejected, queueCount, recentPosts, topPosts] = await Promise.all([
    prisma.post.count({ where: { status: 'REVIEW' } }),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'REJECTED' } }),
    prisma.topicQueue.count({ where: { status: 'PENDING' } }),
    prisma.post.findMany({
      where: { status: 'REVIEW' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { category: true },
    }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 5,
      include: { category: true },
    }),
  ])

  const counts: Record<string, number> = {
    REVIEW: review, PUBLISHED: published, REJECTED: rejected, queue: queueCount,
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-[#1A1A2E]">Dashboard</h2>
        <TriggerButton />
      </div>

      {/* Pipeline Activity */}
      <PipelineActivity adminKey={process.env.ADMIN_API_KEY!} />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">        {STATUS_CARD.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={`${s.bg} ${s.border} border rounded-2xl p-5 hover:shadow-md transition-all`}
          >
            <div className={`text-4xl font-serif font-bold ${s.text}`}>{counts[s.key]}</div>
            <div className={`text-sm mt-1 ${s.text} opacity-80`}>{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending review */}
        <div className="bg-white rounded-2xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-[#1A1A2E]">Pending Review</h3>
            <Link href="/admin/posts?status=REVIEW" className="text-sm text-gold hover:underline">
              View all
            </Link>
          </div>
          {recentPosts.length === 0 ? (
            <p className="px-6 py-10 text-muted text-sm text-center">
              No posts pending review. Trigger the pipeline to generate content.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentPosts.map((post) => (
                <li key={post.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#1A1A2E] truncate">{post.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {post.category.name} · {post.wordCount.toLocaleString()} words ·{' '}
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="text-sm text-gold hover:underline shrink-0"
                  >
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top posts by views */}
        <div className="bg-white rounded-2xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-[#1A1A2E]">Top Articles by Views</h3>
          </div>
          {topPosts.length === 0 ? (
            <p className="px-6 py-10 text-muted text-sm text-center">No published posts yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {topPosts.map((post, i) => (
                <li key={post.id} className="px-6 py-4 flex items-center gap-4">
                  <span className="font-serif text-2xl font-bold text-border w-6 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/posts/${post.id}`} className="font-medium text-sm text-[#1A1A2E] hover:text-gold truncate block">
                      {post.title}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      {post.viewCount.toLocaleString()} views · {post.category.name}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/topics"
          className="bg-white border border-border rounded-xl px-4 py-2 text-sm hover:border-navy hover:text-navy transition-colors"
        >
          Manage topic queue
        </Link>
        <Link
          href="/admin/posts?status=PUBLISHED"
          className="bg-white border border-border rounded-xl px-4 py-2 text-sm hover:border-navy hover:text-navy transition-colors"
        >
          View published posts
        </Link>
      </div>
    </div>
  )
}
