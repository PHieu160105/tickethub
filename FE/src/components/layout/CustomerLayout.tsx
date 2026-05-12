import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Outlet } from 'react-router-dom';

export function CustomerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background">
      <Navbar />
      <main className="flex-1 pt-10 customer-bg-body"> {/* pt-16 bù chiều cao navbar fixed */}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}