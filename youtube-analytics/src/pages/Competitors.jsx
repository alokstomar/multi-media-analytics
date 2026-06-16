import { usePlatform } from '../hooks/usePlatform'

export default function Competitors() {
  const { selectedPlatform } = usePlatform()
  const label = selectedPlatform === 'youtube' ? 'YouTube' : 'Instagram'

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800">
        Competitors — {label}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Track and compare {label} competitor performance.
      </p>
    </div>
  )
}
