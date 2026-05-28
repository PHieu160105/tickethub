import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, Calendar, Users, Rocket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import LogoSVG from '@/assets/logo.svg'
import { FcGoogle } from 'react-icons/fc'

export function Logo() {
  return (
    <img src={LogoSVG} alt="Logo TicketRush" className="h-15 w-auto mx-auto" />
  )
}

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 18
    const today = new Date()
    const dob = new Date(dateOfBirth)
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1
    }
    return Math.min(100, Math.max(10, age))
  }

  const normalizeGender = (gender: string): 'male' | 'female' | 'other' => {
    if (gender === 'male' || gender === 'female' || gender === 'other') return gender
    return 'other'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    
    if (!formData.agreeToTerms) {
      setErrorMessage('Vui lòng đồng ý với điều khoản sử dụng.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.')
      return
    }

    if (formData.password.length < 8) {
      setErrorMessage('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }

    setIsLoading(true)
    try {
      await register(formData.email, formData.password, formData.fullName, {
        gender: normalizeGender(formData.gender),
        age: calculateAge(formData.dateOfBirth),
      })
      // Điều hướng nội bộ để tránh reload toàn bộ ứng dụng sau khi đăng ký thành công.
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  return (
    <div className="app-theme-page min-h-screen flex flex-col relative overflow-hidden">

      <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
        {/* Khung đăng ký chính. */}
        <div className="w-full max-w-[600px] animate-fade-in-up">
          {/* Khu vực logo.
          <Logo /> */}

          {/* Thẻ form đăng ký. */}
          <div className="backdrop-blur-xl customer-bg-surface rounded-xl p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-[var(--customer-bg-opp)]">
            {/* Lớp ánh sáng nhẹ khi hover, chỉ dùng để tăng chiều sâu thị giác. */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-headline font-bold tracking-tight customer-text-header mb-2">
                  Tham gia <span className="text-[var(--customer-bg-opt)]">TicketRush</span>
                </h2>
                <p className="text-slate-400 text-sm font-body">
                  Tạo tài khoản để đặt vé nhanh và quản lý vé điện tử của bạn.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Ô nhập họ tên đầy đủ. */}
                <div className="space-y-2">
                  <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                    Họ và tên
                  </label>
                  <div className="relative group/input">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                    <input
                      className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-4 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                      placeholder="Nhập họ và tên"
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                  </div>
                </div>

                {/* Hàng nhập email và số điện thoại. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Email
                    </label>
                    <div className="relative group/input">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <input
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-4 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                        placeholder="ten@example.com"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Số điện thoại
                    </label>
                    <div className="relative group/input">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <input
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-4 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                        placeholder="090 123 4567"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>
                </div>

                {/* Hàng nhập ngày sinh và giới tính. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Ngày sinh
                    </label>
                    <div className="relative group/input">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <input
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-4 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        required
                      />
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Giới tính
                    </label>
                    <div className="relative group/input">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <select
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-4 text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300 appearance-none cursor-pointer"
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Chọn giới tính</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                        <option value="prefer-not">Không muốn trả lời</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>
                </div>

                {/* Hàng nhập mật khẩu và xác nhận mật khẩu. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Mật khẩu
                    </label>
                    <div className="relative group/input">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <input
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-12 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                        placeholder="••••••••"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-secondary">
                      Xác nhận mật khẩu
                    </label>
                    <div className="relative group/input">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300" />
                      <input
                        className="w-full customer-bg-page border-0 rounded-lg py-4 pl-12 pr-12 customer-text-body placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 focus:text-white transition-all duration-300"
                        placeholder="••••••••"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500 ease-out" />
                    </div>
                  </div>
                </div>

                {/* Checkbox xác nhận điều khoản sử dụng. */}
                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                  />
                  <label className="text-xs text-slate-400 font-body leading-relaxed cursor-pointer select-none">
                    Tôi đồng ý với{' '}
                    <a href="/info#dieu_khoan" className="text-secondary font-bold hover:underline decoration-secondary/30 underline-offset-4">
                      điều khoản sử dụng
                    </a>
                    {' '}và chính sách xử lý dữ liệu cá nhân của TicketRush.
                  </label>
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </div>
                )}

                {/* Nút gửi form đăng ký. */}
                <Button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest text-sm glow-button hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                  variant="primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Đang tạo tài khoản...
                    </>
                  ) : (
                    <>
                      Tạo tài khoản
                      <Rocket className="h-5 w-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform duration-300" />
                    </>
                  )}
                </Button>
              </form>

              {/* Dòng phân cách giữa đăng ký thường và đăng ký mạng xã hội. */}
              <div className="relative my-8 flex items-center">
                <div className="flex-grow border-t border-slate-600/20" />
                <span className="mx-4 font-label text-[10px] tracking-[0.2em] text-slate-500 uppercase bg-slate-900/0 px-2">
                  Hoặc đăng ký bằng
                </span>
                <div className="flex-grow border-t border-slate-600/20" />
              </div>

              {/* Nút đăng nhập/đăng ký bằng mạng xã hội. */}
              <div className="grid grid-cols-1 gap-4">
                <button
                  className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={async () => {
                    setIsLoading(true)
                    setErrorMessage('')
                    try {
                      const user = await loginWithGoogle()
                      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true })
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập Google thất bại. Vui lòng thử lại.')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  disabled={isLoading}
                >
                  <FcGoogle className="w-5 h-5" />
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-slate-500">
                    Google
                  </span>
                </button>
              </div>

              {/* Liên kết sang trang đăng nhập. */}
              <div className="mt-8 text-center">
                <p className="text-sm font-body text-slate-400">
                  Đã có tài khoản?
                  <Link to="/login" className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1">
                    Đăng nhập
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
            © 2024 TicketRush. Nền tảng đặt vé sự kiện.
          </p>
          <div className="flex gap-6">
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#support">
              Hỗ trợ
            </a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#privacy">
              Quyền riêng tư
            </a>
            <a className="text-[10px] font-label tracking-widest uppercase text-slate-500/50 hover:text-secondary transition-colors" href="#security">
              Bảo mật
            </a>
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
