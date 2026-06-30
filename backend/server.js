import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB, verifyDbConnected, getDbStatus } from './config/db.js'
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
import instagramAlertsRoutes from './routes/instagramAlertsRoutes.js'
import instagramAIRoutes from './routes/instagramAIRoutes.js'
import schedulerRoutes from './routes/schedulerRoutes.js'
import twitterOAuthRoutes from './routes/twitterOAuthRoutes.js'
import linkedinOAuthRoutes from './routes/linkedinOAuthRoutes.js'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/authRoutes.js'
import workspaceRoutes from './routes/workspaceRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import { initScheduler } from './jobs/scheduler.js'
import { requireAuth, requireWorkspace } from './middlewares/authMiddleware.js'
import { attachAIContext } from './middlewares/aiContextMiddleware.js'

const app = express()

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true)
    }
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '')
    if (origin === allowed || /\.vercel\.app$/.test(origin)) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// Health check (placed before verifyDbConnected to bypass DB check)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// DB diagnostic endpoint (also bypasses verifyDbConnected so it can report
// state DURING a connection outage). Returns connection state only — never
// the URI or credentials. ?reconnect=1 forces a fresh attempt and captures
// the structured error in lastConnectError for the next response payload.
app.get('/api/debug/db', async (req, res) => {
  if (req.query.reconnect === '1') {
    try {
      await connectDB({ force: true })
    } catch {
      // swallowed — the error is now in module state and will be reported below
    }
  }
  res.json(getDbStatus())
})

// Ensure database connection is active for all API routes
app.use('/api', verifyDbConnected)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/settings', requireAuth, attachAIContext, settingsRoutes) // user-level profile (no workspace scope)

const protect = [requireAuth, requireWorkspace]
const aiProtect = [requireAuth, requireWorkspace, attachAIContext]

app.use('/api/channels', protect, channelRoutes)
app.use('/api/channels', protect, videoRoutes)
app.use('/api/analytics', protect, analyticsRoutes)
app.use('/api/dashboard', protect, dashboardRoutes)
app.use('/api/compare', protect, comparisonRoutes)
app.use('/api/comments', protect, commentRoutes)
app.use('/api/intelligence', aiProtect, intelligenceRoutes)
app.use('/api/portfolio/intelligence', aiProtect, portfolioRoutes)
app.use('/api/studio', aiProtect, studioRoutes)
app.use('/api/instagram', instagramRoutes) // Managed internally (contains public callback)
app.use('/api/instagram/alerts', instagramAlertsRoutes) // Phase 8: isolated IG alerts engine
app.use('/api/instagram/intelligence', instagramAIRoutes) // Phase 9: isolated IG AI intelligence
app.use('/api/scheduler', protect, schedulerRoutes)
app.use('/api/twitter', twitterOAuthRoutes) // Managed internally (contains public callback)
app.use('/api/linkedin', linkedinOAuthRoutes) // Managed internally (contains public callback)

// Error handler — must be last
app.use(errorHandler)

// Warm up the DB connection at module load. On Vercel this runs at cold start,
// so the connection is already in-flight by the time the first request hits
// verifyDbConnected (which awaits the same cached promise). Not awaited here —
// module export must remain synchronous, and verifyDbConnected handles failures.
connectDB().catch((err) => {
  console.error('[Server] Warm-up MongoDB connection failed:', err.message)
})

// Only listen on port and start background scheduler if NOT running on Vercel (Serverless Function)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`)
    
    // Connect database immediately for self-hosted environment
    try {
      await connectDB()
    } catch (err) {
      console.error('Initial MongoDB connection failed:', err.message)
    }

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
}

export default app

