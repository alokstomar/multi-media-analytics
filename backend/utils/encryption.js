import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

// Get the key from environment, or use a default one with a warning
const keyMaterial = process.env.ENCRYPTION_KEY || 'default-secret-key-replace-this-in-production-32'
if (!process.env.ENCRYPTION_KEY) {
  console.warn('WARNING: ENCRYPTION_KEY is not defined in env. Using fallback key.')
}

// Derive a 32-byte key using SHA-256 of the key material to guarantee exactly 256 bits
const ENCRYPTION_KEY = crypto.createHash('sha256').update(keyMaterial).digest()

/**
 * Encrypt a text using AES-256-GCM.
 * Returns a string formatted as "iv_hex:auth_tag_hex:ciphertext_hex"
 */
export function encrypt(text) {
  if (!text) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypt a text previously encrypted using AES-256-GCM.
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return ''
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    return ''
  }
}
