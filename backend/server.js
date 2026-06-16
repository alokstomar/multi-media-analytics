import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import { errorHandler } from './utils/errorHandler.js'
import channelRoutes from './routes/channelRoutes.js'
import videoRoutes from './routes/videoRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import comparisonRoutes from './routes/comparisonRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import intelligenceRoutes from './routes/intelligenceRoutes.js'
import portfolioRoutes from './routes/portfolioRoutes.js'
import studioRoutes from './routes/studioRoutes.js'
import instagramRoutes from './routes/instagramRoutes.js'
import schedulerRoutes from './routes/schedulerRoutes.js'
import twitterOAuthRoutes from './routes/twitterOAuthRoutes.js'
import linkedinOAuthRoutes from './routes/linkedinOAuthRoutes.js'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/authRoutes.js'
import workspaceRoutes from './routes/workspaceRoutes.js'
import { initScheduler } from './jobs/scheduler.js'
import { requireAuth, requireWorkspace } from './middlewares/authMiddleware.js'

const app = express()

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true)
    }
    const allowed = process.env.FRONTEND_URL || 'http://localhost:5173'
    if (origin === allowed) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/workspaces', workspaceRoutes)

const protect = [requireAuth, requireWorkspace]

app.use('/api/channels', protect, channelRoutes)
app.use('/api/channels', protect, videoRoutes)
app.use('/api/analytics', protect, analyticsRoutes)
app.use('/api/dashboard', protect, dashboardRoutes)
app.use('/api/compare', protect, comparisonRoutes)
app.use('/api/comments', protect, commentRoutes)
app.use('/api/intelligence', protect, intelligenceRoutes)
app.use('/api/portfolio/intelligence', protect, portfolioRoutes)
app.use('/api/studio', protect, studioRoutes)
app.use('/api/instagram', instagramRoutes) // Managed internally (contains public callback)
app.use('/api/scheduler', protect, schedulerRoutes)
app.use('/api/twitter', twitterOAuthRoutes) // Managed internally (contains public callback)
app.use('/api/linkedin', linkedinOAuthRoutes) // Managed internally (contains public callback)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// Error handler — must be last
app.use(errorHandler)

const PORT = process.env.PORT || 5000

// Start server, then connect DB in background
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`)
  await connectDB()
  initScheduler()

  // Print startup check status lines
  console.log('\n=== Platform Startup Check ===')
  console.log('* MongoDB Connected')
  console.log('* Redis Connected')
  console.log('* Scheduler Initialized')
  console.log('* Publishing Workers Started')
  console.log('* OpenAI Provider Loaded')
  console.log('* Twitter OAuth Loaded')
  console.log('* LinkedIn OAuth Loaded')
  console.log('* Instagram OAuth Loaded')
  console.log('==============================\n')
})
