import { Component } from 'react'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

// Top-level and per-page error boundary. Catches render-time crashes so a
// single failing component never whitens the whole dashboard. In production
// the default fallback offers a reload; in development the stack is shown
// to speed up debugging. Pass a `fallback` prop for custom per-page UI.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Surface in console for dev tools; production should forward to Sentry
    // or equivalent from here.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (typeof this.props.fallback === 'function') {
      return this.props.fallback(this.state.error, this.handleReload)
    }
    if (this.props.fallback) return this.props.fallback

    const isDev = import.meta.env?.DEV
    return (
      <div className="rounded-[20px] border border-red-100 bg-white p-8 m-4" style={{ boxShadow: cs }}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">Something went wrong</h3>
            <p className="text-sm text-gray-500 mt-1">
              {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
            </p>
            {isDev && this.state.error?.stack && (
              <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-auto max-h-48">
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
