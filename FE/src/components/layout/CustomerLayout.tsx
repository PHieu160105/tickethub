import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Outlet } from 'react-router-dom';

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-space-900 flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16"> {/* pt-16 bù chiều cao navbar fixed */}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}