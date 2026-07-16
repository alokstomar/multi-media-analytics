import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Since config/env.js is in the config subdirectory, the .env is located in the parent directory.
const envPath = path.resolve(__dirname, '../.env')

dotenv.config({ path: envPath })

console.log(`[Env] Loaded environment configuration from: ${envPath}`)
console.log(`[Env] INSTAGRAM_PROVIDER: ${process.env.INSTAGRAM_PROVIDER || 'mock'}`)
