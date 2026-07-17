/**
 * DIAGNOSTIC — make real addAccount HTTP call with a real JWT
 * Uses user: riyansh.studio007@gmail.com / workspace from DB
 */
import '../config/dns.js'
import '../config/env.js'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import axios from 'axios'

const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'

// Use the real user from DB
const USER_ID = '6a342a4869ffc2c2f881d35e'
const WORKSPACE_ID = '6a342a4969ffc2c2f881d360'

// Generate a JWT token
const token = jwt.sign(
  { userId: USER_ID },
  JWT_SECRET,
  { expiresIn: '1h' }
)
console.log('Generated JWT for user:', USER_ID)

const BASE = 'http://localhost:5000'

console.log('\n=== POST /api/instagram/accounts/mrbeast ===')
try {
  const resp = await axios.post(
    `${BASE}/api/instagram/accounts/mrbeast`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-workspace-id': WORKSPACE_ID,
      },
      timeout: 300000,
      validateStatus: () => true,
    }
  )
  console.log('HTTP Status:', resp.status)
  console.log('Response:', JSON.stringify(resp.data, null, 2))
  if (resp.data?.stack) {
    console.log('\nStack trace from server:')
    console.log(resp.data.stack)
  }
} catch (err) {
  console.error('HTTP error:', err.message)
  console.error('code:', err.code)
}
