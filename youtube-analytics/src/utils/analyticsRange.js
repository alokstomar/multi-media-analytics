import { seededFloat } from './deterministic.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getRangePerformanceData(range, chartData) {
  if (!chartData?.length) return { data: [], estimated: true }

  const hasEstimates = chartData.some((d) => d.isEstimated)
  const latestMonthData = chartData[chartData.length - 1] || { views: 0 }
  const latestViews = latestMonthData.views || 0
  const dailyBase = latestViews / 30
  const now = new Date()

  if (range === '1Y') {
    return { data: chartData, estimated: hasEstimates }
  }

  let points = []

  if (range === '7D') {
    points = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (6 - i))
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const variance = seededFloat(`perf-7d-${label}`, 0.8, 1.2)
      const v = Math.round(dailyBase * variance)
      return { date: label, views: v, watchTime: Math.round(v * 0.08), isEstimated: true }
    })
  } else if (range === '30D') {
    points = Array.from({ length: 15 }, (_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (14 - i) * 2)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const variance = seededFloat(`perf-30d-${label}`, 0.82, 1.18)
      const v = Math.round(dailyBase * 2 * variance)
      return { date: label, views: v, watchTime: Math.round(v * 0.08), isEstimated: true }
    })
  } else if (range === '90D') {
    points = Array.from({ length: 12 }, (_, i) => {
      const label = `Wk ${i + 1}`
      const variance = seededFloat(`perf-90d-${label}`, 0.85, 1.15)
      const v = Math.round(dailyBase * 7 * variance)
      return { date: label, views: v, watchTime: Math.round(v * 0.08), isEstimated: true }
    })
  }

  return { data: points, estimated: true }
}

export { MONTHS }
