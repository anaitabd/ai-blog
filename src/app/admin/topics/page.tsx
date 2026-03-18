import { prisma } from '@/lib/prisma'
import AddTopicForm from './AddTopicForm'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  PENDING:    'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  DONE:       'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
}

const SOURCE_BADGE: Record<string, string> = {
  'manual':        'bg-slate-100 text-slate-600',
  'google-trends': 'bg-teal-100 text-teal-700',
  'launch-seed':   'bg-violet-100 text-violet-700',
}

export default async function TopicsPage() {
  const topics = await prisma.topicQueue.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl font-bold text-[#1A1A2E]">Topic Queue</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-[#1A1A2E] mb-4">Add New Topic</h3>
          <AddTopicForm />
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-[#1A1A2E] mb-3">Queue Summary</h3>
          <div className="space-y-2 text-sm">
            {(['PENDING', 'PROCESSING', 'DONE', 'FAILED'] as const).map((s) => {
              const count = topics.filter((t) => t.status === s).length
              return (
                <div key={s} className="flex justify-between items-center">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[s]}`}>{s}</span>
                  <span className="font-semibold text-[#1A1A2E]">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-cream-2 text-xs text-muted uppercase tracking-wide font-semibold border-b border-border">
          <span className="col-span-4">Keyword</span>
          <span className="col-span-2">Category</span>
          <span className="col-span-1 text-center">Priority</span>
          <span className="col-span-2">Source</span>
          <span className="col-span-2 text-center">Status</span>
          <span className="col-span-1 text-right">Added</span>
        </div>

        {topics.length === 0 ? (
          <p className="px-6 py-10 text-muted text-center text-sm">
            No topics in queue. Add some above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {topics.map((topic) => (
              <li key={topic.id} className="px-6 py-3 grid md:grid-cols-12 items-center gap-2 text-sm">
                <span className="md:col-span-4 font-medium text-[#1A1A2E] truncate pr-2">
                  {topic.keyword}
                </span>
                <span className="md:col-span-2 text-muted truncate">{topic.category}</span>
                <span className="md:col-span-1 text-center text-muted">{topic.priority}</span>
                <span className="md:col-span-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[(topic as any).source ?? 'manual'] ?? SOURCE_BADGE.manual}`}>
                    {(topic as any).source ?? 'manual'}
                  </span>
                </span>
                <span className="md:col-span-2 flex justify-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[topic.status]}`}>
                    {topic.status}
                  </span>
                </span>
                <span className="md:col-span-1 text-right text-muted text-xs">
                  {new Date(topic.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
