import { StatsSkeleton, TableSkeleton } from '@/components/admin/Skeleton'

export default function AdminLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <StatsSkeleton />
      <TableSkeleton rows={5} />
    </div>
  )
}
