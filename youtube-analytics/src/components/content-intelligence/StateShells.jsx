import { AlertCircle, RefreshCw, Inbox } from 'lucide-react'

export function LoadingState({ label = 'Generating AI insights…' }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-[10px] text-gray-400 font-medium">This may take up to 30 seconds</p>
    </div>
  )
}

export function ErrorState({ message = 'AI service temporarily unavailable', onRetry, retrying = false }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-gray-700 text-center max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'No recommendations available', onRetry }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-gray-500 text-center max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  )
}

export function isAiUnavailable(err) {
  return err?.response?.data?.aiUnavailable === true || err?.response?.status === 503
}
