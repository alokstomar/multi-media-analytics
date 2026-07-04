export const MODEL_PRICING = {
  openai: {
    'gpt-4o-mini':  { input: 0.15,  output: 0.60 },
    'gpt-4o':       { input: 2.50,  output: 10.00 },
    'gpt-4-turbo':  { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo':{ input: 0.50,  output: 1.50 }
  },
  deepseek: {
    'DeepSeek-V4-Pro': { input: 0.27, output: 1.10 }
  },
  gemini: {
    'gemini-2.0-flash':     { input: 0.10,  output: 0.40 },
    'gemini-2.0-flash-lite':{ input: 0.075, output: 0.30 },
    'gemini-2.5-flash':     { input: 0.30,  output: 2.50 },
    'gemini-2.5-pro':       { input: 1.25,  output: 10.00 },
    'gemini-1.5-pro':       { input: 1.25,  output: 5.00 },
    'gemini-1.5-flash':     { input: 0.075, output: 0.30 }
  },
  groq: {
    'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 }
  },
  stub: {
    'stub-model':           { input: 0.15,  output: 0.60 }
  }
}

export function calculateCost({ provider, model, promptTokens, completionTokens }) {
  const providerKey = provider?.toLowerCase()
  const rates = MODEL_PRICING[providerKey]?.[model] || { input: 0.15, output: 0.60 } // Safe default fallback cost
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000
}
