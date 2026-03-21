export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-6 animate-pulse">
      <div className="h-3 w-1/3 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-1/2 bg-gray-200 rounded mb-3" />
      <div className="h-3 w-2/3 bg-gray-200 rounded" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-1/6 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
