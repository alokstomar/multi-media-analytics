import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  Activity,
  Award,
  Clock,
  HelpCircle,
  BarChart2
} from 'lucide-react'

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

const HOURS = ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Matrix mapping days and hours to resonance scores (0-100)
const MOCK_HEATMAP = {
  'Mon': [65, 80, 75, 60, 70, 55, 40],
  'Tue': [70, 95, 85, 65, 75, 60, 45],
  'Wed': [75, 90, 80, 70, 80, 65, 50],
  'Thu': [70, 85, 75, 65, 75, 55, 45],
  'Fri': [60, 70, 65, 50, 60, 45, 30],
  'Sat': [40, 55, 50, 40, 45, 35, 25],
  'Sun': [45, 60, 55, 45, 50, 40, 30]
}

export default function LinkedInBestPostingSchedule() {
  const [activeTab, setActiveTab] = useState('Daily')
  const [heatmap, setHeatmap] = useState(MOCK_HEATMAP)

  // Retrieve bg color index based on resonance rating
  const getHeatmapColor = (score) => {
    if (score >= 90) return 'bg-blue-600 text-white font-extrabold shadow-sm'
    if (score >= 80) return 'bg-blue-500/80 text-white font-bold'
    if (score >= 70) return 'bg-blue-400/60 text-blue-900 font-semibold'
    if (score >= 50) return 'bg-blue-200/40 text-blue-800'
    if (score >= 35) return 'bg-blue-50/50 text-blue-600'
    return 'bg-gray-50/50 text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            Best Posting Times
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Analyze historical professional impressions, monitor algorithmic resonance peaks, and target recommended schedule times.
          </p>
        </div>

        <div className="flex border border-gray-200 rounded-xl p-0.5 bg-white select-none">
          {['Daily', 'Weekly'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t} View
            </button>
          ))}
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Side: Heatmap (3 columns wide) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6 select-none">
            
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <BarChart2 className="h-4.5 w-4.5 text-blue-600 animate-pulse" />
                Algorithmic Resonance Heatmap
              </h2>
              <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                B2B Professional Sector
              </span>
            </div>

            {/* Heatmap Grid */}
            <div className="space-y-3.5 overflow-x-auto pb-2">
              <div className="min-w-[640px] space-y-3">
                {/* Header hours */}
                <div className="grid grid-cols-8 gap-2.5 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                  <span>Day</span>
                  {HOURS.map(h => <span key={h}>{h}</span>)}
                </div>

                {/* Day Rows */}
                {DAYS.map(day => {
                  const scores = heatmap[day] || []
                  return (
                    <div key={day} className="grid grid-cols-8 gap-2 items-center text-center">
                      <span className="text-[11px] font-extrabold text-gray-600 text-left pl-2 capitalize">{day}</span>
                      {scores.map((score, idx) => (
                        <div
                          key={idx}
                          className={`h-11 rounded-xl flex flex-col justify-center items-center text-xs transition duration-200 hover:scale-[1.04] cursor-help ${getHeatmapColor(score)}`}
                          title={`Resonance Potential: ${score}%`}
                        >
                          <span className="text-[11px] font-extrabold">{score}%</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend guide */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              <span>Heatmap Resonance Scale:</span>
              <div className="flex gap-2">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-100 border" /> Idle (&lt; 35%)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100" /> Active (50%+)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-400" /> Peak (70%+)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-600" /> Critical (90%+)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Recommendations & Analytics (1 column wide) */}
        <div className="space-y-6">
          
          {/* Optimal parameters recommendations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5 select-none">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              Scheduling Recommendations
            </h3>

            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Best Day</span>
                <p className="text-xs font-bold text-gray-800 mt-1">Tuesday</p>
                <p className="text-[9px] text-gray-500 font-medium">B2B marketing feeds peak on Tuesdays, experiencing 1.8x higher traffic.</p>
              </div>

              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Best Time</span>
                <p className="text-xs font-bold text-gray-800 mt-1">10:00 AM</p>
                <p className="text-[9px] text-gray-500 font-medium">Mid-morning slots align with corporate professional workflows.</p>
              </div>

              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Best Weekly Cadence</span>
                <p className="text-xs font-bold text-gray-800 mt-1">3x Weekly</p>
                <p className="text-[9px] text-gray-500 font-medium">Publishing on Tuesdays, Wednesdays, and Thursdays maximizes SSI index overlap.</p>
              </div>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4 select-none">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              Algorithm Metrics
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>Engagement Potential</span>
                  <span className="text-blue-600">Excellent (85%)</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>Lead Potential Score</span>
                  <span className="text-purple-600 font-extrabold">Outstanding (94%)</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: '94%' }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>Audience Activity</span>
                  <span className="text-emerald-600">High Peak</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '92%' }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>Competition Level</span>
                  <span className="text-amber-600">Medium</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '55%' }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
