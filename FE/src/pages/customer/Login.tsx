import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, Rocket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import LogoSVG from '@/assets/logo.svg'
import { FcGoogle } from 'react-icons/fc'
import { SiDiscord } from 'react-icons/si'
import type { User as ApiUser } from '@/types'

export function Logo() {
  return (
    <Link to="/" aria-label="TicketRush Home" className="flex items-center gap-2 mx-auto mb-8">
      <img src={LogoSVG} alt="TicketRush Logo" className="h-15 w-auto mx-auto" />
    </Link>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const { login, loginWithGoogle, startDiscordLogin, acceptExternalAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const userParam = searchParams.get('user')
    const oauthError = searchParams.get('oauth_error')

    if (oauthError) {
      setErrorMessage(oauthError)
      setSearchParams({}, { replace: true })
      return
    }

    if (!accessToken || !userParam) return

    try {
      const parsedUser = JSON.parse(userParam) as ApiUser
      const user = acceptExternalAuth({ access_token: accessToken, user: parsedUser })
      setSearchParams({}, { replace: true })
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch {
      setErrorMessage('Discord login completed, but the response could not be processed.')
      setSearchParams({}, { replace: true })
    }
  }, [acceptExternalAuth, navigate, searchParams, setSearchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    try {
      const user = await login(email, password)
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-theme-page min-h-screen text-white font-body selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden relative">

      <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
        {/* Auth Container */}
        <div className="w-full max-w-[480px] animate-fade-in-up">
          {/* Logo Section */}
          <Logo />
          {/* Login Card */}
          <div className="backdrop-blur-xl bg-slate-900/80 rounded-xl p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-white/10">
            {/* Subtle light sweep overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative z-10">
              <div className="mb-8">
                <h2 className="text-2xl font-headline font-bold tracking-tight text-white mb-2">Welcome Back</h2>
                <p className="text-slate-400 text-sm font-body">Enter your coordinates to re-engage.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div className="space-y-2">
                  <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">Identifier</label>
                  <div className="relative group/input">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300 group"
                      placeholder="Email or Phone"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">Encryption</label>
                    <a className="text-[10px] font-label tracking-wide uppercase text-slate-500 hover:text-primary transition-colors" href="#">Forgot Cipher?</a>
                  </div>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-12 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300"
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest text-sm glow-button hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                  variant="primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      Enter Orbit
                      <Rocket className="h-5 w-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform duration-300" />
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-8 flex items-center">
                <div className="flex-grow border-t border-slate-600/20" />
                <span className="mx-4 font-label text-[10px] tracking-[0.2em] text-slate-500 uppercase bg-slate-900/0 px-2">Neutral Zone</span>
                <div className="flex-grow border-t border-slate-600/20" />
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc"
                  onClick={async () => {
                    setIsLoading(true)
                    setErrorMessage('')
                    try {
                      const user = await loginWithGoogle()
                      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true })
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : 'Google login failed. Please try again.')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  disabled={isLoading}
                >
                  <FcGoogle className="w-5 h-5" />
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-white">Google</span>
                </button>
                <button
                  className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc"
                  onClick={() => {
                    setErrorMessage('')
                    startDiscordLogin()
                  }}
                  disabled={isLoading}
                >
                  <SiDiscord className="w-5 h-5 text-[#5865F2]" />
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-white">Discord</span>
                </button>
              </div>

              {/* Footer Link */}
              <div className="mt-10 text-center">
                <p className="text-sm font-body text-slate-400">
                  New explorer?
                  <Link to="/register" className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                    Establish Link
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Accessibility/Back link */}
          <div className="mt-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-label uppercase tracking-widest">
              <ArrowLeft className="h-4 w-4" />
              Return to Surface
            </Link>
          </div>
        </div>
      </main>

      {/* Simple Page Footer */}
      <footer className="relative z-10 py-8 px-6 text-center">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-label tracking-widest uppercase text-slate-500/50">
            © 2024 TicketRush. Powered by the Cosmic Voyager.
          </p>
          <div className="flex gap-6">
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Support</a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Privacy</a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Security</a>
          </div>
        </div>
      </footer>
      {/* Custom Animations Style */}
      <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
