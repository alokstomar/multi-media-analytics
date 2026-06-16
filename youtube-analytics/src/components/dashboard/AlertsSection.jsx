import { useState, useEffect } from 'react'
import { Flame, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { getInsights } from '../../services/api'

const ICON_MAP = { positive: CheckCircle, warning: AlertTriangle, info: Info }
const COLOR_MAP = {
  positive: { iconBg: 'bg-green-100', iconColor: 'text-green-600', button: 'text-green-700 bg-green-50 hover:bg-green-100' },
  warning: { iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', button: 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100' },
  info: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', button: 'text-blue-700 bg-blue-50 hover:bg-blue-100' },
}

const FALLBACK_ALERTS = [
  { title: 'Viral Opportunity', description: 'Your recent video is trending!', type: 'positive', action: 'View Video' },
  { title: 'Low Engagement', description: 'Engagement rate dropped by 9%', type: 'warning', action: 'View Details' },
  { title: 'SEO Suggestion', description: 'Optimize your titles for better reach', type: 'info', action: 'See Suggestions' },
  { title: 'Consistency', description: 'Great! You\'re posting consistently.', type: 'positive', action: 'View Calendar' },
]

export default function AlertsSection({ channelId }) {
  const [alerts, setAlerts] = useState(FALLBACK_ALERTS)

  useEffect(() => {
    if (!channelId) return
    getInsights(channelId)
      .then((res) => {
        if (res.data?.length) {
          setAlerts(res.data.slice(0, 4).map((d) => ({
            title: d.title,
            description: d.description,
            type: d.type,
            action: d.action,
          })))
        }
      })
      .catch(() => {})
  }, [channelId])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <h2 className="text-lg font-semibold mb-5">Alerts</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {alerts.map((alert, index) => {
          const Icon = ICON_MAP[alert.type] || Info
          const s = COLOR_MAP[alert.type] || COLOR_MAP.info

          return (
            <div key={index} className="p-5 rounded-xl border border-gray-100 bg-gray-50 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${s.iconBg}`}>
                  <Icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <h3 className="font-medium text-gray-800">{alert.title}</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">{alert.description}</p>
              <button className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${s.button}`}>
                {alert.action}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
