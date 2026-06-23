import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogIn, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Login error details:', err)
      if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else if (err.request) {
        setError('Cannot connect to the authentication server. Please check that the backend is running and reachable.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in to your Multi Channel account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 bg-white/50 border border-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm text-red-600 bg-red-50/80 border border-red-200/50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:bg-white/80 focus:border-gray-400 focus:ring-4 focus:ring-gray-100/50 text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:bg-white/80 focus:border-gray-400 focus:ring-4 focus:ring-gray-100/50 text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-500 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 text-gray-900 focus:ring-gray-400" style={{ accentColor: '#111827' }} />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-gray-900 font-medium hover:underline transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200/80 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-950/20 border-t-gray-950 rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-[18px] h-[18px] text-gray-900" /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center mt-7 text-gray-500 text-sm">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-gray-900 font-semibold underline hover:text-gray-700 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
