import { prisma } from '@/lib/prisma'

export default async function PinterestStats() {
  const [totalPinned, notPinned, recentPins] = await Promise.all([
    prisma.post.count({ where: { status: 'PUBLISHED', pinterestPinId: { not: null } } }),
    prisma.post.count({ where: { status: 'PUBLISHED', pinterestPinId: null } }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED', pinterestPinUrl: { not: null } },
      orderBy: { pinterestPinnedAt: 'desc' },
      take: 3,
      select: { title: true, pinterestPinUrl: true, pinterestPinnedAt: true },
    }),
  ])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-600">{totalPinned}</div>
          <div className="text-xs text-red-500 mt-0.5">Articles pinned</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-600">{notPinned}</div>
          <div className="text-xs text-gray-400 mt-0.5">Not yet pinned</div>
        </div>
      </div>
      {recentPins.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recent pins</p>
          <ul className="space-y-2">
            {recentPins.map((pin, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-600 truncate max-w-[200px]">{pin.title}</span>
                <a
                  href={pin.pinterestPinUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs shrink-0 ml-2"
                  style={{ color: '#E60023' }}
                >
                  View pin →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
