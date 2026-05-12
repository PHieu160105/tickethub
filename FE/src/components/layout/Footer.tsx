import { Container } from './Container';
import { CreditCard, Smartphone, } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  'Vá» chÃºng tÃ´i': ['/about', '/careers', '/press', '/blog'],
  'Há»— trá»£': ['/help-center', '/refund-policy', '/contact', '/faq'],
  'Thá»ƒ loáº¡i': ['/concerts', '/sports', '/theater', '/festivals'],
  'Há»£p tÃ¡c': ['/organizer-portal', '/advertising', '/partners', '/api'],
};

export function Footer() {
  return (
    <footer className="customer-footer-bg border-t customer-border mt-auto">
      <Container className="py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-display font-bold">
              <span className="text-brand-red">Ticket</span>
              <span className="text-brand-yellow">Rush</span>
            </span>
            <p className="mt-2 text-sm customer-text-muted">
              Ná»n táº£ng phÃ¢n phá»‘i vÃ© Ä‘iá»‡n tá»­ hÃ ng Ä‘áº§u. Tráº£i nghiá»‡m sá»± kiá»‡n theo cÃ¡ch cá»§a báº¡n.
            </p>
            {/* <div className="flex gap-3 mt-4">
              {[Instagram, Twitter, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Icon className="h-4 w-4 customer-text-muted" />
                </a>
              ))}
            </div> */}
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold customer-text-header mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <Link to={link} className="text-sm customer-text-muted hover:text-brand-yellow transition-colors">
                      {link.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t customer-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm customer-text-muted">Â© 2026 TicketRush. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="text-xs customer-text-muted">PhÆ°Æ¡ng thá»©c thanh toÃ¡n:</span>
            <div className="flex gap-2">
              <CreditCard className="h-6 w-6 customer-text-muted" />
              <Smartphone className="h-6 w-6 customer-text-muted" />
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
