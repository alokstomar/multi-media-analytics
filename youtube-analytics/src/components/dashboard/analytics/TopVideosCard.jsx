function formatViews(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function TopVideosCard({ videos = [], title = "Top Videos", metricLabel = "views" }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <button className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View all
        </button>
      </div>

      {/* Video List */}
      <div className="space-y-3">
        {videos.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No videos found</p>
        )}
        {videos.map((video, i) => {
          const avgViews = videos.length > 0
            ? videos.reduce((s, v) => s + v.views, 0) / videos.length
            : 0
          const growth = avgViews > 0
            ? (((video.views - avgViews) / avgViews) * 100).toFixed(1)
            : 0
          const growthNum = parseFloat(growth)

          return (
            <div
              key={video.videoId || i}
              className="flex items-center gap-3 rounded-xl p-2 transition-all duration-200 hover:bg-gray-50"
            >
              {/* Rank */}
              <span className="w-5 text-center text-[11px] font-bold text-gray-300">
                {i + 1}
              </span>

              {/* Thumbnail */}
              <img
                src={video.thumbnail}
                alt={video.title}
                className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-gray-100"
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">{video.title}</p>
                <p className="text-[11px] text-gray-400">{formatViews(video.views)} {metricLabel}</p>
              </div>

              {/* Growth badge */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  growthNum >= 0
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-500'
                }`}
              >
                {growthNum >= 0 ? '+' : ''}{growth}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
