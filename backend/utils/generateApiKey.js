import crypto from 'crypto'

export function generateApiKey() {
  return 'ca_live_sk_' + crypto.randomBytes(16).toString('hex')
}

export function computeFingerprint(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16)
}
