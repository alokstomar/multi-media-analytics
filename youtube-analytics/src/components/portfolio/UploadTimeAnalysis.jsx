import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { getPortfolioCannibalization } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from '../content-intelligence/StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function UploadTimeAnalysis({ selectedIds }) {
  const { accounts: allChannels } = usePlatformAdapter()
  const [warnings, setWarnings] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const activeChannels = useMemo(() => (allChannels || []).filter(c => selectedIds.includes(c.id)), [allChannels, selectedIds])

  const load = useCallback(async () => {
    if (!selectedIds || selectedIds.length < 2 || selectedIds.includes('demo')) {
      setWarnings(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await getPortfolioCannibalization(selectedIds)
      const d = res?.data
      if (Array.isArray(d?.warnings) && d.warnings.length > 0) {
        setWarnings(d.warnings)
        setStatus('idle')
      } else {
        setWarnings(null)
        setStatus('empty')
      }
    } catch (err) {
      setWarnings(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load cannibalization warnings')
      setStatus('error')
    }
  }, [selectedIds])

  useEffect(() => { load() }, [load])

  const channelMap = useMemo(() => {
    const m = new Map()
    allChannels.forEach(c => m.set(c.id, c))
    return m
  }, [allChannels])

  if (activeChannels.length === 0) {
    return (
      <div className="rounded-[20px] border border-gray-100 bg-white p-8 flex flex-col items-center justify-center min-h-[300px]" style={{ boxShadow: cs }}>
        <Clock className="h-10 w-10 text-gray-200" />
        <p className="text-sm font-bold text-gray-400 mt-3">No channels selected</p>
        <p className="text-xs text-gray-300 mt-1">Select channels to analyze upload scheduling conflicts</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-[20px] border border-gray-100 bg-white space-y-0 xl:sticky xl:top-4"
      style={{ boxShadow: cs }}
    >
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Upload Intelligence</h3>
              <p className="text-[11px] text-gray-400">Scheduling conflict detection across selected channels</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {status === 'loading' && <LoadingState label="Analyzing cannibalization risks..." />}
        {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
        {status === 'empty' && <EmptyState message="No portfolio intelligence available" />}

        {status === 'idle' && warnings && warnings.length > 0 && (
          <>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" /> Smart Conflict Detection
            </p>
            {warnings.map((c, idx) => {
              const chA = channelMap.get(c.channelAId) || { name: c.channelAName }
              const chB = channelMap.get(c.channelBId) || { name: c.channelBName }
              return (
                <div key={c.key || idx} className="rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/60 to-orange-50/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {chA.avatar && <img src={chA.avatar} className="h-5 w-5 rounded-full border-2 border-white object-cover" alt="" />}
                        {chB.avatar && <img src={chB.avatar} className="h-5 w-5 rounded-full border-2 border-white object-cover" alt="" />}
                      </div>
                      <span className="text-[10px] font-bold text-amber-900">{chA.name?.split(' ')[0]} ↔ {chB.name?.split(' ')[0]}</span>
                    </div>
                    {c.conflictScore != null && (
                      <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Score: {c.conflictScore}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {c.shared != null && (
                      <div>
                        <p className="text-[7px] font-bold text-gray-400 uppercase">Shared Audience</p>
                        <p className="text-[12px] font-bold text-amber-700">{c.shared}%</p>
                      </div>
                    )}
                    {c.reachLoss != null && (
                      <div>
                        <p className="text-[7px] font-bold text-gray-400 uppercase">Reach Loss</p>
                        <p className="text-[12px] font-bold text-red-600">-{c.reachLoss}%</p>
                      </div>
                    )}
                    {c.fix && (
                      <div>
                        <p className="text-[7px] font-bold text-gray-400 uppercase">Fix</p>
                        <p className="text-[11px] font-bold text-emerald-600">{c.fix}</p>
                      </div>
                    )}
                  </div>
                  {c.note && <p className="text-[10px] text-gray-600 leading-relaxed">{c.note}</p>}
                </div>
              )
            })}
          </>
        )}
      </div>
    </motion.div>
  )
}
