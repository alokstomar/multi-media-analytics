const TOP_VIDEOS = [
  {
    id: 1,
    title: 'I Built a Mass Extinction Weather Machine',
    views: '18.2M',
    growth: 24.3,
    image: 'https://i.pravatar.cc/150?img=11',
  },
  {
    id: 2,
    title: "Lamborghini vs World's Largest Shredder",
    views: '12.8M',
    growth: 18.7,
    image: 'https://i.pravatar.cc/150?img=12',
  },
  {
    id: 3,
    title: 'Would You Sit in Snakes for $10,000?',
    views: '9.4M',
    growth: -3.1,
    image: 'https://i.pravatar.cc/150?img=33',
  },
  {
    id: 4,
    title: 'Ages 1 - 100 Decide Who Wins $250,000',
    views: '7.1M',
    growth: 11.5,
    image: 'https://i.pravatar.cc/150?img=44',
  },
]

const AI_INSIGHTS = [
  {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    text: 'Your views increased 12% this week',
    cta: 'View Details',
    type: 'positive',
  },
  {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'Best posting time: 6 – 9 PM',
    cta: 'Schedule Post',
    type: 'info',
  },
  {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    text: 'Retention drops after 30s — try shorter intros',
    cta: 'Optimize Now',
    type: 'warning',
  },
]

const insightStyles = {
  positive: {
    card: 'bg-green-50 border-green-100',
    text: 'text-green-600',
    cta: 'text-green-700 hover:text-green-800',
  },
  info: {
    card: 'bg-blue-50 border-blue-100',
    text: 'text-blue-600',
    cta: 'text-blue-700 hover:text-blue-800',
  },
  warning: {
    card: 'bg-amber-50 border-amber-100',
    text: 'text-amber-600',
    cta: 'text-amber-700 hover:text-amber-800',
  },
}

export default function InsightsPanel() {
  return (
    <div className="space-y-6">
      {/* Top Videos */}
      <div className="animate-fade-in-up stagger-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-md transition-all duration-200 hover:shadow-lg">
        <h3 className="text-xs font-medium text-gray-500">Top Videos</h3>
        <p className="mt-0.5 text-[11px] text-gray-400">Best performing this period</p>
        <div className="mt-4 space-y-1">
          {TOP_VIDEOS.map((video, i) => (
            <div
              key={video.id}
              className={`animate-fade-in-up stagger-${i + 5} flex items-center gap-3 rounded-xl p-2.5 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50`}
            >
              <span className="w-4 text-center text-[11px] font-bold text-gray-300">{i + 1}</span>
              <img
                src={video.image}
                alt={video.title}
                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-gray-100"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">{video.title}</p>
                <p className="text-[11px] text-gray-400">{video.views} views</p>
              </div>
              <span
                className={`shrink-0 text-[11px] font-semibold ${
                  video.growth >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {video.growth >= 0 ? '+' : ''}{video.growth}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="animate-fade-in-up stagger-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-md transition-all duration-200 hover:shadow-lg">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xs font-medium text-gray-500">AI Insights</h3>
        </div>
        <div className="mt-4 space-y-2.5">
          {AI_INSIGHTS.map((insight, i) => {
            const style = insightStyles[insight.type]
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 transition-all duration-200 hover:scale-[1.02] ${style.card}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 ${style.text}`}>{insight.icon}</span>
                  <div className="flex-1">
                    <p className={`text-xs font-medium leading-relaxed ${style.text}`}>{insight.text}</p>
                    <button className={`mt-2 text-[11px] font-semibold transition-colors ${style.cta}`}>
                      {insight.cta} &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
