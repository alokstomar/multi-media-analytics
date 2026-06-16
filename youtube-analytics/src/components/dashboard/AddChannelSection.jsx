import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'

export default function AddChannelSection() {
  const { selectedPlatform } = usePlatform()
  const {
    accounts = [],
    selectedAccount,
    setActiveAccount,
    addAccount,
    removeAccount,
    loading: adapterLoading
  } = usePlatformAdapter()
  
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    // Instagram connects via Meta OAuth — there's no username input to type.
    // addAccount() (from the adapter) will redirect the browser to Meta's
    // consent screen.
    if (selectedPlatform === 'instagram') {
      setLoading(true)
      setError('')
      try {
        await addAccount()
      } catch (err) {
        setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to start Instagram OAuth')
      } finally {
        setLoading(false)
      }
      return
    }

    const trimmed = input.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const res = await addAccount(trimmed)
      setInput('')
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || `Failed to add ${selectedPlatform}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && selectedPlatform !== 'instagram') handleAnalyze()
  }

  // Capitalize helper
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

  // Custom configurations per platform
  const configs = {
    youtube: {
      title: 'Add YouTube Channel',
      desc: 'Paste a channel URL, @handle, or channel ID to start tracking analytics.',
      placeholder: 'Paste YouTube channel URL or enter @handle',
      metricLabel: 'subscribers',
      btnBg: 'bg-red-600 hover:bg-red-700',
      activeBorder: 'border-red-400 bg-red-50/30',
      accentColor: 'text-red-600',
    },
    instagram: {
      title: 'Connect Instagram Account',
      desc: 'Connect an Instagram Business or Creator account via Meta. Requires a linked Facebook Page.',
      placeholder: 'Connects via Meta OAuth — no username needed',
      metricLabel: 'followers',
      btnBg: 'bg-purple-600 hover:bg-purple-700',
      activeBorder: 'border-purple-400 bg-purple-50/30',
      accentColor: 'text-purple-600',
    },
    twitter: {
      title: 'Connect Twitter/X Account',
      desc: 'Enter a Twitter/X username to connect and sync posts.',
      placeholder: 'Enter Twitter/X @username',
      metricLabel: 'followers',
      btnBg: 'bg-black hover:bg-neutral-800',
      activeBorder: 'border-neutral-800 bg-neutral-50',
      accentColor: 'text-neutral-900',
    },
    linkedin: {
      title: 'Connect LinkedIn Page',
      desc: 'Enter your LinkedIn company page or profile handle.',
      placeholder: 'Enter LinkedIn page URL or handle',
      metricLabel: 'followers',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      activeBorder: 'border-blue-400 bg-blue-50/30',
      accentColor: 'text-blue-600',
    },
  }

  const currentConfig = configs[selectedPlatform] || configs.youtube
  const isFetching = loading || adapterLoading

  // Filter out the generic fallbacks/demo items for clean accounts strip
  const filteredAccounts = accounts.filter(a => a.id !== 'demo' && a.id !== 'demo_ig' && a.id !== 'demo_tt' && a.id !== 'demo_li')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-8">

      <div className="flex flex-col gap-2 flex-1 max-w-xl">
        <h3 className="text-sm font-semibold text-gray-800">
          {currentConfig.title}
        </h3>
        <p className="text-xs text-gray-500">
          {currentConfig.desc}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {selectedPlatform !== 'instagram' && (
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentConfig.placeholder}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isFetching}
            />
          )}
          {selectedPlatform === 'instagram' && (
            <p className="flex-1 text-xs text-gray-400 italic px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              {currentConfig.placeholder}
            </p>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isFetching}
            className={`${currentConfig.btnBg} text-white px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
          >
            {isFetching ? 'Syncing...' : 'Connect'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-4 overflow-x-auto py-1">
        {filteredAccounts.map((ch) => (
          <div
            key={ch.id}
            onClick={() => setActiveAccount(ch.id)}
            className={`group relative flex items-center justify-between gap-3 border rounded-xl px-4 py-2 min-w-[200px] hover:shadow-sm cursor-pointer transition ${
              selectedAccount?.id === ch.id
                ? currentConfig.activeBorder
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={ch.avatar}
                alt={ch.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="text-left min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate max-w-[110px]">
                  {ch.name}
                </div>
                <div className="text-xs text-gray-500">
                  {ch.subscribers} {currentConfig.metricLabel}
                </div>
              </div>
            </div>

            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (window.confirm(`Are you sure you want to disconnect ${ch.name}?`)) {
                  try {
                    await removeAccount(ch.id)
                  } catch {
                    alert('Failed to disconnect account')
                  }
                }
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition shrink-0"
              title="Disconnect account"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {filteredAccounts.length === 0 && (
          <div
            onClick={() => {
              if (selectedPlatform === 'instagram') {
                handleAnalyze()
                return
              }
              const handle = prompt(`Enter ${capitalize(selectedPlatform)} username/handle to connect:`)
              if (handle) {
                setInput(handle)
                handleAnalyze()
              }
            }}
            className="flex items-center gap-2 border border-dashed border-gray-300 text-gray-500 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 transition-all duration-300"
          >
            <span className="text-lg">+</span>
            <span className="text-sm font-medium">Connect Account</span>
          </div>
        )}
      </div>
    </div>
  )
}
