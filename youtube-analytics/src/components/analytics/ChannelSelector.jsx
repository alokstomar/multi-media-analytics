import { motion } from 'framer-motion'
import { BadgeCheck, ArrowUpRight, Plus } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'

export default function ChannelSelector() {
  const {
    accounts: allChannels,
    activeAccountId: activeChannelId,
    setActiveAccount: setActiveChannel,
    loading: channelsLoading,
  } = usePlatformAdapter()
  const isTransitioning = false

  if (channelsLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3.5 rounded-2xl bg-white p-4 pr-6 min-w-[220px] flex-1" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
            <div className="h-12 w-12 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-20 rounded bg-gray-200" />
              <div className="h-2.5 w-16 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Cards row */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {allChannels.map((channel, i) => {
          const isActive = channel.id === activeChannelId

          return (
            <motion.button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              disabled={isTransitioning}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              whileHover={
                !isActive
                  ? { y: -3, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }
                  : {}
              }
              whileTap={{ scale: 0.97 }}
              className={`
                relative flex items-center gap-4
                rounded-[20px] p-4.5 pr-6
                min-w-[245px] flex-1
                transition-all duration-300 text-left
                disabled:cursor-wait cursor-pointer
                bg-white border
              `}
              style={{
                borderColor: isActive ? channel.color : '#E5E7EB',
                boxShadow: isActive
                  ? `0 0 0 1px ${channel.color}, 0 4px 20px -2px ${channel.color}15, 0 12px 30px -4px ${channel.color}08`
                  : '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.03)',
              }}
            >
              {/* Active Indicating Pill Accent */}
              {isActive && (
                <div 
                  className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: channel.color }}
                />
              )}

              {/* Avatar — circular */}
              <div className="relative shrink-0">
                <img
                  src={channel.avatar}
                  alt={channel.name}
                  className="h-12 w-12 rounded-full object-cover"
                  style={{
                    boxShadow: isActive
                      ? `0 0 0 2px white, 0 0 0 3.5px ${channel.color}`
                      : '0 0 0 2.5px #F3F4F6, 0 2px 4px rgba(0,0,0,0.05)',
                  }}
                />
                {channel.verified && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white border border-gray-100"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                  >
                    <BadgeCheck
                      className="h-[13px] w-[13px]"
                      style={{ color: channel.color }}
                      fill={`${channel.color}15`}
                    />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={`text-[14px] font-extrabold leading-tight truncate transition-colors duration-200 ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                  {channel.name}
                </p>
                <p className={`text-[11px] font-semibold transition-colors duration-200 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                  {channel.subscriberCount}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className={`inline-flex items-center gap-[2px] rounded-full px-1.5 py-[2px] text-[10px] font-black leading-none ${
                    channel.growthUp
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                      : 'bg-red-50 text-red-500 border border-red-100/50'
                  }`}>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    {channel.growth}
                  </span>
                  <span className={`text-[10px] font-bold ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                    {channel.category}
                  </span>
                </div>
              </div>
            </motion.button>
          )
        })}

        {/* Add Channel card */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: allChannels.length * 0.06 }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.97 }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 px-6 min-w-[150px] text-center hover:border-gray-300 hover:bg-gray-50/50 transition-all duration-200 cursor-pointer"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-300">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-500">Add Channel</p>
            <p className="text-[10px] text-gray-300">Connect new channel</p>
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
