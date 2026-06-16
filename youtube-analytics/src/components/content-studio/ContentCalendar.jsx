import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle, FileEdit, Send, Loader2 } from 'lucide-react'
import { getCalendarEvents, getStudioPosts, updateStudioPost, deleteStudioPost, scheduleStudioPost, publishStudioPost } from '../../services/api'

const VIEWS = ['month', 'week', 'day']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const STATUS_CONFIG = {
  draft: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: FileEdit, label: 'Draft' },
  scheduled: { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Clock, label: 'Scheduled' },
  publishing: { color: 'bg-amber-50 text-amber-600 border-amber-200', icon: Loader2, label: 'Publishing' },
  published: { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle, label: 'Published' },
  failed: { color: 'bg-red-50 text-red-600 border-red-200', icon: Send, label: 'Failed' },
}

const PLATFORM_COLORS = {
  linkedin: 'bg-blue-500',
  twitter: 'bg-sky-500',
  instagram: 'bg-pink-500',
  threads: 'bg-purple-500',
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function ContentCalendar() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    if (isOpen) loadEvents()
  }, [isOpen, view, currentDate])

  const loadEvents = async () => {
    setIsLoading(true)
    try {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      const res = await getCalendarEvents(start.toISOString(), end.toISOString())
      setEvents(res?.data || [])
    } catch {
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setCurrentDate(d)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => {
      const d = new Date(e.scheduledAt || e.createdAt)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === dateStr
    })
  }

  const handleDelete = async (id) => {
    try {
      await deleteStudioPost(id)
      setEvents(events.filter(e => e._id !== id))
      setSelectedEvent(null)
    } catch { /* non-blocking */ }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      if (newStatus === 'scheduled') {
        const date = prompt('Enter schedule date (YYYY-MM-DD HH:MM):')
        if (!date) return
        const res = await scheduleStudioPost(id, new Date(date).toISOString())
        setEvents(events.map(e => e._id === id ? res.data : e))
      } else {
        const res = await updateStudioPost(id, { status: newStatus })
        setEvents(events.map(e => e._id === id ? res.data : e))
      }
      if (selectedEvent?._id === id) {
        setSelectedEvent({ ...selectedEvent, status: newStatus })
      }
    } catch { /* non-blocking */ }
  }

  const today = new Date()
  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Content Calendar</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Schedule, manage, and track your multi-platform content pipeline</p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600 transition-colors">
          {isOpen ? <span className="text-sm">&#9650;</span> : <span className="text-sm">&#9660;</span>}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-6 pt-3 border-t border-gray-50 space-y-5 bg-gray-50">
              {/* Calendar Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition cursor-pointer">
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <h3 className="text-[15px] font-bold text-gray-900">{MONTHS[month]} {year}</h3>
                  <button onClick={() => navigate(1)} className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition cursor-pointer">
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <div className="flex bg-white rounded-lg border border-gray-100 overflow-hidden">
                  {VIEWS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${view === v ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar Grid */}
              {isLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-emerald-100 border-t-emerald-600" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 border-b border-gray-50">
                    {DAYS.map((day) => (
                      <div key={day} className="py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">{day}</div>
                    ))}
                  </div>

                  {/* Day Cells */}
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/30" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1
                      const dayEvents = getEventsForDay(day)
                      const today_ = isToday(day)
                      return (
                        <div
                          key={day}
                          className={`min-h-[80px] border-b border-r border-gray-50 p-1.5 ${today_ ? 'bg-emerald-50/30' : ''}`}
                        >
                          <span className={`text-[11px] font-bold ${today_ ? 'text-emerald-600' : 'text-gray-500'}`}>{day}</span>
                          <div className="space-y-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((ev) => {
                              const sc = STATUS_CONFIG[ev.status] || STATUS_CONFIG.draft
                              const pc = PLATFORM_COLORS[ev.platform] || 'bg-gray-400'
                              return (
                                <button
                                  key={ev._id}
                                  onClick={() => setSelectedEvent(ev)}
                                  className="w-full text-left cursor-pointer"
                                >
                                  <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${sc.color} border truncate`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${pc} shrink-0`} />
                                    <span className="truncate">{ev.topic || ev.content?.hook?.slice(0, 20) || ev.platform}</span>
                                  </div>
                                </button>
                              )
                            })}
                            {dayEvents.length > 3 && (
                              <p className="text-[9px] text-gray-400 font-semibold pl-1.5">+{dayEvents.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Event Detail Panel */}
              <AnimatePresence>
                {selectedEvent && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${PLATFORM_COLORS[selectedEvent.platform] || 'bg-gray-400'}`} />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{selectedEvent.platform}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${(STATUS_CONFIG[selectedEvent.status] || STATUS_CONFIG.draft).color}`}>
                          {selectedEvent.status}
                        </span>
                      </div>
                      <button onClick={() => setSelectedEvent(null)} className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer">Close</button>
                    </div>
                    {selectedEvent.topic && <p className="text-[13px] font-bold text-gray-900">{selectedEvent.topic}</p>}
                    {selectedEvent.content?.hook && <p className="text-[12px] text-gray-600">{selectedEvent.content.hook}</p>}
                    {selectedEvent.scheduledAt && (
                      <p className="text-[11px] text-gray-400">Scheduled: {new Date(selectedEvent.scheduledAt).toLocaleString()}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleStatusChange(selectedEvent._id, 'scheduled')}
                        className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100/50 transition cursor-pointer"
                      >Schedule</button>
                      <button
                        onClick={() => handleStatusChange(selectedEvent._id, 'draft')}
                        className="text-[10px] font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-100 transition cursor-pointer"
                      >Save Draft</button>
                      <button
                        onClick={() => handleDelete(selectedEvent._id)}
                        className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100/50 transition cursor-pointer ml-auto"
                      >Delete</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scheduled Posts Queue Table */}
              <div className="border-t border-gray-200/50 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-500" /> Active Publishing Queue & Status Tracking
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {events.length} Active Posts
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3">Platform</th>
                        <th className="px-4 py-3">Content</th>
                        <th className="px-4 py-3">Scheduled For</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[12px] text-gray-700">
                      {events.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-gray-400 font-semibold">
                            No scheduled or published posts found. Use generators above to schedule some!
                          </td>
                        </tr>
                      ) : (
                        events.map((ev) => {
                          const sc = STATUS_CONFIG[ev.status] || STATUS_CONFIG.draft
                          const StatusIcon = sc.icon
                          const fullText = ev.content?.fullText || ev.content?.hook || 'No content hook'
                          
                          return (
                            <tr key={ev._id} className="hover:bg-gray-50/20 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-gray-500">
                                  <span className={`h-2 w-2 rounded-full ${PLATFORM_COLORS[ev.platform] || 'bg-gray-400'}`} />
                                  {ev.platform}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-[200px] truncate">
                                <span className="font-semibold text-gray-800">{ev.topic || 'No Topic'}</span>
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">{fullText}</p>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-medium">
                                {ev.scheduledAt ? new Date(ev.scheduledAt).toLocaleString() : 'Not Scheduled'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${sc.color}`}>
                                  <StatusIcon className="h-3 w-3 shrink-0" />
                                  {sc.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                                {ev.status !== 'published' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await publishStudioPost(ev._id)
                                        loadEvents()
                                      } catch { /* ignored */ }
                                    }}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/50 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition cursor-pointer"
                                  >
                                    Publish Now
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    await handleDelete(ev._id)
                                    loadEvents()
                                  }}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/50 px-2.5 py-1.5 rounded-lg border border-red-100 transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
