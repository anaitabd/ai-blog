import { prisma } from '@/lib/prisma'
import SidebarNav from './SidebarNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let pendingCount = 0
  try {
    pendingCount = await prisma.post.count({ where: { status: 'REVIEW' } })
  } catch { /* DB unavailable — show 0 */ }

  return (
    <div className="flex min-h-screen bg-[#F0EDE8]">
      <SidebarNav pendingCount={pendingCount} />
      {/* Content offset by sidebar on desktop, full-width on mobile */}
      <div className="flex-1 min-w-0 lg:pl-64">
        <main className="min-h-screen pt-14 lg:pt-0">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

