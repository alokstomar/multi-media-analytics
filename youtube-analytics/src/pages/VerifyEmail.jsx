import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'
import { CheckCircle, XCircle, Sparkles, Loader } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    const verify = async () => {
      try {
        const res = await api.post('/api/auth/verify-email', { token })
        setStatus('success')
        setMessage(res.data.message || 'Email verified successfully!')
      } catch (err) {
        setStatus('error')
        setMessage(err.response?.data?.error || 'Verification failed.')
      }
    }

    verify()
  }, [token])

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Email Verification</h1>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 text-center bg-white/50 border border-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
          {status === 'loading' && (
            <div className="py-8">
              <Loader className="w-10 h-10 text-gray-400 mx-auto animate-spin mb-4" />
              <p className="text-gray-500 text-sm font-medium">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-emerald-50 border border-emerald-100">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-950 mb-2">Verified!</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
              <Link
                to="/login"
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 text-sm"
              >
                Go to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-red-50 border border-red-100">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-950 mb-2">Verification Failed</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
              <Link
                to="/login"
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 text-sm"
              >
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
