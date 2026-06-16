export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

      {/* Upload */}
      <div className="flex items-center gap-5 p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer min-h-[110px]">
        <div className="w-14 h-14 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl text-xl">
          ⬆️
        </div>
        <div>
          <h3 className="text-lg font-semibold">Upload Video</h3>
          <p className="text-sm text-gray-500">Publish new content</p>
        </div>
      </div>

      {/* Analyze */}
      <div className="flex items-center gap-5 p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer min-h-[110px]">
        <div className="w-14 h-14 flex items-center justify-center bg-purple-100 text-purple-600 rounded-xl text-xl">
          📊
        </div>
        <div>
          <h3 className="text-lg font-semibold">Analyze Channel</h3>
          <p className="text-sm text-gray-500">Deep-dive into metrics</p>
        </div>
      </div>

      {/* Compare */}
      <div className="flex items-center gap-5 p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer min-h-[110px]">
        <div className="w-14 h-14 flex items-center justify-center bg-orange-100 text-orange-600 rounded-xl text-xl">
          🔄
        </div>
        <div>
          <h3 className="text-lg font-semibold">Compare Channels</h3>
          <p className="text-sm text-gray-500">Side-by-side analysis</p>
        </div>
      </div>

    </div>
  )
}
