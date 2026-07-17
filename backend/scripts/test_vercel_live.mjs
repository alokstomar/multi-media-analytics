import axios from 'axios'

const BASE_URL = 'https://multi-channel-api.vercel.app'
const EMAIL = 'yugjain4400@gmail.com'
const PASSWORD = 'Alok@2004'
// Use a username that is definitely NOT already added in Yug's workspace
const NEW_USERNAME = 'pubity'

console.log('=== STEP 1: Log in to Vercel Backend ===')
let cookie = ''
let workspaceId = ''

try {
  const loginResp = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: EMAIL,
    password: PASSWORD
  }, {
    validateStatus: () => true
  })

  console.log('Login status:', loginResp.status)
  if (loginResp.status === 200 && loginResp.data?.success) {
    const setCookie = loginResp.headers['set-cookie']
    if (setCookie) {
      cookie = setCookie.map(c => c.split(';')[0]).join('; ')
    }
    workspaceId = loginResp.data?.data?.user?.activeWorkspaceId || ''
    console.log('User activeWorkspaceId:', workspaceId)
  } else {
    console.error('Login failed:', loginResp.data)
    process.exit(1)
  }
} catch (err) {
  console.error('Error during login:', err.message)
  process.exit(1)
}

console.log(`\n=== STEP 2: Call Add Instagram Account for "${NEW_USERNAME}" ===`)
const startTime = Date.now()
try {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (cookie) {
    headers['Cookie'] = cookie
  }
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId
  }

  const addResp = await axios.post(`${BASE_URL}/api/instagram/accounts/${NEW_USERNAME}`, {}, {
    headers,
    timeout: 300000,
    validateStatus: () => true
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`Add Account status (took ${duration}s):`, addResp.status)
  console.log('Add Account response:', JSON.stringify(addResp.data, null, 2))
} catch (err) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.error(`Error during add account (took ${duration}s):`, err.message)
}
