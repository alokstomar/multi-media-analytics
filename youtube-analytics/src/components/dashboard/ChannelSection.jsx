import { useState } from 'react'
import Input from '../ui/Input'
import Button from '../ui/Button'

const CHANNELS = [
  { id: 1, name: 'MrBeast', subscribers: '312M subscribers', image: 'https://i.pravatar.cc/150?img=11' },
  { id: 2, name: 'MKBHD', subscribers: '19.8M subscribers', image: 'https://i.pravatar.cc/150?img=12' },
  { id: 3, name: 'Fireship', subscribers: '3.2M subscribers', image: 'https://i.pravatar.cc/150?img=33' },
]

export default function ChannelSection() {
  const [channelUrl, setChannelUrl] = useState('')
  const [selectedId, setSelectedId] = useState(CHANNELS[0].id)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
        {/* Left — Add Channel */}
        <div className="pr-8">
          <h2 className="font-semibold text-gray-800">
            Add YouTube Channel
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Paste a channel URL or ID to start tracking analytics.
          </p>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Paste YouTube channel URL or enter Channel ID"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                className="h-12 w-full rounded-xl border-gray-200 bg-white px-4 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <Button className="h-12 w-28 shrink-0 rounded-xl bg-blue-600 px-6 font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700">
                Analyze
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden border-l border-gray-100 pl-8 lg:block" />

        {/* Right — Your Channels */}
        <div className="pt-6 lg:pl-8 lg:pt-0">
          <h2 className="font-semibold text-gray-800">
            Your Channels
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedId(ch.id)}
                className={`flex w-[110px] flex-col items-center justify-center gap-2 rounded-xl p-5 transition-all duration-200 ${
                  selectedId === ch.id
                    ? 'scale-[1.03] border-2 border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/20'
                    : 'border border-gray-200 hover:-translate-y-1 hover:shadow-lg'
                }`}
              >
                <img
                  src={ch.image}
                  alt={ch.name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
                <span className="text-sm font-semibold text-gray-800">
                  {ch.name}
                </span>
                <span className="text-xs text-gray-500">{ch.subscribers}</span>
              </button>
            ))}

            {/* Add Channel */}
            <button className="flex w-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-5 text-gray-400 transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-current text-xl">
                +
              </div>
              <span className="text-xs font-medium">Add Channel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
