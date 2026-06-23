export default function EstimatedBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100 ${className}`}
      title="Estimated from available channel and video performance data."
    >
      Estimated
    </span>
  )
}
