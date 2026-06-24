import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Bell, Shield, Palette, Globe, CreditCard, Link2, Key,
  ChevronRight, Camera, Mail, Phone, MapPin, Building2, Check,
  Moon, Sun, Monitor, Volume2, VolumeX, Smartphone, Laptop,
  Download, Trash2, LogOut, ExternalLink, Sparkles, Zap,
  X, CheckCircle2, AlertTriangle, Copy, Eye, EyeOff, RefreshCw,
} from 'lucide-react'
import { getAIUsageStats, getQueueMetrics, getProfile, updateProfile as apiUpdateProfile, uploadAvatar, removeAvatarApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

/* ── Storage helpers ─────────────────────────────────────────── */
const STORAGE_KEY = 'yt_analytics_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveSettings(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    // Notify same-tab listeners (Sidebar, Header, etc.) about the change
    window.dispatchEvent(new Event('settings-updated'))
  } catch {}
}

/* ── Default state ───────────────────────────────────────────── */
// No hardcoded profile — all values loaded from GET /api/settings/profile
const emptyProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  org: '',
  bio: '',
  avatar: '',
}

const defaultNotifs = { email: true, push: true, sms: false, viral: true, comments: true, competitors: false, weekly: true, monthly: false }

const defaultIntegrations = {
  youtube: true,
  googleAnalytics: true,
  instagram: false,
  twitter: false,
  discord: false,
  slack: true,
}

const defaultAppearance = {
  theme: 'light',
  dateFormat: 'DD/MM/YYYY',
  language: 'English (US)',
  timezone: 'IST (UTC+5:30)',
}

/* ── Tabs config ─────────────────────────────────────────────── */
const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'integrations', label: 'Integrations', icon: Link2 },
  { key: 'ai_usage', label: 'AI Growth Usage', icon: Sparkles },
  { key: 'scheduler', label: 'Scheduler Engine', icon: Zap },
  { key: 'billing', label: 'Billing', icon: CreditCard },
]

