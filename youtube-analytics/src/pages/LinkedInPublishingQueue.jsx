import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Search,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  Play,
  Zap,
  XCircle
} from 'lucide-react'
import { getSchedulerJobs, retrySchedulerJob, cancelSchedulerPost } from '../services/api'

const LinkedInIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
)

export default function LinkedInPublishingQueue() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [successToast, setSuccessToast] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load scheduler jobs from backend
  const loadJobs = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await getSchedulerJobs({ platform: 'linkedin' })
      if (res?.success) {
        setJobs(res.data || [])
      } else {
        setJobs([])
      }
    } catch (err) {
      console.error('Failed to load LinkedIn jobs:', err)
      showToast('Error loading active queue.')
      setJobs([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
    // Polling refresh every 8 seconds for a lively real-time feel
    const timer = setInterval(() => loadJobs(true), 8000)
    return () => clearInterval(timer)
  }, [])

  // Handle manual retry
  const handleRetry = async (jobId) => {
    setLoading(true)
    try {
      const res = await retrySchedulerJob(jobId)
      if (res?.success) {
        showToast('Manual retry enqueued successfully!')
        await loadJobs(true)
      } else {
        showToast('Failed to trigger retry.')
      }
    } catch (err) {
      console.error('Retry error:', err)
      showToast(`Retry error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle cancel scheduled job
  const handleCancel = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) return
    setLoading(true)
    try {
      const res = await cancelSchedulerPost(jobId)
      if (res?.success) {
        showToast('Scheduled post cancelled successfully.')
        await loadJobs(true)
      } else {
        showToast('Failed to cancel post.')
      }
    } catch (err) {
      console.error('Cancel error:', err)
      showToast('Error cancelling post.')
    } finally {
      setLoading(false)
    }
  }

  // Status mapper: backend -> frontend presentation
  const mapStatus = (status) => {
    switch (status) {
      case 'waiting':
      case 'delayed':
        return 'Queued'
      case 'active':
        return 'Publishing'
      case 'completed':
        return 'Published'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  // Filters application
  const filteredJobs = jobs.filter(j => {
    const contentText = j.post?.content?.fullText || j.payload?.content?.fullText || ''
    const matchesSearch = contentText.toLowerCase().includes(searchQuery.toLowerCase())
    const mappedStatus = mapStatus(j.status)
    if (statusFilter === 'All') return matchesSearch
    return mappedStatus === statusFilter && matchesSearch
  })

  // Computations for Queue Health Metrics
  const total = jobs.length
  const failedCount = jobs.filter(j => j.status === 'failed').length
  const successRate = total > 0 ? `${Math.round(((total - failedCount) / total) * 100)}%` : '100%'
  const queuedCount = jobs.filter(j => j.status === 'waiting' || j.status === 'delayed').length

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4 w-4" fill="currentColor" />
            </span>
            LinkedIn Publishing Queue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track background queue states. Troubleshoot rate limits, failed retries, and network delays in real-time.
          </p>
        </div>

        <button
          onClick={() => loadJobs()}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-xl cursor-pointer transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Health Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Queue Success Rate</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{successRate}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Healthy dispatch states
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Failed Jobs</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{failedCount}</p>
              <p className="mt-1 text-xs font-medium text-red-500">Awaiting retry action</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending / Queued</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{queuedCount}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">Awaiting dispatch</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Datatable Workspace */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-xs w-full border border-gray-100 bg-gray-50/50 px-3.5 py-1.5 rounded-xl focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400/20 transition">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search active jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex border border-gray-100 rounded-xl p-0.5 bg-gray-50/50">
              {['All', 'Queued', 'Publishing', 'Failed', 'Published'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 h-7 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    statusFilter === s ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Datatable */}
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No active queue jobs found</p>
              <p className="text-xs text-gray-400">Queue is currently clear or matches no status selections.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Post Content</th>
                  <th className="pb-3.5">Platform</th>
                  <th className="pb-3.5">Scheduled Time</th>
                  <th className="pb-3.5">Current Status</th>
                  <th className="pb-3.5">Retry Count</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
                {filteredJobs.map((job) => {
                  const contentText = job.post?.content?.fullText || job.payload?.content?.fullText || 'No Content';
                  const mappedStatus = mapStatus(job.status);
                  
                  return (
                    <tr key={job._id} className="hover:bg-gray-50/30 transition">
                      <td className="py-4 pl-2 text-gray-900 max-w-[280px] lg:max-w-[420px] truncate">
                        <div className="space-y-1">
                          <p className="truncate font-semibold">{contentText}</p>
                          {job.error && (
                            <p className="text-[9px] text-red-500 flex items-center gap-0.5 font-bold">
                              ⚠️ {job.errorType ? `[${job.errorType}]` : ''} {job.error}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 font-bold text-gray-400 uppercase">{job.platform}</td>
                      <td className="py-4 font-semibold text-gray-600">
                        {new Date(job.scheduledFor).toLocaleString()}
                      </td>
                      <td className="py-4">
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          mappedStatus === 'Published'
                            ? 'bg-emerald-50 text-emerald-600'
                            : mappedStatus === 'Failed'
                            ? 'bg-red-50 text-red-500'
                            : mappedStatus === 'Publishing'
                            ? 'bg-yellow-50 text-yellow-600 animate-pulse'
                            : 'bg-blue-50 text-blue-600'
                        }`}>
                          {mappedStatus}
                        </span>
                      </td>
                      <td className="py-4 font-bold pl-5">{job.retries} / {job.maxRetries}</td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {job.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(job._id)}
                              className="flex h-7 px-2.5 items-center gap-1 hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-100 rounded-lg cursor-pointer transition"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                          {(job.status === 'waiting' || job.status === 'delayed') && (
                            <button
                              onClick={() => handleCancel(job._id)}
                              className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 border border-transparent hover:border-red-100 rounded-lg cursor-pointer transition"
                              title="Cancel Scheduled Job"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Health Guideline card */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900">Background Worker Dispatch Metrics</h4>
          <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
            Publishing retries use an exponential backoff timing trigger. If a network block persists after 3 retry iterations, jobs are automatically marked as failed to prevent LinkedIn API lockouts.
          </p>
        </div>
      </div>
    </div>
  )
}
