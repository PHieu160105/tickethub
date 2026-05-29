import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, Rocket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
//import LogoSVG from '@/assets/logo.svg'
import { FcGoogle } from 'react-icons/fc'
import type { User as ApiUser } from '@/types'

export function Logo() {
  return (
    <Link to="/" aria-label="Về trang chủ" className="flex items-center gap-2 mx-auto mb-8">
      <p className='text-lg'>TICKETHUB</p>
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
  const { login, loginWithGoogle, acceptExternalAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const userParam = searchParams.get('user')
    const oauthError = searchParams.get('oauth_error')

    if (oauthError) {
      setErrorMessage(oauthError)
      setSearchParams({}, { replace: true })
      return
    }

    if (!accessToken || !refreshToken || !userParam) return

    try {
      const parsedUser = JSON.parse(userParam) as ApiUser
      const user = acceptExternalAuth({ access_token: accessToken, refresh_token: refreshToken, user: parsedUser })
      setSearchParams({}, { replace: true })
      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true })
    } catch {
      setErrorMessage('Đăng nhập ngoài đã hoàn tất nhưng hệ thống không xử lý được phản hồi.')
      setSearchParams({}, { replace: true })
    }
  }, [acceptExternalAuth, navigate, searchParams, setSearchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    try {
      const user = await login(email, password)
      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-theme-page min-h-screen text-white font-body selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden relative">

      <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
        {/* Khung đăng nhập chính. */}
        <div className="w-full max-w-[480px] animate-fade-in-up">
          {/* Khu vực logo. */}
          <Logo />
          {/* Thẻ form đăng nhập. */}
          <div className="backdrop-blur-xl customer-bg-surface rounded-xl p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-[var(--customer-bg-opp)]">
            {/* Lớp ánh sáng nhẹ khi hover, chỉ dùng để tăng chiều sâu thị giác. */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative z-10">
              <div className="mb-8">
                <h2 className="text-2xl font-headline font-bold tracking-tight customer-text-header mb-2">Chào mừng quay lại</h2>
                <p className="text-slate-400 text-sm font-body">Đăng nhập để tiếp tục đặt vé và quản lý sự kiện của bạn.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Ô nhập email. */}
                <div className="space-y-2">
                  <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">Email</label>
                  <div className="relative group/input">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300 group"
                      placeholder="Nhập email của bạn"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                  </div>
                </div>

                {/* Ô nhập mật khẩu. */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">Mật khẩu</label>
                    <a className="text-[10px] font-label tracking-wide uppercase text-slate-500 hover:text-primary transition-colors" href="#">Quên mật khẩu?</a>
                  </div>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-12 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300"
                      placeholder="Nhập mật khẩu"
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

                {/* Nút gửi form đăng nhập. */}
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
                      Đăng nhập
                      <Rocket className="h-5 w-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform duration-300" />
                    </>
                  )}
                </Button>
              </form>

              {/* Dòng phân cách giữa đăng nhập mật khẩu và đăng nhập mạng xã hội. */}
              <div className="relative my-8 flex items-center">
                <div className="flex-grow border-t border-slate-600/20" />
                <span className="mx-4 font-label text-[10px] tracking-[0.2em] text-slate-500 uppercase bg-slate-900/0 px-2">Hoặc đăng nhập bằng</span>
                <div className="flex-grow border-t border-slate-600/20" />
              </div>

              {/* Nút đăng nhập mạng xã hội. */}
              <div className="grid grid-cols-1 gap-4">
                <button
                  className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc"
                  onClick={async () => {
                    setIsLoading(true)
                    setErrorMessage('')
                    try {
                      const user = await loginWithGoogle()
                      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true })
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập Google thất bại. Vui lòng thử lại.')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  disabled={isLoading}
                >
                  <FcGoogle className="w-5 h-5" />
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-slate-500">Google</span>
                </button>
              </div>

              {/* Liên kết sang trang đăng ký. */}
              <div className="mt-10 text-center">
                <p className="text-sm font-body text-slate-400">
                  Chưa có tài khoản?
                  <Link to="/register" className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Liên kết quay lại trang chủ. */}
          <div className="mt-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-label uppercase tracking-widest">
              <ArrowLeft className="h-4 w-4" />
              Quay về trang chủ
            </Link>
          </div>
        </div>
      </main>

      {/* Footer đơn giản của trang. */}
      <footer className="relative z-10 py-8 px-6 text-center">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-label tracking-widest uppercase text-slate-500/50">
            © 2024 TicketHub. Nền tảng đặt vé sự kiện.
          </p>
          <div className="flex gap-6">
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Hỗ trợ</a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Quyền riêng tư</a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#">Bảo mật</a>
          </div>
        </div>
      </footer>
      {/* CSS animation riêng cho hiệu ứng xuất hiện của form. */}
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
