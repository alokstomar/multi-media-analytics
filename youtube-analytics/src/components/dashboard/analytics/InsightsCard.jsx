const AI_INSIGHTS = [
  {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    text: 'Views increased 12% this week — momentum building',
    cta: 'View Details',
    type: 'positive',
  },
  {
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'Best posting time: 6 – 9 PM IST',
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

const styles = {
  positive: {
    card: 'bg-green-50/70 border-green-100',
    icon: 'text-green-600',
    text: 'text-green-700',
    cta: 'text-green-700 hover:text-green-900',
  },
  info: {
    card: 'bg-blue-50/70 border-blue-100',
    icon: 'text-blue-600',
    text: 'text-blue-700',
    cta: 'text-blue-700 hover:text-blue-900',
  },
  warning: {
    card: 'bg-amber-50/70 border-amber-100',
    icon: 'text-amber-600',
    text: 'text-amber-700',
    cta: 'text-amber-700 hover:text-amber-900',
  },
}

export default function InsightsCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-800">AI Insights</h3>
      </div>

      {/* Insights list */}
      <div className="space-y-2.5">
        {AI_INSIGHTS.map((insight, i) => {
          const s = styles[insight.type]
          return (
            <div
              key={i}
              className={`rounded-xl border p-3 transition-all duration-200 hover:scale-[1.01] ${s.card}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 ${s.icon}`}>{insight.icon}</span>
                <div className="flex-1">
                  <p className={`text-xs font-medium leading-relaxed ${s.text}`}>{insight.text}</p>
                  <button className={`mt-1.5 text-[11px] font-semibold transition-colors ${s.cta}`}>
                    {insight.cta} &rarr;
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
