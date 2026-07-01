/* Skeleton matching the live InstagramAIIntelligence layout: header strip,
   KPI row placeholder, and 6 panel placeholders in the same grid shape.
   Used for initial load and full-page refresh. */
export default function AIIntelligenceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header placeholder */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-64 bg-gray-200 rounded-lg" />
          <div className="h-3 w-80 bg-gray-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-200 rounded-xl" />
          <div className="h-9 w-36 bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Panels grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <div className="h-9 w-9 rounded-xl bg-gray-100" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-32 bg-gray-200 rounded" />
                <div className="h-2.5 w-24 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-lg bg-gray-100 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-50 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
