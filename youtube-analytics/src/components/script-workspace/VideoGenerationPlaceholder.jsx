import { motion } from 'framer-motion'
import { Film, Sparkles } from 'lucide-react'

export default function VideoGenerationPlaceholder() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-white/60 backdrop-blur-sm"
    >
      <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <Film className="h-7 w-7" />
          </div>
          <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <Sparkles className="h-3 w-3" />
          </div>
        </div>
        <div className="space-y-1.5 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-700">Generate Video</h3>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100 uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            The final edited script will be converted into YouTube Shorts, Instagram Reels, and TikTok videos.
            Future video generation will always use the final edited script — not the original AI output.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2 opacity-50">
          {['YouTube Shorts', 'Instagram Reels', 'TikTok'].map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-[10.5px] font-semibold text-gray-500 border border-gray-100"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
