import { motion } from 'framer-motion'
import { PenTool } from 'lucide-react'

// Content Studio components
import LinkedInGenerator from '../components/content-studio/LinkedInGenerator'
import TwitterGenerator from '../components/content-studio/TwitterGenerator'
import InstagramGenerator from '../components/content-studio/InstagramGenerator'
import RepurposeEngine from '../components/content-studio/RepurposeEngine'
import ContentCalendar from '../components/content-studio/ContentCalendar'
import ContentAssistant from '../components/content-studio/ContentAssistant'
import ConnectedAccounts from '../components/content-studio/ConnectedAccounts'

export default function ContentStudio() {
  return (
    <div className="min-h-screen space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <PenTool className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Studio</h1>
            <p className="mt-1 text-sm text-gray-500">
              AI-powered content creation, repurposing, scheduling & multi-platform publishing
            </p>
          </div>
        </div>
      </motion.div>

      {/* Content Grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start"
      >
        {/* Left Column: Generators + Repurpose */}
        <div className="xl:col-span-3 space-y-6">
          <LinkedInGenerator />
          <TwitterGenerator />
          <InstagramGenerator />
          <RepurposeEngine />
          <ContentCalendar />
        </div>

        {/* Right Column: Assistant + Accounts */}
        <div className="xl:col-span-1 space-y-6">
          <ContentAssistant />
          <ConnectedAccounts />
        </div>
      </motion.div>
    </div>
  )
}
