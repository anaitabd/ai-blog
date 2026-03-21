import { CardSkeleton } from '@/components/admin/Skeleton'

export default function LogsLoading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-40 bg-gray-200 rounded-lg animate-pulse" />
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-gray-200 rounded-full animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="space-y-1.5 animate-pulse">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
