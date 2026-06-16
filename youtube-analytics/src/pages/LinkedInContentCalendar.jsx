import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
  Layers,
  Edit2,
  CheckCircle,
  HelpCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

const MOCK_EVENTS = [
  { id: 'ev1', title: 'Syndicating leverage B2B checklists', date: 2, time: '10:00 AM', type: 'ScheduledPost', category: 'Thought Leadership', color: 'bg-blue-500' },
  { id: 'ev2', title: 'Vite Rollups reducing build times to 1.9s', date: 8, time: '02:00 PM', type: 'ScheduledPost', category: 'Industry Insight', color: 'bg-emerald-500' },
  { id: 'ev3', title: '5 hooks for viral professional carousels', date: 15, time: '09:00 AM', type: 'DraftDeadline', category: 'Personal Post', color: 'bg-amber-500' },
  { id: 'ev4', title: 'Why traditional B2B lead gen is completely broken', date: 22, time: '11:30 AM', type: 'ScheduledPost', category: 'Story Post', color: 'bg-blue-500' },
  { id: 'ev5', title: 'Weekly SaaS compounding audit dispatches', date: 29, time: '04:00 PM', type: 'AutomationEvent', category: 'Thought Leadership', color: 'bg-purple-500' }
]

export default function LinkedInContentCalendar() {
  const navigate = useNavigate()
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [activeView, setActiveView] = useState('Month')
  const [currentMonth, setCurrentMonth] = useState('June 2026')
  const [selectedDay, setSelectedDay] = useState(null)
  
  // Modals state
  const [successToast, setSuccessToast] = useState('')
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [showQuickEdit, setShowQuickEdit] = useState(false)
  const [targetEvent, setTargetEvent] = useState(null)

  // Drag/Drop move source state
  const [dragItem, setDragItem] = useState(null)

  // Form State
  const [eventTitle, setEventTitle] = useState('')
  const [eventTime, setEventTime] = useState('10:00 AM')
  const [eventCat, setEventCat] = useState('Thought Leadership')
  const [eventType, setEventType] = useState('ScheduledPost')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Monthly grid indices (June 2026 starts on Monday, 30 days)
  const daysInJune = Array.from({ length: 30 }, (_, i) => i + 1)
  
  // Drag simulation (Click item to select, click another day to move)
  const handleItemSelect = (e, item) => {
    e.stopPropagation()
    setDragItem(item)
    showToast(`Selected "${item.title}". Click on any calendar day to reschedule!`)
  }

  const handleDayClick = (day) => {
    if (dragItem) {
      setEvents(events.map(ev => ev.id === dragItem.id ? { ...ev, date: day } : ev))
      showToast(`Rescheduled "${dragItem.title}" to June ${day}!`)
      setDragItem(null)
    } else {
      setSelectedDay(day)
      setEventTitle('')
      setEventTime('09:00 AM')
      setEventType('ScheduledPost')
      setEventCat('Thought Leadership')
      setShowQuickCreate(true)
    }
  }

  // Create event from calendar
  const handleCreateEvent = (e) => {
    e.preventDefault()
    if (!eventTitle.trim()) return

    const newEv = {
      id: 'ln-ev-' + Date.now(),
      title: eventTitle,
      date: selectedDay,
      time: eventTime,
      type: eventType,
      category: eventCat,
      color: eventType === 'ScheduledPost' ? 'bg-blue-500' : eventType === 'DraftDeadline' ? 'bg-amber-500' : 'bg-purple-500'
    }

    setEvents([...events, newEv])
    setShowQuickCreate(false)
    showToast('Scheduled post outline added to calendar successfully!')
  }

  // Open edit modal
  const openEditModal = (e, item) => {
    e.stopPropagation()
    setTargetEvent(item)
    setEventTitle(item.title)
    setEventTime(item.time)
    setEventType(item.type)
    setEventCat(item.category)
    setShowQuickEdit(true)
  }

  // Save quick edit
  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!targetEvent || !eventTitle.trim()) return

    setEvents(events.map(ev => ev.id === targetEvent.id ? {
      ...ev,
      title: eventTitle,
      time: eventTime,
      type: eventType,
      category: eventCat,
      color: eventType === 'ScheduledPost' ? 'bg-blue-500' : eventType === 'DraftDeadline' ? 'bg-amber-500' : 'bg-purple-500'
    } : ev))

    setShowQuickEdit(false)
    showToast('Calendar entry updated successfully!')
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            LinkedIn Content Calendar
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            A comprehensive, high-end editorial planner grid mapping LinkedIn thought-leadership dispatches and draft timelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex border border-gray-200 rounded-xl p-0.5 bg-white">
            {['Month', 'Week', 'Day'].map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeView === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Side: Interactive Calendar (3 columns wide) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
            
            {/* Calendar Month Control Bar */}
            <div className="flex justify-between items-center select-none">
              <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <CalendarIcon className="h-4.5 w-4.5 text-blue-600" />
                {currentMonth}
              </h2>
              <div className="flex gap-2">
                <button className="flex items-center justify-center h-8 w-8 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-600 cursor-pointer transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="flex items-center justify-center h-8 w-8 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-600 cursor-pointer transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Day Labels */}
            <div className="grid grid-cols-7 gap-2.5 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {daysInJune.map((day) => {
                const dayEvents = events.filter(e => e.date === day)
                const isSelected = dragItem ? 'hover:bg-blue-50/50 cursor-copy border-blue-200' : 'hover:bg-gray-50/50'

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] border border-gray-100 rounded-xl p-2.5 bg-gray-50/10 flex flex-col justify-between transition cursor-pointer select-none ${isSelected}`}
                  >
                    <span className="text-[10px] font-bold text-gray-400 pl-0.5">{day}</span>
                    <div className="space-y-1.5 mt-2 flex-1 flex flex-col justify-start">
                      {dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          onClick={(e) => handleItemSelect(e, ev)}
                          onDoubleClick={(e) => openEditModal(e, ev)}
                          className={`text-[9px] font-bold text-white px-2 py-1 rounded-lg ${ev.color} leading-snug truncate shadow-xs`}
                          title={`Double-click to edit. Single click to move.`}
                        >
                          <div className="flex justify-between items-center gap-1">
                            <span className="truncate">{ev.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Recommendations & Upcoming List (1 column wide) */}
        <div className="space-y-6">
          
          {/* AI optimal times panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4 select-none">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              Optimal Timing Slots
            </h3>

            <div className="space-y-3.5">
              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Mid-Week Resonance</span>
                <p className="text-xs font-bold text-gray-800 mt-1">Tuesdays @ 10:00 AM</p>
                <p className="text-[9px] text-gray-500 font-medium">B2B feeds experience 2.5x higher mid-morning CTR.</p>
              </div>

              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Weekend Leadership</span>
                <p className="text-xs font-bold text-gray-800 mt-1">Saturdays @ 09:30 AM</p>
                <p className="text-[9px] text-gray-500 font-medium">Contrarian debate threads receive 3.4x higher bookmarks.</p>
              </div>
            </div>
          </div>

          {/* Upcoming Event Outline summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Upcoming Calendar Lists
            </h3>

            <div className="space-y-3">
              {events.slice(0, 3).map(ev => (
                <div key={ev.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1 flex justify-between items-center">
                  <div className="min-w-0">
                    <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider">{ev.category}</span>
                    <p className="text-[10px] font-extrabold text-gray-900 truncate mt-0.5">{ev.title}</p>
                    <p className="text-[8px] text-gray-400 font-medium mt-0.5">June {ev.date} @ {ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Create Calendar Modal */}
      <AnimatePresence>
        {showQuickCreate && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleCreateEvent}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] shadow-2xl border border-gray-100 p-6 w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="h-4.5 w-4.5 text-blue-600" />
                  Quick Plan LinkedIn Post (June {selectedDay})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickCreate(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Post Title Outline</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Compounding Social Blueprints"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Target Time</label>
                    <input
                      type="text"
                      required
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                    >
                      <option value="ScheduledPost">Scheduled Post</option>
                      <option value="DraftDeadline">Draft Deadline</option>
                      <option value="AutomationEvent">Automation Rule</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">B2B Category</label>
                  <select
                    value={eventCat}
                    onChange={(e) => setEventCat(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    <option value="Thought Leadership">Thought Leadership</option>
                    <option value="Industry Insight">Industry Insight</option>
                    <option value="Personal Post">Personal Post</option>
                    <option value="Story Post">Story Post</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCreate(false)}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Create Plan
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Edit Calendar Modal */}
      <AnimatePresence>
        {showQuickEdit && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleSaveEdit}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] shadow-2xl border border-gray-100 p-6 w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Edit2 className="h-4.5 w-4.5 text-blue-600" />
                  Quick Edit Calendar Entry (June {targetEvent?.date})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickEdit(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Post Title Outline</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Compounding Social Blueprints"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Target Time</label>
                    <input
                      type="text"
                      required
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                    >
                      <option value="ScheduledPost">Scheduled Post</option>
                      <option value="DraftDeadline">Draft Deadline</option>
                      <option value="AutomationEvent">Automation Rule</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">B2B Category</label>
                  <select
                    value={eventCat}
                    onChange={(e) => setEventCat(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    <option value="Thought Leadership">Thought Leadership</option>
                    <option value="Industry Insight">Industry Insight</option>
                    <option value="Personal Post">Personal Post</option>
                    <option value="Story Post">Story Post</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickEdit(false)}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Save Entry
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
