import { AnimatePresence } from 'framer-motion'
import { Bell, Inbox } from 'lucide-react'
import AlertCard from './AlertCard'

/* Newest-first list of alerts. Each row delegates mark-read up to the parent.
   Empty state covers both "no alerts" and "no matches in current filter". */
export default function AlertsTimeline({ alerts, accounts, onMarkRead, activeFilter, hasAnyAlerts }) {
  const accountMap = new Map((accounts || []).map((a) => [a.id, a]))

  if (!alerts.length) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 mx-auto mb-4">
          {hasAnyAlerts ? (
            <Bell className="h-6 w-6 text-gray-300" />
          ) : (
            <Inbox className="h-6 w-6 text-gray-300" />
          )}
        </div>
        <p className="text-sm font-bold text-gray-500">
          {hasAnyAlerts ? 'No alerts in this filter' : 'No alerts detected yet.'}
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          {hasAnyAlerts
            ? 'Try a different filter or refresh to pick up new signals.'
            : 'Refresh to run detection across your Instagram accounts.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-50 px-5 py-3 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-gray-900">Timeline</h3>
        <p className="text-[11px] text-gray-400">
          Showing <span className="font-semibold text-gray-700">{alerts.length}</span> alert{alerts.length === 1 ? '' : 's'} · sorted newest first
        </p>
      </div>
      <div className="divide-y divide-gray-50">
        <AnimatePresence initial={false}>
          {alerts.map((a, i) => (
            <AlertCard
              key={a._id || i}
              alert={a}
              account={accountMap.get(a.accountId)}
              onMarkRead={onMarkRead}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
