import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Mail, ArrowLeft, Sparkles, Send } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f3f4f6]/40 select-none">
      {/* Apple-style White Glass Environment */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Soft background light */}
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vh] rounded-full bg-white blur-[130px] opacity-90" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vh] rounded-full bg-white/60 blur-[120px] opacity-80" />
        
        {/* Vertical glass panes */}
        <div className="absolute inset-y-0 left-[20%] w-[1px] bg-gradient-to-b from-white/90 via-gray-200/10 to-white/90" />
        <div className="absolute inset-y-0 left-[40%] w-[1px] bg-gradient-to-b from-white/90 via-gray-200/10 to-white/90" />
        <div className="absolute inset-y-0 right-[40%] w-[1px] bg-gradient-to-b from-white/90 via-gray-200/10 to-white/90" />
        <div className="absolute inset-y-0 right-[20%] w-[1px] bg-gradient-to-b from-white/90 via-gray-200/10 to-white/90" />
        
        {/* Subtle glass reflection stripes */}
        <div className="absolute top-0 bottom-0 left-[22%] w-[12%] bg-gradient-to-r from-white/05 to-white/0" />
        <div className="absolute top-0 bottom-0 right-[22%] w-[12%] bg-gradient-to-l from-white/05 to-white/0" />
        
        {/* Light reflections on "glossy floor" */}
        <div className="absolute bottom-0 inset-x-0 h-[25vh] bg-gradient-to-t from-white/60 to-transparent pointer-events-none border-t border-white/20" />
        
        {/* Ambient shadow gradient */}
        <div className="absolute inset-0 bg-radial-[ellipse_at_center,_var(--tw-gradient-stops)] from-transparent via-transparent to-gray-200/10 pointer-events-none" />
      </div>

      <div className="w-full max-w-md px-4 relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-white border border-gray-200/80 shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
            <Sparkles className="w-7 h-7 text-gray-900" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reset Password</h1>
          <p className="text-gray-500 mt-2 text-sm">We&apos;ll send you a link to reset it</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 bg-white/50 border border-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-emerald-50 border border-emerald-100">
                <Send className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">If an account exists with that email, a password reset link has been generated. Check the server console for the link.</p>
              <Link to="/login" className="inline-flex items-center gap-2 text-gray-900 hover:underline transition-colors text-sm font-semibold">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 rounded-lg text-sm text-red-600 bg-red-50/80 border border-red-200/50">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:bg-white/80 focus:border-gray-400 focus:ring-4 focus:ring-gray-100/50 text-sm"
                    />
                  </div>
                </div>

                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-sm"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-950/20 border-t-gray-950 rounded-full animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
