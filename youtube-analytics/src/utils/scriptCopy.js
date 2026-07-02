// Flatten a script object into a clean, copyable plain-text format.
// Used by "Copy Entire Script" and per-section copy actions. No markdown,
// no HTML — just text that reads well in any destination.

function pad(n) {
  return String(n).padStart(2, '0')
}

function timestampNow() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatField(value) {
  if (Array.isArray(value)) {
    return value.map((v) => `  • ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
  }
  return String(value)
}

export function blockToPlainText(block) {
  if (!block || typeof block !== 'object') return ''
  const lines = []
  const header = [
    block.timestamp ? `[${block.timestamp}]` : '',
    block.sectionName || '',
  ].filter(Boolean).join(' ')
  if (header) lines.push(header)
  lines.push('')

  Object.entries(block).forEach(([key, value]) => {
    if (key === 'sectionName' || key === 'timestamp') return
    const label = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (c) => c.toUpperCase())
    lines.push(`${label}`)
    lines.push(formatField(value))
    lines.push('')
  })
  return lines.join('\n').trim()
}

export function scriptToPlainText(script, recommendation = {}) {
  if (!script || typeof script !== 'object') return ''
  const lines = []

  const title = script.heroTitle || recommendation.title || 'Production Script'
  lines.push(title.toUpperCase())
  lines.push('='.repeat(Math.min(title.length, 70)))
  lines.push('')

  if (script.estimatedDuration) lines.push(`Estimated Duration: ${script.estimatedDuration}`)
  if (script.targetAudience) lines.push(`Target Audience: ${script.targetAudience}`)
  if (recommendation.opportunity != null) lines.push(`Opportunity Score: ${recommendation.opportunity}/100`)
  if (recommendation.trendScore != null) lines.push(`Trend Index: ${recommendation.trendScore}/100`)
  if (recommendation.difficulty != null) lines.push(`Production Difficulty: ${recommendation.difficulty}/100`)
  if (recommendation.predictedViews) lines.push(`Estimated Views: ${recommendation.predictedViews}`)
  if (recommendation.predictedEngagement) lines.push(`Estimated Likes: ${recommendation.predictedEngagement}`)
  lines.push('')

  if (script.overview) {
    lines.push('OVERVIEW')
    lines.push(script.overview)
    lines.push('')
  }

  if (Array.isArray(script.timeline)) {
    lines.push('SCRIPT')
    lines.push('-'.repeat(60))
    script.timeline.forEach((block, i) => {
      lines.push('')
      lines.push(blockToPlainText(block))
      if (i < script.timeline.length - 1) lines.push('\n' + '-'.repeat(60))
    })
    lines.push('')
  }

  if (Array.isArray(script.titles) && script.titles.length > 0) {
    lines.push('ALTERNATIVE TITLES')
    script.titles.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
    lines.push('')
  }

  if (Array.isArray(script.thumbnailIdeas) && script.thumbnailIdeas.length > 0) {
    lines.push('THUMBNAIL IDEAS')
    script.thumbnailIdeas.forEach((t, i) => {
      const parts = [`  ${i + 1}.`]
      if (typeof t === 'string') parts.push(t)
      else {
        if (t.concept) parts.push(`Concept: ${t.concept}`)
        if (t.textOverlay) parts.push(`Overlay: "${t.textOverlay}"`)
        if (t.emotion) parts.push(`Emotion: ${t.emotion}`)
      }
      lines.push(parts.join(' '))
    })
    lines.push('')
  }

  if (script.cta) {
    lines.push('CALL TO ACTION')
    lines.push(script.cta)
    lines.push('')
  }

  if (script.seo && typeof script.seo === 'object') {
    lines.push('SEO')
    if (Array.isArray(script.seo.keywords) && script.seo.keywords.length > 0) {
      lines.push(`Keywords: ${script.seo.keywords.join(', ')}`)
    }
    if (Array.isArray(script.seo.tags) && script.seo.tags.length > 0) {
      lines.push(`Tags: ${script.seo.tags.join(', ')}`)
    }
    if (script.seo.description) {
      lines.push('Description:')
      lines.push(script.seo.description)
    }
    lines.push('')
  }

  if (Array.isArray(script.chapters) && script.chapters.length > 0) {
    lines.push('CHAPTERS')
    script.chapters.forEach((c) => {
      lines.push(`${c.timestamp || ''} ${c.title || ''}`.trim())
    })
    lines.push('')
  }

  if (Array.isArray(script.productionNotes) && script.productionNotes.length > 0) {
    lines.push('PRODUCTION NOTES')
    script.productionNotes.forEach((n) => lines.push(`• ${n}`))
    lines.push('')
  }

  lines.push(`\nGenerated: ${timestampNow()}`)
  return lines.join('\n').trim()
}

export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  // Legacy fallback for older browsers / non-secure contexts.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}
