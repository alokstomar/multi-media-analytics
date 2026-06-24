import crypto from 'crypto'

/**
 * Parser for User-Agent headers to detect browser, OS, and device type.
 * Ensures compatibility with common browsers and devices.
 */
export function parseUserAgent(ua) {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' }
  }

  let browser = 'Unknown Browser'
  let os = 'Unknown OS'
  let device = 'Windows PC'

  // Browser detection
  if (ua.includes('Edg/')) {
    browser = 'Edge'
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome'
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox'
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari'
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browser = 'Opera'
  }

  // OS & Device detection
  if (ua.includes('Windows NT')) {
    os = 'Windows'
    device = 'Windows PC'
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    os = 'macOS'
    device = 'MacBook Pro'
  } else if (ua.includes('iPhone')) {
    os = 'iOS'
    device = 'iPhone'
  } else if (ua.includes('iPad')) {
    os = 'iOS'
    device = 'iPad'
  } else if (ua.includes('Android')) {
    os = 'Android'
    device = 'Android Device'
  } else if (ua.includes('Linux')) {
    os = 'Linux'
    device = 'Linux PC'
  }

  return { browser, os, device }
}

/**
 * Simple lookup to return "Localhost" for local IPs and "Unknown location" otherwise.
 * Done as requested to avoid fabricating user geolocation.
 */
export function getLocationFromIp(ip) {
  if (!ip) return 'Unknown location'
  const cleanIp = ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip

  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.16.') ||
    cleanIp.startsWith('127.')
  ) {
    return 'Localhost'
  }
  return 'Unknown location'
}

/**
 * Generates a unique, secure sessionId.
 */
export function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
}
