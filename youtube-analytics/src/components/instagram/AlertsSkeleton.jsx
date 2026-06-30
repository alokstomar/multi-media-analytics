/**
 * Loading skeleton for the IG alerts page — mirrors the live layout shape so
 * the swap to real data doesn't cause layout shift.
 */
export default function AlertsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded" />
            <div className="h-2 w-24 bg-gray-100 rounded mt-3" />
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 rounded-2xl bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-48 bg-gray-200 rounded" />
              <div className="h-2 w-72 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
            <div className="h-3 w-12 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
