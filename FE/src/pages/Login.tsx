import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle login logic here
    console.log('Login attempt:', { email, password })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden relative">
      {/* Star Field Background */}
      <div className="fixed inset-0 opacity-30 pointer-events-none"
           style={{
             backgroundImage: `
               radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
               radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
               radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
               radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
               radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
               radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0))
             `,
             backgroundRepeat: 'repeat',
             backgroundSize: '200px 200px'
           }} />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_rgba(252,83,109,0.05)_0%,_transparent_70%)] pointer-events-none" />

      <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
        {/* Auth Container */}
        <div className="w-full max-w-[480px]">
          {/* Logo Section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
              TicketRush
            </h1>
            <p className="text-secondary font-headline tracking-widest text-[10px] uppercase mt-2">Access the cosmic pulse</p>
          </div>

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
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300">alternate_email</span>
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300 group"
                      placeholder="Email or Phone"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-primary transition-colors duration-300">lock</span>
                    <input
                      className="w-full bg-slate-800 border-0 rounded-lg py-4 pl-12 pr-12 text-white placeholder:text-slate-500 focus:ring-0 focus:bg-slate-800 transition-all duration-300"
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest text-sm glow-button hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                  variant="primary"
                >
                  Enter Orbit
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">rocket_launch</span>
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
                <button className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc">
                  <img alt="Google" className="w-5 h-5 opacity-80 group-hover/soc:opacity-100" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCAx5EU-jBwV2KjGoNovfi8oMKHDIpA2shBeuNks-IZlLX68-P0FvldriuWcl2yzR3Sd-LGBYE4HQkxI6vyBqmIPbKBycjt2Mr4FVYQEY4HQkxI6vyBqmIPbKBycjt2Mr4FVYQEYjrRsIYqZJtx3FRX16q1DnD-7WapMfeCilncR1AGG9pYhUBu2x81Z41a6b-I2_27kcmiON2U8MWi3xEUq7ehVmHrW1N9v2PjNjBVgPA7-PJyOpL_EutVXFagrcCu5tSYrz3mvBMax9YEAhT2j_kddfqju-6yedGu_T3uUU" />
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-white">Google</span>
                </button>
                <button className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 border border-slate-600/10 hover:bg-white/10 transition-colors group/soc">
                  <span className="material-symbols-outlined text-[#1877F2] text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>social_leaderboard</span>
                  <span className="font-label text-[10px] tracking-widest uppercase font-semibold text-white">Facebook</span>
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
    </div>
  )
}