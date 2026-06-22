// Phase 0 diagnostics — gated on VITE_DEBUG_STATE so production builds pay zero cost.
// Enable locally with: VITE_DEBUG_STATE=1 npm run dev
// Then watch the console for [scope] lines to trace which component is resetting state.

const ENABLED = import.meta.env.VITE_DEBUG_STATE === '1'

export function debugLog(scope, ...args) {
  if (!ENABLED) return
  // eslint-disable-next-line no-console
  console.log(`[${scope}]`, ...args)
}
