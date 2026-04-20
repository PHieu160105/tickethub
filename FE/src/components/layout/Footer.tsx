import { cn } from '@/lib/utils';
import { Container } from './Container';
import { CreditCard, Smartphone, } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  'Về chúng tôi': ['/about', '/careers', '/press', '/blog'],
  'Hỗ trợ': ['/help-center', '/refund-policy', '/contact', '/faq'],
  'Thể loại': ['/concerts', '/sports', '/theater', '/festivals'],
  'Hợp tác': ['/organizer-portal', '/advertising', '/partners', '/api'],
};

export function Footer() {
  return (
    <footer className="bg-space-950 border-t border-white/10 mt-auto">
      <Container className="py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-display font-bold">
              <span className="text-brand-red">Ticket</span>
              <span className="text-brand-yellow">Rush</span>
            </span>
            <p className="mt-2 text-sm text-gray-400">
              Nền tảng phân phối vé điện tử hàng đầu. Trải nghiệm sự kiện theo cách của bạn.
            </p>
            {/* <div className="flex gap-3 mt-4">
              {[Instagram, Twitter, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Icon className="h-4 w-4 text-gray-400" />
                </a>
              ))}
            </div> */}
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-white mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <Link to={link} className="text-sm text-gray-400 hover:text-brand-yellow transition-colors">
                      {link.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© 2026 TicketRush. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Phương thức thanh toán:</span>
            <div className="flex gap-2">
              <CreditCard className="h-6 w-6 text-gray-400" />
              <Smartphone className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}