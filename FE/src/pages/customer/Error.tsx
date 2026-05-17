import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Footer } from '@/components/layout/Footer';
import LogoSVG from '@/assets/logo.svg'

export function Logo() {
  return (
    <Link to="/" aria-label="Trang chủ TicketRush" className="flex items-center gap-2">
      <img src={LogoSVG} alt="Logo TicketRush" className="h-12 w-auto" />
    </Link>
  )
}

export function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="app-theme-page min-h-screen flex flex-col text-on-background font-body overflow-hidden">
      {/* Thanh điều hướng đầu trang. */}
      <header className="fixed top-0 left-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-slate-950/20 backdrop-blur-sm">
        <Logo/>
        <nav className="hidden md:flex gap-8 items-center font-headline text-gray-500">
          <Link to="/search" className="hover:text-white transition-colors">Sự kiện</Link>
          <Link to="/info#ve" className="hover:text-white transition-colors">Thông tin</Link>
        </nav>
      </header>

      {/* Nội dung chính của trang lỗi. */}
      <main className="flex-grow flex items-center justify-center px-6 relative pt-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-tertiary-container/5 rounded-full blur-[150px]"></div>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
          {/* Khối minh họa trực quan. */}
          <div className="flex justify-center md:justify-end order-1 md:order-2">
            <div className="relative w-64 h-64 md:w-96 md:h-96 animate-float">
              <div className="absolute inset-0 glass-panel rounded-full border border-white/10 flex items-center justify-center overflow-hidden">
                <img
                  src={LogoSVG}
                  alt="Logo TicketRush"
                  className="w-100 object-cover "
                />
              </div>
              {/* Vòng trang trí quanh logo. */}
              <div className="absolute -inset-4 border-2 border-dashed border-primary/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
              {/* Biểu tượng tín hiệu. */}
              <div className="absolute top-4 right-4 w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-on-secondary-fixed shadow-[0_0_15px_#f0c03e]">
                <Satellite className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Khối nội dung chữ. */}
          <div className="text-center md:text-left order-2 md:order-1">
            <div className="inline-block px-4 py-1 glass-panel rounded-full mb-6 border border-white/5">
              <span className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-secondary">Chưa khả dụng</span>
            </div>

            <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tighter customer-text-header mb-2 italic">
              Sắp ra mắt
            </h1>

            <p className="font-body text-lg text-on-surface-variant mb-10 max-w-md mx-auto md:mx-0 leading-relaxed">
              Trang hiện tại chưa khả dụng hoặc sắp được phát triển.
            </p>

            {/* Cụm nút điều hướng chính. */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                variant="primary"
                className="bg-primary-container text-on-primary-container font-headline font-bold py-4 px-8 rounded-xl hover:scale-105 active:scale-95 transition-all duration-300 gap-2"
                onClick={() => navigate('/')}
              >
                <Home className="w-5 h-5" />
                Trở về Trang chủ
              </Button>
              <Button
                variant="outline"
                className="glass-panel text-white font-headline font-semibold py-4 px-8 rounded-xl border border-white/10 hover:bg-white/5 transition-all active:scale-95 gap-2"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5" />
                Quay lại
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Custom Styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .glass-panel {
          backdrop-filter: blur(12px) saturate(180%);
          background: rgba(26, 30, 55, 0.8);
          border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
      `}</style>
    </div>
  );
}

export default ErrorPage;
