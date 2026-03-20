import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import TriggerButton from './TriggerButton'
import PipelineActivity from './PipelineActivity'

export const dynamic = 'force-dynamic'

// Calculate next scheduled run from 7am / 1pm / 7pm UTC
function nextScheduledRun(): string {
  const now = new Date()
  const utcH = now.getUTCHours()
  const schedules = [7, 13, 19]
  const next = schedules.find(h => h > utcH) ?? (schedules[0] + 24)
  const diff = next - utcH
  if (diff < 1) return 'Less than 1h'
  return `~${diff}h from now`
}

export default async function AdminPage() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [
    published, review, rejected,
    totalSubscribers,
    ytShortsCount,
    recentPosts,
    topPosts,
    postsLast7Days,
    statusCounts,
  ] = await Promise.all([
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'REVIEW' } }),
    prisma.post.count({ where: { status: 'REJECTED' } }),
    prisma.subscriber.count({ where: { active: true } }),
    prisma.youtubeShort.count(),
    prisma.post.findMany({
      where: { status: 'REVIEW' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { category: true },
    }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 5,
      include: { category: true },
    }),
    // Posts published per day, last 7 days
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - (6 - i))
        d.setUTCHours(0, 0, 0, 0)
        const next = new Date(d)
        next.setUTCDate(next.getUTCDate() + 1)
        return prisma.post.count({
          where: { status: 'PUBLISHED', publishedAt: { gte: d, lt: next } },
        }).then(count => ({ date: d, count }))
      })
    ),
    Promise.all([
      prisma.post.count({ where: { status: 'DRAFT' } }),
      prisma.post.count({ where: { status: 'REVIEW' } }),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.post.count({ where: { status: 'REJECTED' } }),
    ]).then(([draft, r, pub, rej]) => ({ DRAFT: draft, REVIEW: r, PUBLISHED: pub, REJECTED: rej })),
  ])

  const maxDayCount = Math.max(...postsLast7Days.map(d => d.count), 1)
  const totalPosts  = statusCounts.DRAFT + statusCounts.REVIEW + statusCounts.PUBLISHED + statusCounts.REJECTED
  const maxStatus   = Math.max(totalPosts, 1)

  const STATS = [
    { label: 'Published', value: published,         color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', href: '/admin/posts?status=PUBLISHED' },
    { label: 'Pending Review', value: review,       color: 'bg-amber-500',   textColor: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   href: '/admin/posts?status=REVIEW' },
    { label: 'Subscribers',    value: totalSubscribers, color: 'bg-blue-500', textColor: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', href: '/admin/email' },
    { label: 'YouTube Shorts', value: ytShortsCount, color: 'bg-red-500',   textColor: 'text-red-700',    bg: 'bg-red-50',   border: 'border-red-200',   href: '/admin/youtube' },
    { label: 'Rejected',       value: rejected,      color: 'bg-gray-500',  textColor: 'text-gray-700',   bg: 'bg-gray-50',  border: 'border-gray-200',  href: '/admin/posts?status=REJECTED' },
  ]

  const STATUS_BARS = [
    { label: 'Published', count: statusCounts.PUBLISHED, color: 'bg-emerald-400' },
    { label: 'Review',    count: statusCounts.REVIEW,    color: 'bg-amber-400' },
    { label: 'Draft',     count: statusCounts.DRAFT,     color: 'bg-gray-300' },
    { label: 'Rejected',  count: statusCounts.REJECTED,  color: 'bg-red-400' },
  ]

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1628]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Next scheduled run: {nextScheduledRun()}</p>
        </div>
        <TriggerButton />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {STATS.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className={`${s.bg} ${s.border} border rounded-xl p-4 hover:shadow-md transition-all group`}
          >
            <div className={`text-3xl font-bold ${s.textColor}`}>{s.value.toLocaleString()}</div>
            <div className={`text-xs mt-1 ${s.textColor} opacity-75 group-hover:opacity-100`}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Pipeline health */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-[#0B1628] mb-4">Pipeline Activity</h2>
        <PipelineActivity />
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pending review */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-[#0B1628]">Pending Review</h3>
            {review > 0 && (
              <Link href="/admin/posts?status=REVIEW" className="text-xs text-[#C9A84C] hover:underline">
                View all {review} →
              </Link>
            )}
          </div>
          {recentPosts.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">
              No posts pending review. Trigger the pipeline to generate content.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentPosts.map(post => (
                <li key={post.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[#0B1628] truncate">{post.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {post.category.name} · {post.wordCount.toLocaleString()} words · {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="shrink-0 text-xs bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 px-2.5 py-1 rounded-full font-medium transition-colors"
                  >
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top articles */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#0B1628]">Top Articles by Views</h3>
          </div>
          {topPosts.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">No published posts yet.</p>
          ) : (
            <ol className="divide-y divide-gray-50">
              {topPosts.map((post, i) => (
                <li key={post.id} className="px-5 py-3.5 flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-200 w-5 shrink-0 text-center">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/posts/${post.id}`} className="text-sm font-medium text-[#0B1628] hover:text-[#C9A84C] truncate block transition-colors">
                      {post.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {post.viewCount.toLocaleString()} views · {post.category.name}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Posts by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-[#0B1628] mb-4">Posts by Status</h3>
          <div className="space-y-3">
            {STATUS_BARS.map(bar => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 shrink-0">{bar.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full ${bar.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.round((bar.count / maxStatus) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-6 text-right">{bar.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Posts per day */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-[#0B1628] mb-4">Published (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-24">
            {postsLast7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className="w-full bg-[#C9A84C]/70 rounded-t-sm transition-all duration-700 min-h-[2px]"
                    style={{ height: `${Math.max(2, Math.round((day.count / maxDayCount) * 80))}px` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{DAYS[day.date.getUTCDay() === 0 ? 6 : day.date.getUTCDay() - 1]}</span>
                <span className="text-[10px] font-semibold text-gray-600">{day.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/quality" className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Quality Center
        </Link>
        <Link href="/admin/topics" className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Topic Queue
        </Link>
        <Link href="/admin/email" className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Send Newsletter
        </Link>
        <Link href="/admin/monetization" className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Monetization
        </Link>
      </div>
    </div>
  )
}
