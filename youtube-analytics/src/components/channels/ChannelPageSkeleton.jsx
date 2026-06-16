export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
          <div className="h-7 w-24 rounded bg-gray-200 mb-2" />
          <div className="h-2.5 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

export function BannerSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 p-8 h-[160px]">
      <div className="flex items-center gap-8">
        <div className="h-24 w-24 rounded-2xl bg-gray-200" />
        <div className="flex-1">
          <div className="h-5 w-48 rounded bg-gray-200 mb-3" />
          <div className="h-3 w-32 rounded bg-gray-100 mb-5" />
          <div className="flex gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-20 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="h-28 bg-gray-100" />
      <div className="px-5 -mt-8">
        <div className="h-14 w-14 rounded-xl bg-gray-200 ring-4 ring-white" />
      </div>
      <div className="px-5 pt-3 pb-4">
        <div className="h-4 w-32 rounded bg-gray-200 mb-1" />
        <div className="h-2.5 w-16 rounded bg-gray-100 mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-2.5 w-14 rounded bg-gray-100 mb-1.5" />
              <div className="h-4 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="h-12 rounded-lg bg-gray-50 mb-4" />
        <div className="flex gap-2">
          <div className="flex-1 h-8 rounded-xl bg-gray-100" />
          <div className="h-8 w-8 rounded-xl bg-gray-100" />
          <div className="h-8 w-8 rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
