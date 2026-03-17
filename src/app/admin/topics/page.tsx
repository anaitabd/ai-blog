import { prisma } from '@/lib/prisma'
import AddTopicForm from './AddTopicForm'

export const dynamic = 'force-dynamic'

export default async function TopicsPage() {
  const topics = await prisma.topicQueue.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  const statusColor: Record<string, string> = {
    PENDING: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
    DONE: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Topic Queue</h2>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium mb-4">Add new topic</h3>
          <AddTopicForm />
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium mb-3">Queue summary</h3>
          <div className="space-y-2 text-sm">
            {(['PENDING', 'PROCESSING', 'DONE', 'FAILED'] as const).map((s) => {
              const count = topics.filter((t) => t.status === s).length
              return (
                <div key={s} className="flex justify-between">
                  <span className="text-gray-600">{s}</span>
                  <span className="font-medium">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border divide-y">
        <div className="px-6 py-3 bg-gray-50 rounded-t-xl">
          <div className="grid grid-cols-12 text-xs text-gray-400 uppercase tracking-wide font-medium">
            <span className="col-span-5">Keyword</span>
            <span className="col-span-2">Category</span>
            <span className="col-span-1 text-center">Priority</span>
            <span className="col-span-2 text-center">Status</span>
            <span className="col-span-2 text-right">Added</span>
          </div>
        </div>
        {topics.length === 0 ? (
          <p className="px-6 py-10 text-gray-400 text-center text-sm">
            No topics in queue. Add some above.
          </p>
        ) : (
          topics.map((topic) => (
            <div key={topic.id} className="px-6 py-3 grid grid-cols-12 items-center text-sm">
              <span className="col-span-5 font-medium text-gray-900 truncate pr-2">
                {topic.keyword}
              </span>
              <span className="col-span-2 text-gray-500 truncate">{topic.category}</span>
              <span className="col-span-1 text-center text-gray-500">{topic.priority}</span>
              <span className="col-span-2 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[topic.status]}`}>
                  {topic.status}
                </span>
              </span>
              <span className="col-span-2 text-right text-gray-400 text-xs">
                {new Date(topic.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
