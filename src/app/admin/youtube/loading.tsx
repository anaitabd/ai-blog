import { StatsSkeleton, TableSkeleton } from '@/components/admin/Skeleton'

export default function YoutubeLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <StatsSkeleton />
      <TableSkeleton rows={8} />
    </div>
  )
}
