import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Since config/env.js is in the config subdirectory, the .env is located in the parent directory.
const envPath = path.resolve(__dirname, '../.env')

dotenv.config({ path: envPath })

console.log(`[Env] Loaded environment configuration from: ${envPath}`)

// Instagram provider must be configured explicitly — there is no implicit
// 'mock' default. Surface misconfigurations at startup so they're impossible
// to miss in the logs.
const VALID_IG_PROVIDERS = ['apify', 'meta', 'mock']
const igProvider = (process.env.INSTAGRAM_PROVIDER || '').trim().toLowerCase()
if (!igProvider) {
  console.warn(`[Env] INSTAGRAM_PROVIDER is not set. Add Account will fail until it is configured (one of: ${VALID_IG_PROVIDERS.join(', ')}).`)
} else if (!VALID_IG_PROVIDERS.includes(igProvider)) {
  console.warn(`[Env] INSTAGRAM_PROVIDER="${igProvider}" is not recognized. Add Account will fail. Valid values: ${VALID_IG_PROVIDERS.join(', ')}.`)
} else {
  console.log(`[Env] INSTAGRAM_PROVIDER: ${igProvider}`)
}
