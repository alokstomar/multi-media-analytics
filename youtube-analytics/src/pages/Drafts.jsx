import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Edit2,
  Trash2,
  Copy,
  Plus,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStudioPosts, createStudioPost, deleteStudioPost } from '../services/api'

const TwitterIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 4l11.73 16h4.27L8.27 4H4z" />
    <path d="M18 4l-6.25 6.25m-2.5 2.5L4 20" />
  </svg>
)

export default function Drafts() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [loading, setLoading] = useState(false)

  const loadDrafts = async () => {
    setLoading(true)
    try {
      const res = await getStudioPosts({ platform: 'twitter', status: 'draft' })
      if (res?.success) {
        setDrafts(res.data || [])
      }
    } catch (err) {
      console.error('Failed to load drafts:', err)
      showToast('Error loading drafts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      try {
        const res = await deleteStudioPost(id)
        if (res?.success) {
          showToast('Draft deleted successfully!')
          await loadDrafts()
        }
      } catch (err) {
        showToast(`Error: ${err.message}`)
      }
    }
  }

  const handleDuplicate = async (draft) => {
    try {
      const contentText = draft.content?.fullText || draft.content?.body || draft.content || ''
      const payload = {
        platform: 'twitter',
        type: draft.type || 'tweet',
        status: 'draft',
        content: {
          fullText: `${contentText} (Copy)`,
          thread: draft.content?.thread || []
        }
      }
      const res = await createStudioPost(payload)
      if (res?.success) {
        showToast('Draft duplicated successfully!')
        await loadDrafts()
      }
    } catch (err) {
      showToast(`Error: ${err.message}`)
    }
  }

  const handleEdit = (draft) => {
    const contentText = draft.content?.fullText || draft.content?.body || draft.content || ''
    if (draft.type === 'thread' || draft.type === 'Thread') {
      navigate('/threads', { state: { content: contentText } })
    } else {
      navigate('/new-tweet', { state: { content: contentText } })
    }
  }

  const filteredDrafts = drafts.filter(d => {
    const contentText = d.content?.fullText || d.content?.body || d.content || ''
    const matchesSearch = contentText.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = d.type?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch || matchesType
  })

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-6 pb-12">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            Content Drafts Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Brainstorm, outline, duplicate, and organize your saved X/Twitter draft posts and thread templates.
          </p>
        </div>

        <button
          onClick={() => navigate('/new-tweet')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Draft
        </button>
      </div>

      {/* Datatable & Search Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        {/* Search controls */}
        <div className="flex items-center gap-3 max-w-md w-full border border-gray-100 bg-gray-50/50 px-3.5 py-2 rounded-xl focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400/25 transition">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search drafts content, hooks, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
          />
        </div>

        {/* Drafts List/Table */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <CheckCircle className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No Drafts Found</p>
              <p className="text-xs text-gray-400 mt-0.5">We couldn't find any drafts matching your search query.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Content Draft</th>
                  <th className="pb-3.5">Created</th>
                  <th className="pb-3.5">Last Updated</th>
                  <th className="pb-3.5">Type</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {filteredDrafts.map((draft) => {
                  const contentText = draft.content?.fullText || draft.content?.body || draft.content || '';
                  return (
                    <tr key={draft._id} className="hover:bg-gray-50/40 transition">
                      <td className="py-4 pl-2 font-medium text-gray-800 max-w-[280px] lg:max-w-[420px] truncate">
                        {contentText}
                      </td>
                      <td className="py-4 text-gray-500 font-medium">
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-gray-500 font-medium">
                        {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          draft.type === 'thread' || draft.type === 'Thread' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {draft.type === 'thread' || draft.type === 'Thread' ? 'Draft Thread' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(draft)}
                            title="Edit draft composer"
                            className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer transition"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(draft)}
                            title="Duplicate/Clone draft"
                            className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer transition"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(draft._id)}
                            title="Delete draft permanently"
                            className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Guide/Tip card */}
      <div className="bg-blue-50/20 border border-blue-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900">Pro-Tip for Content Compounding</h4>
          <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
            Duplicating draft templates is the easiest way to test multiple variations of hook structures. Keep high-performing thread structures as base draft templates and clone them whenever drafting new topical announcements.
          </p>
        </div>
      </div>
    </div>
  )
}
