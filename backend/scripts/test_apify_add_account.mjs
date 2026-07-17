/**
 * DIAGNOSTIC SCRIPT — test_apify_add_account.mjs
 *
 * Directly tests the ApifyProvider.getProfile() call that addAccount()
 * makes, so we can see the exact error without needing auth tokens.
 *
 * Run: node backend/scripts/test_apify_add_account.mjs
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

console.log('\n=== PHASE 1: Environment ===')
console.log('INSTAGRAM_PROVIDER:', process.env.INSTAGRAM_PROVIDER)
console.log('APIFY_TOKEN:', process.env.APIFY_TOKEN ? `${process.env.APIFY_TOKEN.slice(0, 20)}...` : 'MISSING')
console.log('APIFY_REELS_LIMIT:', process.env.APIFY_REELS_LIMIT)
console.log('APIFY_COMMENTS_LIMIT:', process.env.APIFY_COMMENTS_LIMIT)

import ApifyProvider from '../services/instagram/apifyProvider.js'
import { providerFactory } from '../services/instagram/providerFactory.js'

console.log('\n=== PHASE 2: Provider Factory ===')
let provider
try {
  provider = providerFactory.getProvider()
  console.log('Provider resolved:', provider.constructor.name)
} catch (err) {
  console.error('PROVIDER FACTORY FAILED:', err.message)
  console.error('Stack:', err.stack)
  process.exit(1)
}

console.log('\n=== PHASE 3: getProfile("mrbeast") ===')
try {
  const profile = await provider.getProfile('mrbeast')
  console.log('SUCCESS — profile returned:')
  console.log('  username:', profile.username)
  console.log('  fullName:', profile.fullName)
  console.log('  followers:', profile.followers)
  console.log('  following:', profile.following)
  console.log('  profilePic:', profile.profilePic ? profile.profilePic.slice(0, 60) + '...' : 'EMPTY')
  console.log('  source:', profile.source)
  console.log('  isMock:', profile.isMock)
} catch (err) {
  console.error('\nPROVIDER ERROR — this is the exact error addAccount() sees:')
  console.error('  err.message:', err.message)
  console.error('  err.code:', err.code)
  console.error('  err.status:', err.status)
  console.error('  err.upstreamBody:', JSON.stringify(err.upstreamBody, null, 2))
  if (err.response) {
    console.error('  err.response.status:', err.response?.status)
    console.error('  err.response.data:', JSON.stringify(err.response?.data, null, 2))
  }
  console.error('\nFull stack:')
  console.error(err.stack)
}

console.log('\n=== PHASE 4: Direct Apify HTTP test ===')
// Test the raw HTTP call independently
import axios from 'axios'
const APIFY_TOKEN = process.env.APIFY_TOKEN
const url = 'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=60'
const input = {
  directUrls: ['https://www.instagram.com/instagram/'],
  resultsType: 'details',
  resultsLimit: 1,
}

console.log('Calling Apify directly with 60s timeout...')
try {
  const resp = await axios.post(url, input, {
    headers: {
      Authorization: `Bearer ${APIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 90000,
    validateStatus: () => true,
  })
  console.log('Apify HTTP status:', resp.status)
  if (Array.isArray(resp.data)) {
    console.log('Apify items count:', resp.data.length)
    if (resp.data.length > 0) {
      const item = resp.data[0]
      console.log('First item keys:', Object.keys(item))
      if (item.error) {
        console.error('ACTOR ERROR ITEM:', JSON.stringify(item, null, 2))
      } else {
        console.log('Sample fields — username:', item.username, '| followers:', item.followersCount)
      }
    }
  } else {
    console.log('Apify response (not array):', JSON.stringify(resp.data, null, 2).slice(0, 500))
  }
} catch (err) {
  console.error('RAW AXIOS ERROR:', err.message)
  console.error('  code:', err.code)
  console.error('  response status:', err.response?.status)
  console.error('  response data:', JSON.stringify(err.response?.data, null, 2))
}
