import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  FileText,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getCalendarEvents, updateStudioPost, deleteStudioPost } from '../services/api'

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

const BEST_WINDOWS = [
  { day: 'Mon', time: '09:00 AM', score: 'High' },
  { day: 'Wed', time: '06:45 PM', score: 'Viral' },
  { day: 'Fri', time: '02:30 PM', score: 'Medium' }
]

export default function ContentCalendar() {
  const navigate = useNavigate()
  const [view, setView] = useState('Month') // Month, Week, Day
  const [currentDate, setCurrentDate] = useState(new Date('2026-06-01'))
  const [events, setEvents] = useState([])
  const [successToast, setSuccessToast] = useState('')
  const [draggedItem, setDraggedItem] = useState(null)
  const [loading, setLoading] = useState(false)

  // Calendar dates generation (30 days of June 2026)
  const totalDays = 30
  const startDayOffset = 1 // June 1st, 2026 is Monday

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const loadEvents = async () => {
    setLoading(true)
    try {
      const res = await getCalendarEvents('2026-06-01', '2026-06-30')
      if (res?.success && res.data) {
        const mapped = res.data.map(item => {
          const dateObj = new Date(item.scheduledAt || item.createdAt)
          return {
            id: item._id,
            content: item.content?.fullText || item.content?.body || item.content || 'Draft content',
            type: item.platform === 'twitter' ? (item.type === 'thread' ? 'Thread' : 'Tweet') : 'Draft',
            date: dateObj.getDate(), // Day of month
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: item.status === 'scheduled' ? 'Scheduled' : 'Draft',
            rawItem: item
          }
        })
        setEvents(mapped)
      }
    } catch (err) {
      console.error('Failed to load calendar events:', err)
      showToast('Error loading calendar events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  // Handle drag and drop simulation (clicking on a card, then clicking on a date!)
  const handleSelectDragItem = (item) => {
    setDraggedItem(item)
    showToast(`Picked up "${item.content.substring(0, 30)}..." - Click any calendar date to reschedule!`)
  }

  const handleRescheduleDate = async (targetDate) => {
    if (!draggedItem) return
    try {
      // Keep original hour/minute if possible
      const originalTime = draggedItem.time || '12:00 PM'
      const timeParts = originalTime.split(' ')
      const hourMin = timeParts[0].split(':')
      let hour = parseInt(hourMin[0])
      const minute = parseInt(hourMin[1])
      if (timeParts[1] === 'PM' && hour !== 12) hour += 12
      if (timeParts[1] === 'AM' && hour === 12) hour = 0

      const targetDateObj = new Date(2026, 5, targetDate, hour, minute) // June targetDate, 2026
      
      const res = await updateStudioPost(draggedItem.id, { scheduledAt: targetDateObj.toISOString(), status: 'scheduled' })
      if (res?.success) {
        showToast(`Rescheduled item to June ${targetDate}, 2026!`)
        setDraggedItem(null)
        await loadEvents()
      }
    } catch (err) {
      showToast(`Reschedule failed: ${err.message}`)
    }
  }

  const handleEdit = (ev) => {
    if (ev.type === 'Thread') {
      navigate('/threads', { state: { content: ev.content } })
    } else {
      navigate('/new-tweet', { state: { content: ev.content } })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        const res = await deleteStudioPost(id)
        if (res?.success) {
          showToast('Event removed successfully!')
          await loadEvents()
        }
      } catch (err) {
        showToast(`Error: ${err.message}`)
      }
    }
  }

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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            X Content Calendar
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            A unified visual timeline of scheduled tweets, thread queues, and draft deadlines.
          </p>
        </div>

        <div className="flex border border-gray-100 rounded-xl p-0.5 bg-white shadow-xs">
          {['Month', 'Week', 'Day'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                view === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Left Side: Dynamic Calendar Grid (3 columns) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            
            {/* Calendar Month Selector Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
                  <CalendarIcon className="w-4.5 h-4.5" />
                </span>
                <span className="text-sm font-bold text-gray-900">June 2026</span>
              </div>
              
              <div className="flex gap-1.5">
                <button className="flex h-8 w-8 items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 cursor-pointer transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 cursor-pointer transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid of Days (Month View) */}
            {loading ? (
              <div className="flex justify-center items-center py-24">
                <Clock className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : view === 'Month' ? (
              <div className="space-y-1">
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-50">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>

                {/* Day Blocks */}
                <div className="grid grid-cols-7 gap-1 pt-1.5">
                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const dayNum = idx + 1
                    const dayEvents = events.filter(ev => ev.date === dayNum)
                    
                    return (
                      <div
                        key={dayNum}
                        onClick={() => handleRescheduleDate(dayNum)}
                        className={`min-h-[90px] border border-gray-50 rounded-xl p-2 bg-gray-50/10 hover:bg-blue-50/10 hover:border-blue-200 transition cursor-pointer flex flex-col justify-between ${
                          draggedItem ? 'ring-1 ring-blue-400/30' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                          <span>{dayNum}</span>
                        </div>

                        {/* Events list inside cell */}
                        <div className="space-y-1 mt-1 flex-1 overflow-y-auto">
                          {dayEvents.map(ev => (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectDragItem(ev)
                              }}
                              className={`p-1.5 rounded-lg text-[9px] font-bold truncate transition cursor-pointer border ${
                                ev.status === 'Scheduled'
                                  ? 'bg-blue-50/50 border-blue-100 text-blue-700 hover:bg-blue-100/50'
                                  : 'bg-emerald-50/50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50'
                              }`}
                            >
                              {ev.type === 'Thread' ? '🧵 ' : ''}{ev.content}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                Week and Day views are being consolidated. Please use Month View for rescheduling workflows.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Item Rescheduling and Details Panel */}
        <div className="space-y-6">
          {draggedItem && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Active Rescheduling</h3>
                <button onClick={() => setDraggedItem(null)} className="text-gray-400 hover:text-gray-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 bg-blue-50/20 border border-blue-100/30 rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {draggedItem.type}
                </span>
                <p className="text-xs text-gray-800 leading-relaxed font-semibold">"{draggedItem.content}"</p>
                <p className="text-[9px] text-gray-400 font-medium">Currently: June {draggedItem.date} at {draggedItem.time}</p>
              </div>
              <p className="text-[10px] text-blue-700 font-medium leading-relaxed bg-blue-50/40 p-2.5 rounded-xl border border-blue-100/20">
                👉 Click any other date cell in the calendar grid to move this post.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Peak Performance Timetable
            </h3>

            <div className="space-y-3">
              {BEST_WINDOWS.map((win, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-gray-50 bg-gray-50/30 rounded-xl">
                  <div>
                    <span className="text-[10px] font-bold text-gray-700">{win.day} at {win.time}</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {win.score} Potential
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
