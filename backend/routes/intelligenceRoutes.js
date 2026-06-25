import { Router } from 'express'
import multer from 'multer'
import {
  healthCheck,
  analyzeTitle,
  analyzeThumbnail,
  analyzeScript,
  generateVideoIdeas,
  generateShortsIdeas,
  getContentGaps,
  getStrategistTips,
  predictPerformance,
  summarizeAlerts,
} from '../controllers/intelligenceController.js'

const router = Router()

// Configure Multer for in-memory image uploads with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'))
    }
    cb(null, true)
  }
})

router.get('/health', healthCheck)

// Channel-scoped intelligence
router.post('/:channelId/ideas', generateVideoIdeas)
router.post('/:channelId/shorts-ideas', generateShortsIdeas)
router.post('/:channelId/content-gaps', getContentGaps)
router.post('/:channelId/strategist', getStrategistTips)
router.post('/:channelId/predict-performance', predictPerformance)
router.post('/:channelId/alerts-summary', summarizeAlerts)

// Input-scoped analysis (no channel required)
router.post('/analyze/title', analyzeTitle)
router.post('/analyze/thumbnail', upload.single('thumbnail'), (err, req, res, next) => {
  // Catch Multer/Upload specific errors (e.g. fileFilter rejection or size limits)
  if (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message
      }
    })
  }
  next()
}, analyzeThumbnail)
router.post('/analyze/script', analyzeScript)

export default router