/* ── Toast component ─────────────────────────────────────────── */
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const icons = { success: CheckCircle2, error: AlertTriangle, info: Check }
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' }
  const Icon = icons[type] || Check

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl ${colors[type]} text-white px-5 py-3.5 shadow-2xl`}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="text-[13px] font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded-lg p-1 transition"><X className="h-3.5 w-3.5" /></button>
    </motion.div>
  )
}

/* ── Confirmation Modal ──────────────────────────────────────── */
function ConfirmModal({ title, desc, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-blue-50'}`}>
            <AlertTriangle className={`h-5 w-5 ${danger ? 'text-red-500' : 'text-blue-500'}`} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="rounded-xl border border-gray-200 text-gray-500 text-[13px] font-medium px-5 py-2.5 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className={`rounded-xl text-white text-[13px] font-semibold px-5 py-2.5 transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Toggle component ────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer ${on ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <motion.div layout className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm ${on ? 'left-[22px]' : 'left-[3px]'}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </button>
  )
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({ title, desc, children, noBorder }) {
  return (
    <div className={`py-6 ${noBorder ? '' : 'border-b border-gray-100'}`}>
      <div className="mb-4">
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-[12px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

/* ── Controlled input field ──────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', placeholder, icon: Icon, disabled }) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div>
      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all ${Icon ? 'pl-9' : 'pl-3.5'} ${isPassword ? 'pr-10' : 'pr-3.5'} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/* ── Initials Avatar helper ──────────────────────────────────────── */
function InitialsAvatar({ firstName, lastName, size = 80 }) {
  const fn = (firstName || '').trim()
  const ln = (lastName || '').trim()
  const initials = fn && ln
    ? `${fn[0]}${ln[0]}`.toUpperCase()
    : fn ? fn[0].toUpperCase()
    : ln ? ln[0].toUpperCase()
    : 'U'
  const colors = [
    'from-blue-500 to-violet-600',
    'from-emerald-500 to-cyan-600',
    'from-orange-500 to-red-600',
    'from-violet-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ]
  const colorIdx = ((fn.charCodeAt(0) || 0) + (ln.charCodeAt(0) || 0)) % colors.length
  return (
    <div
      className={`bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white font-bold select-none rounded-2xl`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  )
}

export default function Settings() {
  const saved = loadSettings()
  const { user, updateUser } = useAuth()

  const [activeTab, setActiveTab] = useState('profile')
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)

  // Profile state — loaded from API, not from hardcoded defaults
  const [profile, setProfile] = useState({ ...emptyProfile })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileDirty, setProfileDirty] = useState(false)

  // Notifications state
  const [notifs, setNotifs] = useState(saved?.notifs || { ...defaultNotifs })

  // Security state
  const [twoFA, setTwoFA] = useState(saved?.twoFA ?? true)
  const [passwords, setPasswords] = useState({ current: '', newPwd: '', confirm: '' })
  const [sessions, setSessions] = useState([
    { device: 'MacBook Pro — Chrome', location: 'Mumbai, India', time: 'Active now', current: true, icon: Laptop },
    { device: 'iPhone 15 Pro — Safari', location: 'Mumbai, India', time: '2 hours ago', current: false, icon: Smartphone },
    { device: 'Windows PC — Edge', location: 'Delhi, India', time: '3 days ago', current: false, icon: Monitor },
  ])

  // Appearance state
  const [appearance, setAppearance] = useState(saved?.appearance || { ...defaultAppearance })

  // Integrations state
  const [integrations, setIntegrations] = useState(saved?.integrations || { ...defaultIntegrations })

  // API Key
  const [apiKey, setApiKey] = useState(saved?.apiKey || 'ca_live_sk_a8f2e1b4c9d3f7a2e6b8c4d1f9a3e7b2')
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // AI Usage & Scheduler Metrics state
  const [aiUsageStats, setAiUsageStats] = useState(null)
  const [queueMetrics, setQueueMetrics] = useState(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [loadingQueue, setLoadingQueue] = useState(false)

  const fetchAIUsage = async () => {
    setLoadingUsage(true)
    try {
      const res = await getAIUsageStats()
      if (res?.success) {
        setAiUsageStats(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch AI Usage stats:', err)
    } finally {
      setLoadingUsage(false)
    }
  }

  const fetchQueueStats = async () => {
    setLoadingQueue(true)
    try {
      const res = await getQueueMetrics()
      if (res?.success) {
        setQueueMetrics(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch Queue metrics:', err)
    } finally {
      setLoadingQueue(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'ai_usage') {
      fetchAIUsage()
    } else if (activeTab === 'scheduler') {
      fetchQueueStats()
    }
  }, [activeTab])

  // File input ref
  const fileInputRef = useRef(null)

  // Load profile from API on mount
  useEffect(() => {
    let cancelled = false
    setProfileLoading(true)
    getProfile()
      .then(res => {
        if (cancelled) return
        if (res?.success && res.data) {
          const d = res.data
          setProfile({
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            email: d.email || '',
            phone: d.phone || '',
            location: d.location || '',
            org: d.organization || '',
            bio: d.bio || '',
            avatar: d.avatar || '',
          })
        }
      })
      .catch(() => {
        // If profile fetch fails, fall back to what's in AuthContext
        if (!cancelled && user) {
          setProfile({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            location: user.location || '',
            org: user.organization || '',
            bio: user.bio || '',
            avatar: user.avatar || '',
          })
        }
      })
      .finally(() => { if (!cancelled) setProfileLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist non-profile prefs to localStorage (theme, notifs, etc.)
  useEffect(() => {
    saveSettings({ notifs, twoFA, appearance, integrations, apiKey })
  }, [notifs, twoFA, appearance, integrations, apiKey])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // ── Profile handlers ──────────────────────
  const updateProfileField = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }))
    setProfileDirty(true)
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const res = await apiUpdateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        location: profile.location,
        organization: profile.org,
        bio: profile.bio,
      })
      if (res?.success) {
        // Keep AuthContext in sync so Header updates immediately
        updateUser({
          firstName: profile.firstName,
          lastName: profile.lastName,
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          phone: profile.phone,
          location: profile.location,
          organization: profile.org,
          bio: profile.bio,
        })
        setProfileDirty(false)
        showToast('Profile saved successfully!')
      } else {
        showToast('Failed to save profile', 'error')
      }
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save profile', 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  const cancelProfile = useCallback(() => {
    // Reload from API to discard local edits
    setProfileLoading(true)
    setProfileDirty(false)
    getProfile()
      .then(res => {
        if (res?.success && res.data) {
          const d = res.data
          setProfile({
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            email: d.email || '',
            phone: d.phone || '',
            location: d.location || '',
            org: d.organization || '',
            bio: d.bio || '',
            avatar: d.avatar || '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
    showToast('Changes discarded', 'info')
  }, [])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('File too large. Max 2MB allowed.', 'error')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      showToast('Only JPG, PNG, GIF, or WebP allowed.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result
      try {
        const res = await uploadAvatar(base64)
        if (res?.success) {
          updateProfileField('avatar', base64)
          updateUser({ avatar: base64 })
          showToast('Avatar updated!')
        } else {
          showToast('Failed to upload avatar', 'error')
        }
      } catch (err) {
        showToast(err?.response?.data?.error || 'Failed to upload avatar', 'error')
      }
    }
    reader.readAsDataURL(file)
  }

  const removeAvatar = async () => {
    try {
      const res = await removeAvatarApi()
      if (res?.success) {
        updateProfileField('avatar', '')
        updateUser({ avatar: '' })
        showToast('Avatar removed', 'info')
      }
    } catch {
      showToast('Failed to remove avatar', 'error')
    }
  }

  // ── Notification handlers ─────────────────
  const toggleNotif = (key, value) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: value }
      return next
    })
    showToast(value ? 'Notification enabled' : 'Notification disabled', 'info')
  }

  // ── Security handlers ─────────────────────
  const handlePasswordUpdate = () => {
    if (!passwords.current) { showToast('Enter your current password', 'error'); return }
    if (passwords.newPwd.length < 8) { showToast('New password must be at least 8 characters', 'error'); return }
    if (passwords.newPwd !== passwords.confirm) { showToast('Passwords do not match', 'error'); return }
    setPasswords({ current: '', newPwd: '', confirm: '' })
    showToast('Password updated successfully!')
  }

  const toggleTwoFA = (value) => {
    setTwoFA(value)
    showToast(value ? '2FA enabled — your account is more secure' : '2FA disabled', value ? 'success' : 'info')
  }

  const revokeSession = (device) => {
    setModal({
      title: 'Revoke Session',
      desc: `Are you sure you want to sign out from "${device}"?`,
      confirmLabel: 'Revoke',
      danger: true,
      onConfirm: () => {
        setSessions(prev => prev.filter(s => s.device !== device))
        setModal(null)
        showToast('Session revoked successfully')
      },
    })
  }

  // ── Appearance handlers ───────────────────
  const setTheme = (t) => {
    setAppearance(prev => ({ ...prev, theme: t }))
    showToast(`Theme set to ${t}`, 'info')
  }

  // ── Integration handlers ──────────────────
  const toggleIntegration = (key) => {
    const isConnected = integrations[key]
    if (isConnected) {
      setModal({
        title: 'Disconnect Integration',
        desc: `Are you sure you want to disconnect this platform?`,
        confirmLabel: 'Disconnect',
        danger: true,
        onConfirm: () => {
          setIntegrations(prev => ({ ...prev, [key]: false }))
          setModal(null)
          showToast('Integration disconnected')
        },
      })
    } else {
      setIntegrations(prev => ({ ...prev, [key]: true }))
      showToast('Integration connected!')
    }
  }

  // ── API Key handlers ──────────────────────
  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setApiKeyCopied(true)
      showToast('API key copied to clipboard!')
      setTimeout(() => setApiKeyCopied(false), 2000)
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  const regenerateApiKey = () => {
    setModal({
      title: 'Regenerate API Key',
      desc: 'Your current key will stop working immediately. Any apps using this key will lose access.',
      confirmLabel: 'Regenerate',
      danger: true,
      onConfirm: () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        const newKey = 'ca_live_sk_' + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
        setApiKey(newKey)
        setModal(null)
        showToast('API key regenerated!')
      },
    })
  }

  // ── Data Export ───────────────────────────
  const handleExportData = () => {
    const data = { profile, notifs, appearance, integrations, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creator-analytics-settings.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Data exported as JSON!')
  }

  // ── Danger zone ───────────────────────────
  const handleDeleteAccount = () => {
    setModal({
      title: 'Delete Account',
      desc: 'This will permanently delete your account and all associated data. This action cannot be undone.',
      confirmLabel: 'Delete Account',
      danger: true,
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY)
        setModal(null)
        showToast('Account deleted (demo mode)', 'info')
      },
    })
  }

  const handleSignOut = () => {
    setModal({
      title: 'Sign Out',
      desc: 'Are you sure you want to sign out of your account?',
      confirmLabel: 'Sign Out',
      danger: false,
      onConfirm: () => {
        setModal(null)
        showToast('Signed out (demo mode)', 'info')
      },
    })
  }

  // ── Integration config ────────────────────
  const integrationsList = [
    { key: 'youtube', name: 'YouTube', desc: integrations.youtube ? '4 channels connected' : 'Connect your YouTube channels', color: '#EF4444', icon: '▶' },
    { key: 'googleAnalytics', name: 'Google Analytics', desc: integrations.googleAnalytics ? 'Tracking website traffic from videos' : 'Track website traffic from videos', color: '#F59E0B', icon: '📊' },
    { key: 'instagram', name: 'Instagram', desc: integrations.instagram ? 'Connected — syncing audience data' : 'Cross-platform audience insights', color: '#E1306C', icon: '📷' },
    { key: 'twitter', name: 'Twitter / X', desc: integrations.twitter ? 'Monitoring social mentions' : 'Monitor social mentions', color: '#1DA1F2', icon: '𝕏' },
    { key: 'discord', name: 'Discord', desc: integrations.discord ? 'Tracking community engagement' : 'Community engagement tracking', color: '#5865F2', icon: '💬' },
    { key: 'slack', name: 'Slack', desc: integrations.slack ? 'Sending alerts to workspace' : 'Alert notifications to workspace', color: '#4A154B', icon: '#' },
  ]

  return (
    <div className="min-h-screen space-y-7">
      {/* Hidden file input for avatar */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} />

      {/* ── Header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-400">Configure your account and preferences.</p>
      </div>

      {/* ── Main layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left: Navigation tabs */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="lg:col-span-1">
          <div className="rounded-[20px] border border-gray-100 bg-white p-3" style={{ boxShadow: cs }}>
            <div className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                )
              })}
            </div>

            {/* Danger zone */}
            <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
              <button onClick={handleExportData} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all cursor-pointer"><Download className="h-4 w-4" />Export Data</button>
              <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"><Trash2 className="h-4 w-4" />Delete Account</button>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all cursor-pointer"><LogOut className="h-4 w-4" />Sign Out</button>
            </div>
          </div>
        </motion.div>

        {/* Right: Content */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="lg:col-span-3">
          <div className="rounded-[20px] border border-gray-100 bg-white p-6 lg:p-8" style={{ boxShadow: cs }}>

            {/* ═══ PROFILE TAB ═══ */}
            {activeTab === 'profile' && (
              <>
                {profileLoading ? (
                  /* Loading skeleton */
                  <div className="space-y-6 animate-pulse">
                    <div>
                      <div className="h-4 w-28 bg-gray-100 rounded-lg mb-4" />
                      <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-2xl bg-gray-100" />
                        <div className="space-y-2">
                          <div className="h-8 w-28 bg-gray-100 rounded-xl" />
                          <div className="h-4 w-36 bg-gray-100 rounded-lg" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
                    </div>
                    <div className="h-24 bg-gray-100 rounded-xl" />
                  </div>
                ) : (
                  <>
                    <Section title="Profile Photo" desc="This will be displayed on your public profile.">
                      <div className="flex items-center gap-5">
                        <div className="relative group">
                          {profile.avatar ? (
                            <img src={profile.avatar} alt="Avatar" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-gray-100" />
                          ) : (
                            <InitialsAvatar firstName={profile.firstName} lastName={profile.lastName} size={80} />
                          )}
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                          >
                            <Camera className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-blue-600 text-white text-[12px] font-semibold px-4 py-2 hover:bg-blue-700 transition cursor-pointer">Upload Photo</button>
                            {profile.avatar && (
                              <button onClick={removeAvatar} className="rounded-xl border border-gray-200 text-gray-500 text-[12px] font-medium px-4 py-2 hover:bg-gray-50 transition cursor-pointer">Remove</button>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-300">JPG, PNG, GIF or WebP. Max 2MB.</p>
                        </div>
                      </div>
                    </Section>

                    <Section title="Personal Information" desc="Update your personal details.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="First Name" value={profile.firstName} onChange={(v) => updateProfileField('firstName', v)} icon={User} />
                        <Field label="Last Name" value={profile.lastName} onChange={(v) => updateProfileField('lastName', v)} icon={User} />
                        <div>
                          <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                            <input
                              type="email"
                              value={profile.email}
                              disabled
                              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400 pl-9 pr-3.5 opacity-70 cursor-not-allowed"
                            />
                          </div>
                          <p className="text-[10px] text-gray-300 mt-1">Email address cannot be changed. Contact support to update it.</p>
                        </div>
                        <Field label="Phone Number" value={profile.phone} onChange={(v) => updateProfileField('phone', v)} icon={Phone} placeholder="+1 (555) 000-0000" />
                        <Field label="Location" value={profile.location} onChange={(v) => updateProfileField('location', v)} icon={MapPin} placeholder="City, Country" />
                        <Field label="Organization" value={profile.org} onChange={(v) => updateProfileField('org', v)} icon={Building2} placeholder="Your company or brand" />
                      </div>
                    </Section>

                    <Section title="Bio" desc="Brief description for your profile." noBorder>
                      <textarea
                        value={profile.bio}
                        onChange={(e) => updateProfileField('bio', e.target.value)}
                        placeholder="Tell the world a little about yourself..."
                        className="w-full h-24 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-300 p-3.5 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                      />
                    </Section>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-2">
                      {profileDirty && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-amber-500 font-medium flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Unsaved changes
                        </motion.p>
                      )}
                      {!profileDirty && <div />}
                      <div className="flex gap-3">
                        <button onClick={cancelProfile} disabled={!profileDirty || profileSaving} className={`rounded-xl border border-gray-200 text-gray-500 text-[13px] font-medium px-5 py-2.5 transition cursor-pointer ${profileDirty && !profileSaving ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}>Cancel</button>
                        <button
                          onClick={saveProfile}
                          disabled={!profileDirty || profileSaving}
                          className={`rounded-xl bg-blue-600 text-white text-[13px] font-semibold px-5 py-2.5 transition cursor-pointer flex items-center gap-2 ${profileDirty && !profileSaving ? 'hover:bg-blue-700' : 'opacity-40 cursor-not-allowed'}`}
                        >
                          {profileSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          {profileSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══ NOTIFICATIONS TAB ═══ */}
            {activeTab === 'notifications' && (
              <>
                <Section title="Notification Channels" desc="Choose how you receive notifications.">
                  <div className="space-y-4">
                    {[
                      { key: 'email', label: 'Email Notifications', desc: 'Receive alerts via email', icon: Mail },
                      { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications', icon: Smartphone },
                      { key: 'sms', label: 'SMS Notifications', desc: 'Text message alerts for critical events', icon: Phone },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50/50 transition">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50"><item.icon className="h-4 w-4 text-blue-500" /></div>
                          <div><p className="text-[13px] font-semibold text-gray-800">{item.label}</p><p className="text-[11px] text-gray-400">{item.desc}</p></div>
                        </div>
                        <Toggle on={notifs[item.key]} onChange={(v) => toggleNotif(item.key, v)} />
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Alert Preferences" desc="Customize which alerts you receive." noBorder>
                  <div className="space-y-4">
                    {[
                      { key: 'viral', label: 'Viral Spike Alerts', desc: 'When a video starts trending unexpectedly', color: '#EF4444' },
                      { key: 'comments', label: 'Comment Alerts', desc: 'Toxic comments, FAQ patterns, sentiment changes', color: '#F59E0B' },
                      { key: 'competitors', label: 'Competitor Alerts', desc: 'When competitors upload or go viral', color: '#6366F1' },
                      { key: 'weekly', label: 'Weekly Digest', desc: 'Summary of channel performance every Monday', color: '#10B981' },
                      { key: 'monthly', label: 'Monthly Report', desc: 'Detailed analytics report at month-end', color: '#8B5CF6' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50/50 transition">
                        <div className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <div><p className="text-[13px] font-semibold text-gray-800">{item.label}</p><p className="text-[11px] text-gray-400">{item.desc}</p></div>
                        </div>
                        <Toggle on={notifs[item.key]} onChange={(v) => toggleNotif(item.key, v)} />
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ═══ SECURITY TAB ═══ */}
            {activeTab === 'security' && (
              <>
                <Section title="Password" desc="Change your password to keep your account secure.">
                  <div className="space-y-4 max-w-md">
                    <Field label="Current Password" type="password" value={passwords.current} onChange={(v) => setPasswords(p => ({ ...p, current: v }))} placeholder="••••••••" icon={Key} />
                    <Field label="New Password" type="password" value={passwords.newPwd} onChange={(v) => setPasswords(p => ({ ...p, newPwd: v }))} placeholder="••••••••" icon={Key} />
                    <Field label="Confirm New Password" type="password" value={passwords.confirm} onChange={(v) => setPasswords(p => ({ ...p, confirm: v }))} placeholder="••••••••" icon={Key} />
                    {passwords.newPwd && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-gray-400">Password strength</p>
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                              passwords.newPwd.length >= (i + 1) * 3
                                ? i < 2 ? 'bg-red-400' : i < 3 ? 'bg-amber-400' : 'bg-emerald-400'
                                : 'bg-gray-100'
                            }`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {passwords.newPwd.length < 6 ? 'Weak — use at least 8 characters' : passwords.newPwd.length < 10 ? 'Fair — add numbers or symbols' : 'Strong password'}
                        </p>
                      </div>
                    )}
                    <button onClick={handlePasswordUpdate} className="rounded-xl bg-blue-600 text-white text-[13px] font-semibold px-5 py-2.5 hover:bg-blue-700 transition cursor-pointer">Update Password</button>
                  </div>
                </Section>

                <Section title="Two-Factor Authentication" desc="Add an extra layer of security to your account.">
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><Shield className="h-5 w-5 text-emerald-500" /></div>
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">Two-Factor Authentication</p>
                        <p className="text-[11px] text-gray-400">Secure your account with TOTP 2FA</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {twoFA && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600"><Check className="h-3 w-3" />Enabled</span>}
                      <Toggle on={twoFA} onChange={toggleTwoFA} />
                    </div>
                  </div>
                </Section>

                <Section title="Active Sessions" desc="Manage devices where you're signed in." noBorder>
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <div className="text-center py-8 text-gray-300 text-sm">No active sessions</div>
                    ) : sessions.map((s) => (
                      <motion.div
                        key={s.device}
                        layout
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center justify-between rounded-xl border border-gray-100 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50"><s.icon className="h-4 w-4 text-gray-500" /></div>
                          <div>
                            <div className="flex items-center gap-2"><p className="text-[13px] font-semibold text-gray-800">{s.device}</p>{s.current && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">This device</span>}</div>
                            <p className="text-[11px] text-gray-400">{s.location} · {s.time}</p>
                          </div>
                        </div>
                        {!s.current && <button onClick={() => revokeSession(s.device)} className="text-[12px] font-medium text-red-500 hover:text-red-600 transition cursor-pointer">Revoke</button>}
                      </motion.div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ═══ APPEARANCE TAB ═══ */}
            {activeTab === 'appearance' && (
              <>
                <Section title="Theme" desc="Select your preferred theme.">
                  <div className="grid grid-cols-3 gap-4 max-w-lg">
                    {[
                      { key: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
                      { key: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
                      { key: 'system', label: 'System', icon: Monitor, desc: 'Match OS setting' },
                    ].map((t) => (
                      <button key={t.key} onClick={() => setTheme(t.key)} className={`rounded-2xl border-2 p-4 text-center transition-all duration-200 cursor-pointer ${appearance.theme === t.key ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'}`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl mx-auto mb-2 ${appearance.theme === t.key ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <t.icon className={`h-5 w-5 ${appearance.theme === t.key ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                        <p className={`text-[13px] font-semibold ${appearance.theme === t.key ? 'text-blue-600' : 'text-gray-700'}`}>{t.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Display Preferences" desc="Customize how data is displayed." noBorder>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Date Format</label>
                      <select
                        value={appearance.dateFormat}
                        onChange={(e) => { setAppearance(p => ({ ...p, dateFormat: e.target.value })); showToast('Date format updated', 'info') }}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 px-3.5 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                      >
                        <option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Language</label>
                      <select
                        value={appearance.language}
                        onChange={(e) => { setAppearance(p => ({ ...p, language: e.target.value })); showToast('Language updated', 'info') }}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 px-3.5 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                      >
                        <option>English (US)</option><option>Hindi (हिंदी)</option><option>English (UK)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Timezone</label>
                      <select
                        value={appearance.timezone}
                        onChange={(e) => { setAppearance(p => ({ ...p, timezone: e.target.value })); showToast('Timezone updated', 'info') }}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 px-3.5 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                      >
                        <option>IST (UTC+5:30)</option><option>EST (UTC-5)</option><option>PST (UTC-8)</option><option>GMT (UTC+0)</option>
                      </select>
                    </div>
                  </div>
                </Section>
              </>
            )}

            {/* ═══ INTEGRATIONS TAB ═══ */}
            {activeTab === 'integrations' && (
              <>
                <Section title="Connected Platforms" desc="Manage your connected social accounts.">
                  <div className="space-y-3">
                    {integrationsList.map((p) => (
                      <div key={p.key} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50/50 transition">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold" style={{ backgroundColor: p.color }}>{p.icon}</div>
                          <div>
                            <p className="text-[13px] font-semibold text-gray-800">{p.name}</p>
                            <p className="text-[11px] text-gray-400">{p.desc}</p>
                          </div>
                        </div>
                        {integrations[p.key] ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><Check className="h-3 w-3" />Connected</span>
                            <button onClick={() => toggleIntegration(p.key)} className="text-[12px] text-gray-400 hover:text-red-500 transition cursor-pointer">Disconnect</button>
                          </div>
                        ) : (
                          <button onClick={() => toggleIntegration(p.key)} className="rounded-xl border border-gray-200 text-[12px] font-medium text-gray-600 px-4 py-2 hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer">Connect<ExternalLink className="h-3 w-3" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="API Access" desc="Manage API keys for developer access." noBorder>
                  <div className="rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div><p className="text-[13px] font-semibold text-gray-800">API Key</p><p className="text-[11px] text-gray-400">Use this key to access our REST API</p></div>
                      <button onClick={regenerateApiKey} className="rounded-xl bg-blue-600 text-white text-[12px] font-semibold px-4 py-2 hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" />Regenerate</button>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3">
                      <code className="text-[12px] text-gray-600 font-mono flex-1 select-all">
                        {showApiKey ? apiKey : apiKey.slice(0, 14) + '•'.repeat(20)}
                      </code>
                      <button onClick={() => setShowApiKey(!showApiKey)} className="text-gray-400 hover:text-gray-600 transition cursor-pointer p-1">
                        {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={copyApiKey} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition flex items-center gap-1 cursor-pointer">
                        {apiKeyCopied ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Copied!</span></> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                      </button>
                    </div>
                  </div>
                </Section>
              </>
            )}

            {/* ═══ AI USAGE & BUDGET TAB ═══ */}
            {activeTab === 'ai_usage' && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="h-4.5 w-4.5 text-blue-500" />
                      AI Growth Usage & Budgets
                    </h3>
                    <p className="text-[12px] text-gray-400 mt-0.5">Real-time spend tracking and performance optimization diagnostics.</p>
                  </div>
                  <button 
                    onClick={fetchAIUsage}
                    disabled={loadingUsage}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 text-[12px] font-medium text-gray-600 px-3.5 py-2 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingUsage && !aiUsageStats ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                    <p className="text-sm text-gray-400">Loading AI usage metrics...</p>
                  </div>
                ) : !aiUsageStats ? (
                  <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-sm text-gray-400">AI metrics temporarily unavailable</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Budget & Spend Meters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Daily Budget */}
                      <div className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-gray-50/50 to-white">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[13px] font-bold text-gray-700">Daily Budget</p>
                          <span className="text-[12px] font-bold text-gray-900">
                            ${(aiUsageStats.budget.daily.spent || 0).toFixed(4)} / ${(aiUsageStats.budget.daily.limit || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              ((aiUsageStats.budget.daily.spent || 0) / (aiUsageStats.budget.daily.limit || 1)) > 0.8 ? 'bg-red-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, ((aiUsageStats.budget.daily.spent || 0) / (aiUsageStats.budget.daily.limit || 1)) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">
                          ${(aiUsageStats.budget.daily.remaining || 0).toFixed(4)} remaining today
                        </p>
                      </div>

                      {/* Monthly Budget */}
                      <div className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-gray-50/50 to-white">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[13px] font-bold text-gray-700">Monthly Budget</p>
                          <span className="text-[12px] font-bold text-gray-900">
                            ${(aiUsageStats.budget.monthly.spent || 0).toFixed(4)} / ${(aiUsageStats.budget.monthly.limit || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              ((aiUsageStats.budget.monthly.spent || 0) / (aiUsageStats.budget.monthly.limit || 1)) > 0.8 ? 'bg-red-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, ((aiUsageStats.budget.monthly.spent || 0) / (aiUsageStats.budget.monthly.limit || 1)) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">
                          ${(aiUsageStats.budget.monthly.remaining || 0).toFixed(4)} remaining this month
                        </p>
                      </div>
                    </div>

                    {/* Today KPI overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Today's Calls</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{aiUsageStats.today.calls || 0}</p>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tokens Used</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{aiUsageStats.today.tokens || 0}</p>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cache Hits</p>
                        <p className="text-xl font-bold text-emerald-600 mt-1">{aiUsageStats.today.cacheHits || 0}</p>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">AI Provider</p>
                        <p className="text-md font-bold text-blue-600 mt-1.5 uppercase">{aiUsageStats.provider}</p>
                      </div>
                    </div>

                    {/* Active Configuration */}
                    <Section title="AI Engine Config" desc="Current active models and cache performance details.">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="border border-gray-100 rounded-xl p-3.5">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Fast Model</span>
                          <p className="text-sm font-bold text-gray-800 mt-1.5">{aiUsageStats.fastModel}</p>
                        </div>
                        <div className="border border-gray-100 rounded-xl p-3.5">
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Premium Model</span>
                          <p className="text-sm font-bold text-gray-800 mt-1.5">{aiUsageStats.premiumModel}</p>
                        </div>
                        <div className="border border-gray-100 rounded-xl p-3.5">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Cache Entries</span>
                          <p className="text-sm font-bold text-gray-800 mt-1.5">{aiUsageStats.cacheEntries} active caches</p>
                        </div>
                      </div>
                    </Section>

                    {/* Method Breakdown */}
                    {aiUsageStats.methodBreakdown && aiUsageStats.methodBreakdown.length > 0 && (
                      <Section title="Per-Method Performance (This Month)" desc="Cost and execution latency of active AI generator features.">
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Method</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Calls</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tokens</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Cost</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Avg Latency</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100 text-[13px] text-gray-600">
                              {aiUsageStats.methodBreakdown.map((row) => (
                                <tr key={row._id}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">{row._id}</td>
                                  <td className="px-4 py-3 text-center">{row.calls}</td>
                                  <td className="px-4 py-3 text-center">{row.totalTokens}</td>
                                  <td className="px-4 py-3 text-center font-bold text-gray-800">${(row.totalCost || 0).toFixed(4)}</td>
                                  <td className="px-4 py-3 text-center text-gray-400">{((row.avgResponseMs || 0) / 1000).toFixed(2)}s</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}

                    {/* Recent AI logs */}
                    {aiUsageStats.recentLogs && aiUsageStats.recentLogs.length > 0 && (
                      <Section title="Recent Generation Logs" desc="Diagnostic audit trail of recent AI generation requests." noBorder>
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Feature / Method</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tokens</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100 text-[12px] text-gray-600">
                              {aiUsageStats.recentLogs.map((log, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">{log.method}</td>
                                  <td className="px-4 py-3 text-center">
                                    {log.cacheHit ? (
                                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Cache</span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{log.model || 'API'}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">{log.tokens}</td>
                                  <td className="px-4 py-3 text-center font-semibold text-gray-700">${(log.cost || 0).toFixed(4)}</td>
                                  <td className="px-4 py-3 text-center">
                                    {log.success ? (
                                      <span className="inline-flex items-center text-emerald-600"><Check className="h-3.5 w-3.5" /></span>
                                    ) : (
                                      <span className="inline-flex items-center text-red-500" title={log.error}><X className="h-3.5 w-3.5" /></span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ═══ SCHEDULER ENGINE TAB ═══ */}
            {activeTab === 'scheduler' && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                      <Zap className="h-4.5 w-4.5 text-blue-500" />
                      Scheduler & Publishing Queue
                    </h3>
                    <p className="text-[12px] text-gray-400 mt-0.5">Manage production task workers, delayed postings, and Redis pipelines.</p>
                  </div>
                  <button 
                    onClick={fetchQueueStats}
                    disabled={loadingQueue}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 text-[12px] font-medium text-gray-600 px-3.5 py-2 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingQueue && !queueMetrics ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                    <p className="text-sm text-gray-400">Loading scheduler metrics...</p>
                  </div>
                ) : !queueMetrics ? (
                  <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-sm text-gray-400">Queue metrics temporarily unavailable</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Redis Engine Overview */}
                    <div className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-gray-50/50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-gray-800">Redis Cache Server</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            queueMetrics.redis.connected 
                              ? 'bg-emerald-50 text-emerald-600' 
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${queueMetrics.redis.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                            {queueMetrics.redis.connected ? 'ACTIVE (BULLMQ)' : 'FALLBACK (MONGODB)'}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-400 mt-1">
                          {queueMetrics.redis.connected 
                            ? 'BullMQ job broker connected. Delivering sub-second scheduling guarantees.' 
                            : 'Redis down. Scheduler operating in mock-driven database poller mode (10s latency).'}
                        </p>
                      </div>
                      
                      {queueMetrics.redis.connected && (
                        <div className="flex items-center gap-6 self-start sm:self-auto">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Memory</p>
                            <p className="text-md font-bold text-gray-800 mt-0.5">{queueMetrics.redis.memory}</p>
                          </div>
                          <div className="h-8 w-px bg-gray-100" />
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Uptime</p>
                            <p className="text-md font-bold text-gray-800 mt-0.5">{queueMetrics.redis.uptime}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Active queues list */}
                    <Section title="Active Scheduler Queues" desc="Metrics tracking state, throughput, and error recovery across delayed pipelines.">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {[
                          { key: 'publishing', name: 'Post Publishing', desc: 'Social content postings', metrics: queueMetrics.publishing, color: 'text-blue-500' },
                          { key: 'retry', name: 'Dead-Letter Recovery', desc: 'Auto-retrying failed posts', metrics: queueMetrics.retry, color: 'text-rose-500' },
                          { key: 'automation', name: 'AI & Automation Rules', desc: 'Cron recycling & AI writing', metrics: queueMetrics.automation, color: 'text-purple-500' }
                        ].map((q) => (
                          <div key={q.key} className="rounded-2xl border border-gray-100 p-5 bg-white shadow-sm flex flex-col justify-between min-h-[180px]">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-[13px] font-bold text-gray-900">{q.name}</h4>
                                <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase">{q.key}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mb-4">{q.desc}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-gray-50 pt-3.5 mb-2">
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">Delayed</p>
                                <p className="text-md font-bold text-gray-800 mt-0.5">{q.metrics.delayed || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">Active</p>
                                <p className="text-md font-bold text-blue-600 mt-0.5">{q.metrics.active || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">Success</p>
                                <p className="text-md font-bold text-emerald-600 mt-0.5">{q.metrics.successRate}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>

                    {/* Detailed Pipeline Status */}
                    <Section title="Job Pipeline Details" desc="Job counts and status breakdown of the publishing and automation workflows." noBorder>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Queue Name</th>
                              <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Waiting</th>
                              <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Delayed</th>
                              <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active</th>
                              <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Completed</th>
                              <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Failed</th>
                              <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Avg Latency</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100 text-[13px] text-gray-600">
                            {[
                              { name: 'publishing', metrics: queueMetrics.publishing },
                              { name: 'retry', metrics: queueMetrics.retry },
                              { name: 'automation', metrics: queueMetrics.automation }
                            ].map((row) => (
                              <tr key={row.name}>
                                <td className="px-4 py-3 font-semibold text-gray-800 capitalize">{row.name}</td>
                                <td className="px-4 py-3 text-center">{row.metrics.waiting || 0}</td>
                                <td className="px-4 py-3 text-center text-amber-500 font-semibold">{row.metrics.delayed || 0}</td>
                                <td className="px-4 py-3 text-center text-blue-600 font-semibold">{row.metrics.active || 0}</td>
                                <td className="px-4 py-3 text-center text-emerald-600">{row.metrics.completed || 0}</td>
                                <td className="px-4 py-3 text-center text-red-500">{row.metrics.failed || 0}</td>
                                <td className="px-4 py-3 text-right text-gray-400">{row.metrics.avgExecutionTime}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  </div>
                )}
              </>
            )}

            {/* ═══ BILLING TAB ═══ */}
            {activeTab === 'billing' && (
              <>
                <Section title="Current Plan" desc="Manage your subscription.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Free plan */}
                    <div className="rounded-2xl border border-gray-200 p-5">
                      <p className="text-[14px] font-bold text-gray-800 mb-1">Free</p>
                      <p className="text-[24px] font-bold text-gray-900 tracking-tight">$0<span className="text-[13px] font-normal text-gray-400">/month</span></p>
                      <ul className="mt-4 space-y-2">
                        {['2 channels', 'Basic analytics', '7-day data retention', 'Community support'].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[12px] text-gray-500"><Check className="h-3.5 w-3.5 text-gray-300" />{f}</li>
                        ))}
                      </ul>
                      <button className="w-full mt-4 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-400 py-2.5 cursor-default">Current Plan</button>
                    </div>
                    {/* Pro plan */}
                    <div className="rounded-2xl border-2 border-blue-500 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-5 relative overflow-hidden">
                      <div className="absolute top-3 right-3"><span className="text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1 rounded-full flex items-center gap-1"><Sparkles className="h-3 w-3" />Recommended</span></div>
                      <p className="text-[14px] font-bold text-blue-700 mb-1">Pro</p>
                      <p className="text-[24px] font-bold text-gray-900 tracking-tight">$29<span className="text-[13px] font-normal text-gray-400">/month</span></p>
                      <ul className="mt-4 space-y-2">
                        {['Unlimited channels', 'AI-powered insights', 'Competitor tracking', '365-day data retention', 'Priority support', 'API access'].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[12px] text-gray-700"><Check className="h-3.5 w-3.5 text-blue-500" />{f}</li>
                        ))}
                      </ul>
                      <button onClick={() => showToast('Upgrade flow coming soon!', 'info')} className="w-full mt-4 rounded-xl bg-blue-600 text-white text-[13px] font-semibold py-2.5 hover:bg-blue-700 transition flex items-center justify-center gap-1.5 cursor-pointer"><Zap className="h-4 w-4" />Upgrade to Pro</button>
                    </div>
                  </div>
                </Section>

                <Section title="Payment Method" desc="Manage your payment details." noBorder>
                  <div className="rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 text-white text-[10px] font-bold">VISA</div>
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">Visa ending in 4242</p>
                        <p className="text-[11px] text-gray-400">Expires 12/2028</p>
                      </div>
                    </div>
                    <button onClick={() => showToast('Payment update coming soon!', 'info')} className="rounded-xl border border-gray-200 text-[12px] font-medium text-gray-600 px-4 py-2 hover:bg-gray-50 transition cursor-pointer">Update</button>
                  </div>
                </Section>
              </>
            )}

          </div>
        </motion.div>
      </div>

      {/* ── Toast ──────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Confirmation Modal ─────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <ConfirmModal
            title={modal.title}
            desc={modal.desc}
            confirmLabel={modal.confirmLabel}
            danger={modal.danger}
            onConfirm={modal.onConfirm}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
