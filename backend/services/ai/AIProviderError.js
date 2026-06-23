/**
 * Thrown when a production AI provider (OpenAI / Gemini / Groq) fails. The
 * error handler maps this to HTTP 503 with `{ aiUnavailable: true, provider }`
 * so the frontend can render a clean "AI unavailable" state instead of fake
 * stub output.
 *
 * The original upstream error is preserved on `.cause` for server-side logging.
 */
export class AIProviderError extends Error {
  constructor({ provider, method, model, cause, message } = {}) {
    const reason = message || cause?.message || 'Unknown AI provider failure'
    super(`AI provider ${provider} failed: ${reason}`)
    this.name = 'AIProviderError'
    this.status = 503
    this.aiUnavailable = true
    this.provider = provider || 'unknown'
    this.method = method || null
    this.model = model || null
    if (cause) this.cause = cause
  }
}
