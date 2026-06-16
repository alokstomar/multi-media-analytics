import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Clock, Send, Loader2, CheckCircle2, AlertCircle, Eye, Moon, Sun, Heart, MessageCircle, Repeat2, Bookmark, Share } from 'lucide-react'
import { createStudioPost, scheduleStudioPost, publishStudioPost } from '../../services/api'

export default function PublishModal({ isOpen, onClose, platform, content, topic, tone, audience, onScheduled }) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  if (!isOpen) return null

  // Format content for display
  const getFullText = () => {
    if (typeof content === 'string') return content
    if (content?.thread?.length) return content.thread.join('\n\n')
    if (content?.tweet) return content.tweet
    if (content?.body) {
      return `${content.hook || ''}\n\n${content.body || ''}\n\n${content.cta || ''}\n\n${(content.hashtags || []).map(t => `#${t}`).join(' ')}`
    }
    return ''
  }

  const handleAction = async (actionType) => {
    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const fullText = getFullText()
      const postPayload = {
        platform,
        type: platform === 'linkedin' ? (content.type || 'thought-leadership') : (content.type || 'tweet'),
        topic: topic || 'General Topic',
        tone: tone || 'professional',
        audience: audience || '',
        content: {
          hook: content.hook || '',
          body: content.body || '',
          cta: content.cta || '',
          hashtags: content.hashtags || [],
          thread: content.thread || [],
          fullText
        }
      }

      // 1. Create the post first
      const saveRes = await createStudioPost(postPayload)
      if (!saveRes?.success || !saveRes?.data?._id) {
        throw new Error('Failed to save content draft.')
      }

      const postId = saveRes.data._id

      // 2. Perform the schedule or publish action
      if (actionType === 'schedule') {
        if (!scheduledAt) {
          throw new Error('Please select a valid date and time to schedule.')
        }
        await scheduleStudioPost(postId, new Date(scheduledAt).toISOString())
        setSuccessMsg(`Successfully scheduled for ${new Date(scheduledAt).toLocaleString()}`)
      } else {
        await publishStudioPost(postId)
        setSuccessMsg('Successfully published post!')
      }

      setTimeout(() => {
        onClose()
        if (onScheduled) onScheduled()
      }, 2000)

    } catch (err) {
      setErrorMsg(err.message || 'An error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isThread = platform === 'twitter' && content?.thread?.length > 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[24px] shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        {/* Left Column: Real-Time Preview */}
        <div className={`flex-1 p-6 ${platform === 'twitter' && isDarkMode ? 'bg-[#15181c] text-white' : 'bg-gray-50 text-gray-800'} overflow-y-auto max-h-[45vh] md:max-h-none`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-[12px] font-bold uppercase tracking-wider ${platform === 'twitter' && isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1.5`}>
              <Eye className="h-4 w-4" /> Real-Time Preview
            </h3>
            {platform === 'twitter' && (
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${isDarkMode ? 'border-neutral-700 bg-neutral-800 text-yellow-400' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'} cursor-pointer`}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>

          {platform === 'linkedin' ? (
            /* LinkedIn Preview Card */
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3.5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex gap-2.5">
                  <img
                    src="https://ui-avatars.com/api/?name=LinkedIn+Creator&background=0077B5&color=fff&size=100"
                    alt="Avatar"
                    className="h-11 w-11 rounded-full object-cover border"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-bold text-gray-900 hover:text-blue-600 cursor-pointer">Simulated LinkedIn Creator</span>
                      <span className="text-[11px] text-gray-400">• 1st</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">Industry Expert & Strategist | Building Leveraged Channels</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                      <span>Just now</span>
                      <span>•</span>
                      <Globe className="h-3 w-3" />
                    </div>
                  </div>
                </div>
                <button className="text-[12px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1">
                  <span>+</span> Follow
                </button>
              </div>

              <div className="text-[12.5px] text-gray-800 leading-relaxed whitespace-pre-line space-y-2">
                {content.hook && <p className="font-bold text-gray-950">{content.hook}</p>}
                {content.body && <p>{content.body}</p>}
                {content.cta && <p className="text-blue-600 font-semibold">{content.cta}</p>}
                {content.hashtags?.length > 0 && (
                  <p className="text-blue-500 font-semibold">
                    {content.hashtags.map(h => `#${h}`).join(' ')}
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between text-gray-500 text-[11px] font-semibold">
                <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Heart className="h-4 w-4" /> Like</button>
                <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><MessageCircle className="h-4 w-4" /> Comment</button>
                <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Repeat2 className="h-4 w-4" /> Repost</button>
                <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Send className="h-4 w-4" /> Send</button>
              </div>
            </div>
          ) : (
            /* Twitter/X Preview Card */
            <div className={`space-y-4`}>
              {isThread ? (
                /* Thread Previews */
                <div className="space-y-0.5">
                  {content.thread.map((tweetText, ti) => (
                    <div key={ti} className="relative flex gap-3.5 pr-2">
                      {/* Thread connector line */}
                      {ti < content.thread.length - 1 && (
                        <div className={`absolute left-[22px] top-10 bottom-0 w-0.5 ${isDarkMode ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                      )}
                      
                      <img
                        src="https://ui-avatars.com/api/?name=X+Creator&background=000&color=fff&size=100"
                        alt="Avatar"
                        className="h-11 w-11 rounded-full border border-neutral-700/30 object-cover relative z-10 shrink-0"
                      />
                      <div className="space-y-1.5 flex-1 min-w-0 pb-6 border-b border-gray-100/50">
                        <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Simulated Creator</span>
                          <span className={`text-[12px] ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'}`}>@mock_creator</span>
                          <span className={`text-[12px] ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'}`}>· Just now</span>
                        </div>
                        <p className={`text-[13px] leading-relaxed whitespace-pre-line ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{tweetText}</p>
                        
                        <div className={`flex items-center justify-between max-w-md ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'} text-[11px] pt-1`}>
                          <button className="flex items-center gap-1.5 hover:text-sky-500 transition"><MessageCircle className="h-3.5 w-3.5" /> 1</button>
                          <button className="flex items-center gap-1.5 hover:text-emerald-500 transition"><Repeat2 className="h-3.5 w-3.5" /> 2</button>
                          <button className="flex items-center gap-1.5 hover:text-pink-500 transition"><Heart className="h-3.5 w-3.5" /> 5</button>
                          <button className="flex items-center gap-1.5 hover:text-sky-500 transition"><Bookmark className="h-3.5 w-3.5" /></button>
                          <button className="flex items-center gap-1.5 hover:text-sky-500 transition"><Share className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Single Tweet Preview */
                <div className={`rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-900/40' : 'bg-white border-gray-200'} p-4 space-y-3.5 shadow-sm`}>
                  <div className="flex gap-3">
                    <img
                      src="https://ui-avatars.com/api/?name=X+Creator&background=000&color=fff&size=100"
                      alt="Avatar"
                      className="h-11 w-11 rounded-full border border-neutral-700/30 object-cover shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px]">
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Simulated Creator</span>
                        <span className={`text-[12px] ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'}`}>@mock_creator</span>
                      </div>
                      <p className={`text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'} leading-none mt-0.5`}>SaaS Builder & Strategist</p>
                    </div>
                  </div>

                  <div className={`text-[13px] leading-relaxed whitespace-pre-line ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {content.tweet || getFullText()}
                  </div>

                  <div className={`border-t border-gray-100 pt-2.5 flex items-center justify-between ${isDarkMode ? 'text-neutral-500' : 'text-gray-400'} text-[11px] font-semibold`}>
                    <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><MessageCircle className="h-4 w-4" /> Reply</button>
                    <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Repeat2 className="h-4 w-4" /> Repost</button>
                    <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Heart className="h-4 w-4" /> Like</button>
                    <button className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition"><Bookmark className="h-4 w-4" /> Save</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Scheduling & Publishing controls */}
        <div className="w-full md:w-[360px] p-6 border-l border-gray-100 flex flex-col justify-between bg-white max-h-[45vh] md:max-h-none">
          <div className="space-y-5">
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Schedule or Publish</h2>
              <p className="text-[11px] text-gray-400 mt-1">Configure publishing options for your platform-optimized draft.</p>
            </div>

            {/* Notifications */}
            {successMsg && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-xl">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-xs p-3 rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Time Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Scheduled Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-6 md:pt-0">
            {/* Schedule Trigger */}
            <button
              onClick={() => handleAction('schedule')}
              disabled={isSubmitting || !scheduledAt}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scheduling...</>
              ) : (
                <><Clock className="h-4 w-4" /> Schedule Publication</>
              )}
            </button>

            {/* Instant Publish Trigger */}
            <button
              onClick={() => handleAction('publish')}
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</>
              ) : (
                <><Send className="h-4 w-4" /> Publish Instantly</>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2 text-center text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              Cancel & Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
