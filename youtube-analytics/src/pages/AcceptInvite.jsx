import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { CheckCircle, XCircle, Sparkles, Loader } from 'lucide-react'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error' | 'login_required'
  const [message, setMessage] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const { isAuthenticated, fetchMe, fetchWorkspaces } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No invitation token provided.')
      return
    }

    if (!isAuthenticated) {
      setStatus('login_required')
      setMessage('Please log in to accept this invitation.')
      return
    }

    const accept = async () => {
      try {
        const res = await api.post('/api/workspaces/invites/accept', { token })
        setStatus('success')
        setMessage(res.data.message || 'You have joined the workspace!')
        setWorkspaceName(res.data.data?.name || '')
        await fetchMe()
        await fetchWorkspaces()
      } catch (err) {
        setStatus('error')
        setMessage(err.response?.data?.error || 'Failed to accept invitation.')
      }
    }

    accept()
  }, [token, isAuthenticated, fetchMe, fetchWorkspaces])

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Team Invitation</h1>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 text-center bg-white/50 border border-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
          {status === 'loading' && (
            <div className="py-8">
              <Loader className="w-10 h-10 text-gray-400 mx-auto animate-spin mb-4" />
              <p className="text-gray-500 text-sm font-medium">Accepting invitation...</p>
            </div>
          )}

          {status === 'login_required' && (
            <div className="py-6">
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
              <Link
                to={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 text-sm"
              >
                Log In to Continue
              </Link>
              <p className="mt-6 text-gray-500 text-sm">
                Don&apos;t have an account? <Link to="/signup" className="text-gray-900 font-semibold underline hover:text-gray-700">Sign up first</Link>
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-emerald-50 border border-emerald-100">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-950 mb-2">Welcome to the Team!</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message} {workspaceName && `(${workspaceName})`}</p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 cursor-pointer text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-red-50 border border-red-100">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-950 mb-2">Invitation Error</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
              <Link
                to="/dashboard"
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 text-sm"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
