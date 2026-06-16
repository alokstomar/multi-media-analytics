/**
 * Deterministic lexicon-based sentiment and emotion analysis.
 * No randomness — same input always yields the same output.
 */

const POSITIVE_WORDS = [
  'love', 'great', 'best', 'amazing', 'good', 'awesome', 'excellent', 'fantastic',
  'beautiful', 'perfect', 'helpful', 'thank', 'thanks', 'mast', 'kamaal', 'shukriya',
  'dhanyawad', 'dhanyavad', 'superb', 'brilliant', 'outstanding', 'incredible',
  'subscribe', 'subscribed', 'legend', 'goat', 'fire', 'lit', 'banger', 'gold',
  'inspiring', 'inspired', 'respect', 'proud', 'happy', 'enjoyed', 'enjoy',
]

const NEGATIVE_WORDS = [
  'bad', 'worst', 'hate', 'fail', 'failed', 'waste', 'wasted', 'fake', 'paid',
  'boring', 'suck', 'sucks', 'terrible', 'horrible', 'awful', 'disappoint',
  'disappointed', 'trash', 'garbage', 'useless', 'clickbait', 'scam', 'spam',
  'annoying', 'stupid', 'dumb', 'pathetic', 'overrated', 'mid',
]

const TOXIC_WORDS = [
  'hate', 'kill', 'die', 'idiot', 'moron', 'stupid', 'trash', 'garbage',
  'worst', 'sucks', 'pathetic',
]

const EMOTION_PATTERNS = [
  { emotion: 'Joy', emoji: '😊', words: ['love', 'happy', 'enjoy', 'smile', 'fun', 'mast'] },
  { emotion: 'Excited', emoji: '🔥', words: ['amazing', 'fire', 'lit', 'banger', 'goat', 'legend', 'kamaal'] },
  { emotion: 'Grateful', emoji: '🙏', words: ['thank', 'thanks', 'shukriya', 'dhanyawad', 'dhanyavad', 'grateful'] },
  { emotion: 'Curious', emoji: '🤔', words: ['how', 'why', 'when', 'what', 'kya', 'please', '?'] },
  { emotion: 'Angry', emoji: '😡', words: ['hate', 'angry', 'worst', 'terrible', 'fail'] },
  { emotion: 'Disgust', emoji: '🤢', words: ['fake', 'scam', 'trash', 'garbage', 'suck'] },
  { emotion: 'Appreciative', emoji: '🙌', words: ['great', 'best', 'helpful', 'respect', 'inspiring'] },
  { emotion: 'Surprised', emoji: '😲', words: ['wow', 'omg', 'unbelievable', 'insane', 'crazy'] },
]

const SENTIMENT_COLORS = {
  Positive: '#10B981',
  Negative: '#EF4444',
  Neutral: '#3B82F6',
  Question: '#F59E0B',
}

function countMatches(text, words) {
  let count = 0
  for (const word of words) {
    if (word === '?') {
      if (text.includes('?')) count += 1
    } else if (text.includes(word)) {
      count += 1
    }
  }
  return count
}

function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) {
    if (/[a-zA-Z]/.test(text)) return { language: 'Hinglish', langLabel: 'HI' }
    return { language: 'Hindi', langLabel: 'HI' }
  }
  return { language: 'English', langLabel: 'EN' }
}

function detectEmotion(text, sentiment) {
  let best = { emotion: 'Neutral', emoji: '😐', score: 0 }

  for (const pattern of EMOTION_PATTERNS) {
    const score = countMatches(text, pattern.words)
    if (score > best.score) {
      best = { emotion: pattern.emotion, emoji: pattern.emoji, score }
    }
  }

  if (best.score === 0) {
    if (sentiment === 'Positive') return { emotion: 'Appreciative', emotionEmoji: '🙌' }
    if (sentiment === 'Negative') return { emotion: 'Disappointed', emotionEmoji: '😞' }
    if (sentiment === 'Question') return { emotion: 'Curious', emotionEmoji: '🤔' }
    return { emotion: 'Neutral', emotionEmoji: '😐' }
  }

  return { emotion: best.emotion, emotionEmoji: best.emoji }
}

function computeAiScore(positive, negative, question, textLength, likeCount) {
  const polarity = positive - negative
  const base = 50 + polarity * 12 + Math.min(question * 5, 15)
  const lengthBonus = Math.min(Math.floor(textLength / 40), 10)
  const likeBonus = Math.min(likeCount * 2, 15)
  return Math.max(5, Math.min(99, Math.round(base + lengthBonus + likeBonus)))
}

/**
 * @param {string} text
 * @param {{ likeCount?: number }} [options]
 */
export function analyzeComment(text, options = {}) {
  const raw = (text || '').trim()
  const lower = raw.toLowerCase()
  const likeCount = options.likeCount || 0

  const positive = countMatches(lower, POSITIVE_WORDS)
  const negative = countMatches(lower, NEGATIVE_WORDS)
  const question = countMatches(lower, ['?', 'how', 'why', 'when', 'what', 'please', 'kya'])

  let sentiment = 'Neutral'
  if (question > 0 && question >= positive && question >= negative) {
    sentiment = 'Question'
  } else if (positive > negative) {
    sentiment = 'Positive'
  } else if (negative > positive) {
    sentiment = 'Negative'
  }

  const sentimentScore = Math.max(-1, Math.min(1, (positive - negative) / Math.max(1, positive + negative + 1)))
  const { emotion, emotionEmoji } = detectEmotion(lower, sentiment)
  const { language, langLabel } = detectLanguage(raw)
  const aiScore = computeAiScore(positive, negative, question, raw.length, likeCount)
  const isToxic = countMatches(lower, TOXIC_WORDS) >= 2 || (negative >= 3 && sentiment === 'Negative')

  return {
    sentiment,
    sentimentScore,
    sentimentColor: SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.Neutral,
    emotion,
    emotionEmoji,
    language,
    langLabel,
    aiScore,
    isToxic,
    positiveSignals: positive,
    negativeSignals: negative,
  }
}

export function aggregateSentiment(comments) {
  const counts = { Positive: 0, Negative: 0, Neutral: 0, Question: 0 }
  for (const c of comments) {
    counts[c.sentiment] = (counts[c.sentiment] || 0) + 1
  }
  const total = comments.length || 1
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, count]) => ({
      name,
      value: parseFloat(((count / total) * 100).toFixed(1)),
      count,
      color: SENTIMENT_COLORS[name],
    }))
}

export function aggregateEmotions(comments) {
  const counts = {}
  for (const c of comments) {
    counts[c.emotion] = (counts[c.emotion] || 0) + 1
  }
  const total = comments.length || 1
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      value: parseFloat(((count / total) * 100).toFixed(1)),
      count,
      color: colors[i % colors.length],
    }))
}
