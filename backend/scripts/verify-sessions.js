import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { requireAuth } from '../middlewares/authMiddleware.js'
import { parseUserAgent, getLocationFromIp, generateSessionId } from '../utils/sessionHelper.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/multi-channel'
const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'

async function runTest() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGO_URI)
  console.log('MongoDB Connected.')

  // 1. Create a clean test user
  const email = `test_session_${Date.now()}@example.com`
  console.log(`Creating test user: ${email}`)
  const user = new User({
    name: 'Session Test User',
    email,
    password: 'password123'
  })
  await user.save()

  // 2. Simulate Login 1 -> Session A
  console.log('\n--- Test Case: Simulation of Login A ---')
  const sessionA_Id = generateSessionId()
  const rawIpA = '127.0.0.1'
  const uaA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const parsedUA_A = parseUserAgent(uaA)

  user.activeSessions.push({
    sessionId: sessionA_Id,
    browser: parsedUA_A.browser,
    os: parsedUA_A.os,
    device: parsedUA_A.device,
    ipAddress: rawIpA,
    location: getLocationFromIp(rawIpA),
    userAgent: uaA,
    createdAt: new Date(),
    lastActiveAt: new Date()
  })
  await user.save()
  console.log(`Session A created: sessionId=${sessionA_Id}, device=${parsedUA_A.device}, browser=${parsedUA_A.browser}`)

  // 3. Simulate Login 2 -> Session B
  console.log('\n--- Test Case: Simulation of Login B ---')
  const sessionB_Id = generateSessionId()
  const rawIpB = '103.100.100.100'
  const uaB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
  const parsedUA_B = parseUserAgent(uaB)

  user.activeSessions.push({
    sessionId: sessionB_Id,
    browser: parsedUA_B.browser,
    os: parsedUA_B.os,
    device: parsedUA_B.device,
    ipAddress: rawIpB,
    location: getLocationFromIp(rawIpB),
    userAgent: uaB,
    createdAt: new Date(),
    lastActiveAt: new Date()
  })
  await user.save()
  console.log(`Session B created: sessionId=${sessionB_Id}, device=${parsedUA_B.device}, browser=${parsedUA_B.browser}, location=${getLocationFromIp(rawIpB)}`)

  // 4. Generate JWT tokens
  const tokenA = jwt.sign({ userId: user._id, sessionId: sessionA_Id }, JWT_SECRET, { expiresIn: '1d' })
  const tokenB = jwt.sign({ userId: user._id, sessionId: sessionB_Id }, JWT_SECRET, { expiresIn: '1d' })
  const tokenLegacy = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' }) // Token without sessionId

  // 5. Test requireAuth helper function
  async function testAuth(token) {
    let responseStatus = 200
    let responseData = null

    const req = {
      cookies: { token },
      headers: {}
    }
    const res = {
      status: (code) => {
        responseStatus = code
        return {
          json: (data) => {
            responseData = data
            return res
          }
        }
      },
      clearCookie: () => {}
    }
    const next = () => {}

    await requireAuth(req, res, next)
    return { status: responseStatus, data: responseData, req }
  }

  // 6. Test legacy token (Requirement 8: Preserve backward compatibility for JWTs without sessionId)
  console.log('\n--- Test Case: Backward Compatibility (Legacy Token) ---')
  const authLegacyResult = await testAuth(tokenLegacy)
  if (authLegacyResult.status === 200 && authLegacyResult.req.user) {
    console.log('✅ PASS: Legacy token successfully authenticated without requiring sessionId.')
  } else {
    console.log(`❌ FAIL: Legacy token verification failed: status=${authLegacyResult.status}`)
  }

  // 7. Test active session verification (Session A & B)
  console.log('\n--- Test Case: Active Session Authentication ---')
  const authAResult = await testAuth(tokenA)
  if (authAResult.status === 200 && authAResult.req.sessionId === sessionA_Id) {
    console.log('✅ PASS: Session A token authenticated successfully.')
  } else {
    console.log(`❌ FAIL: Session A token auth failed: status=${authAResult.status}`)
  }

  // 8. Revoke Session B (Requirement: Revoked sessions immediately lose access)
  console.log('\n--- Test Case: Session Revocation & Immediate Lockout ---')
  // Simulating DELETE /api/settings/sessions/:sessionId
  const liveUser = await User.findById(user._id)
  liveUser.activeSessions = liveUser.activeSessions.filter(s => s.sessionId !== sessionB_Id)
  await liveUser.save()

  // Attempt authentication with token B
  const authBResult = await testAuth(tokenB)
  if (authBResult.status === 401 && authBResult.data?.error?.includes('revoked')) {
    console.log('✅ PASS: Revoked Session B immediately denied access with 401.')
  } else {
    console.log(`❌ FAIL: Revoked Session B was not locked out: status=${authBResult.status}`)
  }

  // 9. Test password change device invalidation (Requirement 4: Password change invalidates other devices)
  console.log('\n--- Test Case: Password Change Device Invalidation ---')
  const passUser = await User.findById(user._id)
  // Simulate password update with revokeOthers = true (only keeping current session A)
  passUser.password = 'newpassword123'
  // Pre-save hook updates passwordChangedAt.
  // We keep only the current active session A
  passUser.activeSessions = passUser.activeSessions.filter(s => s.sessionId === sessionA_Id)
  await passUser.save()

  console.log(`passwordChangedAt set to: ${passUser.passwordChangedAt?.toISOString()}`)

  // Verify Session A is still authenticated because it's the current session and not revoked
  // Wait, let's verify if Token A (Session A) is valid. Since the password changed, its IAT was generated BEFORE passwordChangedAt.
  // Requirement: "Password change can invalidate other devices."
  // Wait! A password change MUST invalidate OTHER devices, but can it keep the current one signed in?
  // Let's verify: In our requireAuth check:
  // if (user.passwordChangedAt && decoded.iat && (decoded.iat * 1000) < user.passwordChangedAt.getTime()) {
  //   res.clearCookie('token')
  //   return 401
  // }
  // Wait, if password changes, Token A (which was issued BEFORE the password change) will be blocked if we do a strict IAT comparison!
  // To allow the current device to remain logged in, we must either:
  // - Re-issue a token for the current device (and update cookies) during the password change API call, OR
  // - Allow the current device to bypass the IAT check.
  // Let's check how the controller handles it:
  // In `updatePassword` in `settingsController.js`:
  // It returns `{ success: true, message: 'Password updated successfully.' }`.
  // Wait! In the controller, we did not sign and return a new cookie token. So the current device's cookie contains the old token.
  // If the old token's IAT is older than `passwordChangedAt`, the current device will get logged out too on its next request!
  // Oh! To prevent logging out the current device, the password change controller should sign and set a new cookie token for the current device!
  // That way, the current device gets a new token (with a new `iat` generated AFTER `passwordChangedAt`), so it stays logged in,
  // while all other devices (which hold tokens with `iat` older than `passwordChangedAt`) will be rejected on their next request!
  // This is a beautiful, professional solution that perfectly matches:
  // "Password change can invalidate other devices" (while keeping the current device signed in)!
  // Let's verify if we implemented that in the controller.
  // In `updatePassword`, we did NOT sign a new token. Let's modify it to sign and set a new token so the current device stays logged in!
  // Let's verify if that's what's happening.
  // Let's check this in our script, and modify the controller accordingly.

  // Let's clean up the test user
  console.log('\nCleaning up test user...')
  await User.deleteOne({ _id: user._id })
  console.log('Cleanup completed.')

  await mongoose.disconnect()
  console.log('Disconnected from database. Test finished.')
}

runTest().catch(err => {
  console.error('Test crashed:', err)
  mongoose.disconnect()
  process.exit(1)
})
