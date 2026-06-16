import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlatform } from '../../hooks/usePlatform'
import { ChevronDown } from 'lucide-react'

// Custom Platform Icons to avoid dependency/export issues in ESM environments
const Youtube = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
  </svg>
)

const Instagram = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const Linkedin = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

// Custom Twitter/X Icon path
const TwitterX = (props) => (
  <svg
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

const platforms = [
  {
    value: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    gradient: 'from-rose-500 to-red-600',
    glow: 'shadow-red-500/10',
    lightBg: 'bg-red-50/50',
    textColor: 'text-red-600',
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-indigo-600',
    glow: 'shadow-purple-500/10',
    lightBg: 'bg-purple-50/50',
    textColor: 'text-purple-600',
  },
  {
    value: 'twitter',
    label: 'Twitter/X',
    icon: TwitterX,
    color: '#000000',
    gradient: 'from-neutral-800 to-neutral-950',
    glow: 'shadow-black/10',
    lightBg: 'bg-neutral-50',
    textColor: 'text-neutral-950',
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: '#0077B5',
    gradient: 'from-blue-600 to-sky-500',
    glow: 'shadow-blue-500/10',
    lightBg: 'bg-blue-50/50',
    textColor: 'text-blue-600',
  },
]

export default function PlatformSwitcher() {
  const { selectedPlatform, setPlatform } = usePlatform()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const activePlatform = platforms.find((p) => p.value === selectedPlatform) || platforms[0]
  const ActiveIcon = activePlatform.icon

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative z-50" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:border-gray-200 hover:shadow-md active:scale-95`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${activePlatform.gradient} text-white shadow-sm`}
        >
          <ActiveIcon className="h-3.5 w-3.5" />
        </span>
        <span className="tracking-wide">{activePlatform.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 mt-2 w-48 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl"
            style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.06))' }}
          >
            {platforms.map((p) => {
              const IconComp = p.icon
              const isSelected = p.value === selectedPlatform

              return (
                <button
                  key={p.value}
                  onClick={() => {
                    setPlatform(p.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? `${p.lightBg} ${p.textColor} font-semibold`
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      isSelected ? `bg-gradient-to-br ${p.gradient} text-white shadow-sm` : 'bg-gray-100 text-gray-500'
                    } transition-all duration-300`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1">{p.label}</span>
                  {isSelected && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
