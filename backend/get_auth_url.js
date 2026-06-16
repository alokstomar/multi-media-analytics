import 'dotenv/config'
import jwt from 'jsonwebtoken'
import axios from 'axios'

const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'

async function getUrl() {
  // Generate a valid JWT token for Alok Tomar
  const token = jwt.sign(
    { userId: '6a22969ef9e97620377d7f3c', email: 'enxtai@gmail.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  )

  try {
    const res = await axios.get('http://localhost:5000/api/twitter/auth/url', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-workspace-id': '6a22969ef9e97620377d7f3e'
      }
    })
    console.log('\n==================================================')
    console.log('Twitter/X OAuth Authorization URL:')
    console.log(res.data.data.authUrl)
    console.log('==================================================\n')
  } catch (err) {
    console.error('Failed to get auth URL:', err.response?.data || err.message)
  }
}

getUrl()
