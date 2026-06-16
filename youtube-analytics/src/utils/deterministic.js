/**
 * Deterministic pseudo-random helpers — same seed always yields same value.
 * Used instead of Math.random() for estimated metrics.
 */

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededFloat(seed, min = 0, max = 1) {
  const n = hashString(String(seed))
  const unit = n / 4294967295
  return min + unit * (max - min)
}

export function seededInt(seed, min, max) {
  return Math.round(seededFloat(seed, min, max))
}
