import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Search,
  Plus,
  Edit2,
  Copy,
  Trash2,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStudioPosts, deleteStudioPost, createStudioPost } from '../services/api'

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

const STORAGE_KEY = 'ln_drafts'

const STATIC_DRAFTS = [
  { id: 'ln_d1', title: 'Why automation is the leverage of 2026', content: 'In 2026, you don\'t compete on simple hourly inputs. You compete on workflow leverage. Automated check-lists syndicate value while you sleep. Here is the blueprint:', updated: '06/01/2026 10:30 AM', status: 'Draft' },
  { id: 'ln_d2', title: 'LinkedIn SSI Growth playbook', content: 'Our Social Selling Index (SSI) crossed 82 points this week. The 3 rules we followed: (1) industry insight posts twice weekly, (2) visual architecture diagrams, (3) regular authority comments:', updated: '05/30/2026 04:15 PM', status: 'Draft' }
]

export default function LinkedInDrafts() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [successToast, setSuccessToast] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load drafts from DB and LocalStorage
  const loadDrafts = async () => {
    setLoading(true)
    try {
      const res = await getStudioPosts({ platform: 'linkedin', status: 'draft' })
      let dbDrafts = []
      if (res?.success && res.data) {
        dbDrafts = res.data.map(p => ({
          id: p._id,
          title: p.topic || 'Untitled LinkedIn Draft',
          content: p.content?.fullText || p.content?.body || '',
          updated: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : new Date().toLocaleString(),
          status: 'Draft'
        }))
      }

      // Merge with offline LocalStorage drafts
      const raw = localStorage.getItem(STORAGE_KEY)
      let lsDrafts = []
      try {
        if (raw) lsDrafts = JSON.parse(raw)
      } catch {}

      if (dbDrafts.length === 0 && lsDrafts.length === 0) {
        setDrafts(STATIC_DRAFTS)
      } else {
        setDrafts([...dbDrafts, ...lsDrafts])
      }
    } catch (err) {
      console.error(err)
      setDrafts(STATIC_DRAFTS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  // Delete draft
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this draft? This action cannot be undone.')) {
      return
    }

    try {
      // Check if it's a local draft (starts with ln_d_) or database draft
      if (id.startsWith('ln_d_') || id.startsWith('ln_d1') || id.startsWith('ln_d2')) {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const ls = JSON.parse(raw)
          const filtered = ls.filter(d => d.id !== id)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        }
        setDrafts(drafts.filter(d => d.id !== id))
        showToast('Draft deleted successfully!')
        return
      }

      const res = await deleteStudioPost(id)
      if (res?.success) {
        showToast('Draft deleted successfully!')
        await loadDrafts()
      } else {
        showToast('Failed to delete draft.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error deleting draft.')
    }
  }

  // Duplicate draft
  const handleDuplicate = async (draft) => {
    try {
      const sanitizedTitle = `${draft.title} (Copy)`
      
      // Save local clone if it's local
      if (draft.id.startsWith('ln_d_') || draft.id.startsWith('ln_d1') || draft.id.startsWith('ln_d2')) {
        const raw = localStorage.getItem(STORAGE_KEY)
        let ls = []
        if (raw) ls = JSON.parse(raw)
        
        const clone = {
          id: 'ln_d_' + Date.now(),
          title: sanitizedTitle,
          content: draft.content,
          updated: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Draft'
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([clone, ...ls]))
        showToast('Draft duplicated successfully!')
        await loadDrafts()
        return
      }

      // Save database clone
      const payload = {
        platform: 'linkedin',
        type: 'thought-leadership',
        topic: sanitizedTitle,
        content: { fullText: draft.content, body: draft.content },
        status: 'draft'
      }

      const res = await createStudioPost(payload)
      if (res?.success) {
        showToast('Draft duplicated successfully!')
        await loadDrafts()
      } else {
        showToast('Failed to duplicate draft.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error duplicating draft.')
    }
  }

  // Filter drafts based on search
  const filteredDrafts = drafts.filter(d => {
    const matchesTitle = d.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesContent = d.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTitle || matchesContent
  })

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-6 pb-12">
      {/* Toast */}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            LinkedIn Drafts Workspace
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Brainstorm, duplicate, edit, and organize saved LinkedIn post templates and B2B outlines.
          </p>
        </div>

        <button
          onClick={() => navigate('/linkedin/new-post')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Post
        </button>
      </div>

      {/* Search toolbar */}
      <div className="flex items-center gap-3 max-w-md w-full border border-gray-100 bg-white px-3.5 py-2.5 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search drafts by title or preview text..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
        />
      </div>

      {/* Drafts Datatable */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-xs text-gray-500 font-semibold">Opening LinkedIn drafts database...</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No matching drafts found</p>
              <p className="text-xs text-gray-400">Draft your first update or modify your search constraints.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Draft Title</th>
                  <th className="pb-3.5">Content Preview</th>
                  <th className="pb-3.5">Last Updated</th>
                  <th className="pb-3.5">Status</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {filteredDrafts.map((draft) => (
                  <tr key={draft.id} className="hover:bg-gray-50/30 transition">
                    <td className="py-4 pl-2 font-bold text-gray-900 truncate max-w-[160px]">
                      {draft.title}
                    </td>
                    <td className="py-4 text-gray-500 truncate max-w-[280px] lg:max-w-[420px] font-semibold">
                      {draft.content}
                    </td>
                    <td className="py-4 font-semibold text-gray-500">{draft.updated}</td>
                    <td className="py-4">
                      <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase">
                        {draft.status}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate('/linkedin/new-post', { state: { content: draft.content, title: draft.title } })}
                          title="Open in composer"
                          className="flex h-7 px-2 items-center gap-1 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-lg text-[9px] font-bold cursor-pointer transition"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(draft)}
                          title="Duplicate clone"
                          className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-700 border border-gray-100 rounded-lg cursor-pointer transition"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(draft.id)}
                          title="Delete draft"
                          className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition border border-transparent hover:border-red-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guide/Tip block */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900">B2B Content Library & Draft Redundancies</h4>
          <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
            Drafts created locally are automatically cached in your browser. Saving to the cloud syncs your outlines with the backend queue database, making them visible to other administrators. Clone drafts to safely iterate on multiple contrarian hooks!
          </p>
        </div>
      </div>
    </div>
  )
}
