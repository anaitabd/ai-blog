import { TableSkeleton } from '@/components/admin/Skeleton'

export default function PostsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TableSkeleton rows={12} />
    </div>
  )
}
