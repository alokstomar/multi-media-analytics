import { useState, useMemo } from 'react'
import { BarChart3, HelpCircle } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PortfolioChart({ selectedIds, range }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()
  const [activeMetric, setActiveMetric] = useState('Views')

  const METRICS = useMemo(() => [
    { name: 'Views', color: '#EF4444' },
    { name: selectedPlatform === 'youtube' ? 'Subscribers' : 'Followers', color: '#3B82F6' },
    { name: selectedPlatform === 'youtube' ? 'Watch Time' : 'Impressions', color: '#F59E0B' },
    { name: 'Engagement', color: '#8B5CF6' }
  ], [selectedPlatform])

  const activeChannels = useMemo(() => {
    return (allChannels || []).filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-6" style={{ boxShadow: cs }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Multi-Channel Performance</h3>
            <p className="text-[11px] text-gray-400">Compare views, growth rate, and engagement velocity side-by-side</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-1 opacity-50 cursor-not-allowed">
            {METRICS.map((met) => (
              <button
                key={met.name}
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-400 cursor-not-allowed"
              >
                {met.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-400 select-none shadow-sm">
            <span>Range: {range || '30D'}</span>
          </div>
        </div>
      </div>

      <div className="h-[320px] flex flex-col items-center justify-center gap-2 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/20">
        {activeChannels.length === 0 ? (
          <>
            <HelpCircle className="h-8 w-8 text-gray-300" />
            <div>
              <p className="text-sm font-bold text-gray-500">No channels selected</p>
              <p className="text-xs text-gray-300 mt-0.5">Toggle channel cards in the selector above to visualize performance trends</p>
            </div>
          </>
        ) : (
          <>
            <BarChart3 className="h-8 w-8 text-gray-300" />
            <div>
              <p className="text-sm font-bold text-gray-500">Historical timeseries unavailable</p>
              <p className="text-xs text-gray-300 mt-0.5">No per-channel daily/weekly/monthly history endpoint exists yet.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
