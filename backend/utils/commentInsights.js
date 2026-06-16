/**
 * Generate actionable comment insights from cached comment data.
 */

export function generateCommentInsights(comments, videos = []) {
  if (!comments.length) {
    return [{
      title: 'No comments cached yet',
      desc: 'Comments will appear after the next sync from YouTube.',
      bg: 'bg-blue-50',
      textColor: 'text-blue-800',
    }]
  }

  const insights = []
  const total = comments.length
  const positive = comments.filter((c) => c.sentiment === 'Positive').length
  const negative = comments.filter((c) => c.sentiment === 'Negative').length
  const questions = comments.filter((c) => c.sentiment === 'Question').length
  const toxic = comments.filter((c) => c.isToxic).length
  const highEngagement = comments.filter((c) => c.aiScore >= 80)

  const positivePct = ((positive / total) * 100).toFixed(1)
  const toxicPct = ((toxic / total) * 100).toFixed(1)

  insights.push({
    title: `Sentiment: ${positivePct}% positive`,
    desc: `${positive} of ${total} analyzed comments are positive.`,
    bg: 'bg-emerald-50',
    textColor: 'text-emerald-800',
  })

  if (questions >= 3) {
    insights.push({
      title: 'FAQ opportunities detected',
      desc: `${questions} question-style comments — consider answering in a dedicated video.`,
      bg: 'bg-blue-50',
      textColor: 'text-blue-800',
      extra: `+${questions}`,
    })
  }

  if (toxic > 0) {
    insights.push({
      title: `Toxicity rate: ${toxicPct}%`,
      desc: `${toxic} comments flagged for review.`,
      bg: toxicPct > 5 ? 'bg-red-50' : 'bg-amber-50',
      textColor: toxicPct > 5 ? 'text-red-800' : 'text-amber-800',
    })
  } else {
    insights.push({
      title: 'Toxicity rate: Very low',
      desc: 'No significant toxic patterns detected in cached comments.',
      bg: 'bg-emerald-50',
      textColor: 'text-emerald-800',
    })
  }

  if (highEngagement.length >= 3) {
    insights.push({
      title: 'High-value replies waiting',
      desc: `${highEngagement.length} comments scored 80+ — strong candidates for creator replies.`,
      bg: 'bg-violet-50',
      textColor: 'text-violet-800',
      extra: `+${highEngagement.length}`,
    })
  }

  // Top video by comment volume in cache
  const byVideo = {}
  for (const c of comments) {
    if (!c.videoId) continue
    byVideo[c.videoId] = (byVideo[c.videoId] || 0) + 1
  }
  const topVideoId = Object.entries(byVideo).sort((a, b) => b[1] - a[1])[0]
  if (topVideoId) {
    const [vid, count] = topVideoId
    const video = videos.find((v) => v.videoId === vid)
    insights.push({
      title: 'Most discussed video',
      desc: `"${video?.title || 'Recent upload'}" has ${count} comments in cache.`,
      bg: 'bg-amber-50',
      textColor: 'text-amber-800',
    })
  }

  if (negative > positive * 0.3 && negative >= 3) {
    insights.push({
      title: 'Negative sentiment spike',
      desc: `${negative} negative comments detected — review recent uploads for audience friction.`,
      bg: 'bg-red-50',
      textColor: 'text-red-800',
    })
  }

  return insights.slice(0, 6)
}

export function generateReplySuggestions(comments) {
  const positive = comments.filter((c) => c.sentiment === 'Positive').slice(0, 2)
  const questions = comments.filter((c) => c.sentiment === 'Question').slice(0, 1)

  const replies = []
  if (positive.length) {
    replies.push('Thank you for the support — really glad this helped!')
  }
  if (questions.length) {
    replies.push('Great question! We will cover this in an upcoming video.')
  }
  replies.push('Appreciate you watching and engaging with the channel!')
  replies.push('Thanks for being part of the community.')

  return replies.slice(0, 4)
}
