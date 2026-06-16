export function CardSkeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-4 w-4 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-20 rounded bg-gray-200 mb-3" />
      <div className="h-3 w-16 rounded bg-gray-100" />
    </div>
  )
}

export function ChartSkeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-36 rounded bg-gray-200" />
        <div className="h-8 w-24 rounded-lg bg-gray-100" />
      </div>
      <div className="h-6 w-16 rounded bg-gray-200 mb-4" />
      <div className="flex items-end gap-2 h-[280px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-100"
            style={{ height: `${40 + (i * 5) % 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-3 w-14 rounded bg-gray-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100" />
            <div className="flex-1">
              <div className="h-3 w-3/4 rounded bg-gray-200 mb-2" />
              <div className="h-2.5 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-12 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-16 rounded bg-gray-200 mb-2" />
              <div className="h-7 w-20 rounded bg-gray-200 mb-1" />
              <div className="h-3 w-12 rounded bg-gray-100" />
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-4 flex items-center gap-3">
      <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="flex-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-red-600 hover:text-red-800">
          Retry
        </button>
      )}
    </div>
  )
}
