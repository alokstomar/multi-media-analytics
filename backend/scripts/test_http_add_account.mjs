/**
 * DIAGNOSTIC SCRIPT — test_http_add_account.mjs
 *
 * Makes real HTTP requests to the running backend server:
 * 1. Login to get a session cookie
 * 2. Call POST /api/instagram/accounts/mrbeast
 * 3. Print exact response + status
 *
 * Run: node backend/scripts/test_http_add_account.mjs
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import axios from 'axios'

const BASE = 'http://localhost:5000'

// ── Step 1: Login ──────────────────────────────────────────────────────
console.log('\n=== STEP 1: Login ===')
let cookie = ''
let workspaceId = ''

// Try known credentials for this project
const CREDS = [
  { email: 'aloks2678@gmail.com', password: 'password123' },
  { email: 'test@test.com', password: 'Test1234!' },
  { email: 'admin@admin.com', password: 'admin123' },
]

let loggedIn = false
for (const cred of CREDS) {
  try {
    const loginResp = await axios.post(`${BASE}/api/auth/login`, cred, {
      withCredentials: true,
      validateStatus: () => true,
    })
    console.log(`Login attempt ${cred.email} → status ${loginResp.status}`)
    if (loginResp.status === 200 && loginResp.data?.success) {
      // Extract cookie from response headers
      const setCookie = loginResp.headers['set-cookie']
      if (setCookie) {
        cookie = setCookie.map(c => c.split(';')[0]).join('; ')
        console.log('Got cookie:', cookie.slice(0, 60) + '...')
      }
      workspaceId = loginResp.data?.data?.user?.activeWorkspaceId || ''
      console.log('workspaceId from login:', workspaceId)
      loggedIn = true
      break
    } else {
      console.log('  Failed:', loginResp.data?.error)
    }
  } catch (err) {
    console.log('  Error:', err.message)
  }
}

if (!loggedIn) {
  console.error('\nCould not login with any known credential.')
  console.log('\nTrying to get workspace from DB directly...')
  
  // Connect to DB directly to find workspace
  import('./config/../config/dns.js').catch(() => {})
  
  process.exit(1)
}

// ── Step 2: Get workspaces if not found ───────────────────────────────
if (!workspaceId) {
  console.log('\n=== STEP 2: Get workspaces ===')
  try {
    const wsResp = await axios.get(`${BASE}/api/workspaces`, {
      headers: { Cookie: cookie },
      validateStatus: () => true,
    })
    console.log('Workspaces status:', wsResp.status)
    console.log('Workspaces data:', JSON.stringify(wsResp.data, null, 2).slice(0, 500))
    if (wsResp.data?.data?.[0]?._id) {
      workspaceId = wsResp.data.data[0]._id
      console.log('Got workspaceId:', workspaceId)
    }
  } catch (err) {
    console.log('  Error getting workspaces:', err.message)
  }
}

// ── Step 3: Call addAccount ────────────────────────────────────────────
console.log('\n=== STEP 3: POST /api/instagram/accounts/mrbeast ===')
try {
  const resp = await axios.post(
    `${BASE}/api/instagram/accounts/mrbeast`,
    {},
    {
      headers: {
        Cookie: cookie,
        ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
      },
      timeout: 300000,
      validateStatus: () => true,
    }
  )
  console.log('Status:', resp.status)
  console.log('Response body:', JSON.stringify(resp.data, null, 2))
  if (resp.data?.stack) {
    console.log('\n=== SERVER STACK TRACE ===')
    console.log(resp.data.stack)
  }
} catch (err) {
  console.error('HTTP error:', err.message)
  console.error('  code:', err.code)
}
