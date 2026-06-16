import { motion } from 'framer-motion'
import { Sparkles, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PlaceholderPage({ title, desc }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen space-y-6 bg-gray-50/50 p-6 flex flex-col justify-center items-center">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-[24px] border border-gray-100 p-8 w-full max-w-xl text-center shadow-xl space-y-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 10px 40px -10px rgba(0,0,0,0.05)' }}
      >
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">{desc}</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Platform Core Foundation</span>
          <p className="text-xs text-gray-400 font-medium">This module is currently stubbed and ready to connect to live platform webhooks and external schedulers.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-sm font-semibold transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          <button
            onClick={() => navigate('/content-studio')}
            className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer shadow-sm shadow-blue-500/10"
          >
            Open Content Studio
          </button>
        </div>
      </motion.div>
    </div>
  )
}
