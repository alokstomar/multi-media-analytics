import { motion } from 'framer-motion'
import { BadgeCheck, ArrowUpRight, Plus } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'

export default function ChannelStrip({ selectedIds, onToggle }) {
  const { accounts: allChannels } = usePlatformAdapter()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Portfolio Connected Channels ({selectedIds.length} / {allChannels.length} active)
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {allChannels.map((channel, i) => {
          const isSelected = selectedIds.includes(channel.id)

          return (
            <motion.button
              key={channel.id}
              onClick={() => onToggle(channel.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative flex items-center gap-3.5
                rounded-2xl p-4 pr-6
                min-w-[220px] flex-1
                transition-all duration-200 text-left
                cursor-pointer bg-white
              `}
              style={{
                boxShadow: isSelected
                  ? `0 0 0 2px ${channel.color}, 0 0 20px ${channel.color}15, 0 4px 16px -4px rgba(0,0,0,0.08)`
                  : '0 0 0 1px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <img
                  src={channel.avatar}
                  alt={channel.name}
                  className="h-12 w-12 rounded-full object-cover"
                  style={{
                    boxShadow: isSelected
                      ? `0 0 0 2.5px white, 0 0 0 4px ${channel.color}40`
                      : '0 0 0 2px #F3F4F6',
                  }}
                />
                {channel.verified && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                  >
                    <BadgeCheck
                      className="h-[14px] w-[14px]"
                      style={{ color: channel.color }}
                      fill={`${channel.color}15`}
                    />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold leading-tight truncate text-gray-900">
                  {channel.name}
                </p>
                <p className="text-[11px] font-medium mt-0.5 text-gray-400">
                  {channel.subscriberCount}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-[2px] rounded-full px-1.5 py-[2px] text-[10px] font-bold ${
                    channel.growthUp
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                      : 'bg-red-50 text-red-500 border border-red-100/50'
                  }`}>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    {channel.growth}
                  </span>
                </div>
              </div>
            </motion.button>
          )
        })}

        {/* Dynamic "+ More" Card */}
        {allChannels.length > 4 && (
          <motion.div
            whileHover={{ y: -2 }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-gray-200 px-6 min-w-[140px] text-center hover:bg-gray-50/50 transition-all cursor-pointer text-gray-400"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-gray-300">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500">More Channels</p>
              <p className="text-[9px] text-gray-300">Connect unlimited</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
