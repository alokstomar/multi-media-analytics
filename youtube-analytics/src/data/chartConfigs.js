/**
 * Shared chart configuration objects.
 * Extracted from individual components to eliminate duplication and
 * make per-channel theming trivial.
 */

// ─── Shared tooltip style ──────────────────────────────────────────────
export const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
  padding: '12px 16px',
  fontSize: '13px',
}

export const tooltipStyleCompact = {
  backgroundColor: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: '10px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
}

// ─── Stats card icon/color mapping ─────────────────────────────────────
export const statCardColors = [
  { bg: 'bg-blue-50', text: 'text-blue-600', stroke: '#3B82F6', grad: 'from-blue-500 to-blue-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600', stroke: '#8B5CF6', grad: 'from-purple-500 to-purple-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', stroke: '#10B981', grad: 'from-emerald-500 to-emerald-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600', stroke: '#F59E0B', grad: 'from-amber-500 to-amber-600' },
]

// ─── Engagement tabs definition ────────────────────────────────────────
export const engagementTabs = [
  { key: 'likes', label: 'Likes', color: '#EF4444' },
  { key: 'comments', label: 'Comments', color: '#3B82F6' },
  { key: 'shares', label: 'Shares', color: '#10B981' },
  { key: 'subs', label: 'Subs Gained', color: '#8B5CF6' },
]

// ─── Retention insight color maps ──────────────────────────────────────
export const retentionColorMaps = {
  bg: {
    blue: 'bg-blue-50 border-blue-100',
    orange: 'bg-orange-50 border-orange-100',
    purple: 'bg-purple-50 border-purple-100',
    green: 'bg-green-50 border-green-100',
  },
  iconBg: {
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
  },
  title: {
    blue: 'text-blue-700',
    orange: 'text-orange-700',
    purple: 'text-purple-700',
    green: 'text-green-700',
  },
}

// ─── Video table badge mapping ─────────────────────────────────────────
export const videoBadgeMap = {
  Viral: { bg: 'bg-red-50 text-red-600 border-red-100', iconKey: 'flame' },
  Hot: { bg: 'bg-orange-50 text-orange-600 border-orange-100', iconKey: 'rocket' },
  Rising: { bg: 'bg-blue-50 text-blue-600 border-blue-100', iconKey: 'trending' },
  Stable: { bg: 'bg-gray-50 text-gray-600 border-gray-100', iconKey: 'minus' },
}

// ─── Viral score color helper ──────────────────────────────────────────
export function viralScoreColor(score) {
  if (score >= 90) return 'bg-red-500'
  if (score >= 80) return 'bg-orange-500'
  if (score >= 70) return 'bg-blue-500'
  return 'bg-gray-400'
}
