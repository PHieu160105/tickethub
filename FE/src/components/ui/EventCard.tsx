import { cn } from '@/lib/utils';
import { forwardRef, type HTMLAttributes } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface EventCardProps extends Omit<HTMLAttributes<HTMLAnchorElement>, 'title'> {
  variant?: 'default' | 'featured' | 'compact';
  image: string;
  title: string;
  date: string;
  venue: string;
  price: string;
  badge?: string;
  href?: string;
}

export const EventCard = forwardRef<HTMLAnchorElement, EventCardProps>(
  ({ className, variant = 'default', image, title, date, venue, price, badge, href, ...props }, ref) => {
    if (variant === 'featured') {
      return (
        <Link to={href || '#'} className={cn('group relative h-80 rounded-xl overflow-hidden glass-panel border-none block', className)}>
          <img
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60"
            src={image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 w-full">
            <div className="flex justify-between items-end">
              <div>
                {badge && (
                  <span className="inline-block px-3 py-1 bg-primary text-on-primary-container text-[10px] font-headline font-black uppercase tracking-[0.2em] rounded mb-3">
                    {badge}
                  </span>
                )}
                <h3 className="text-3xl font-headline font-black tracking-tighter mb-2">{title}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-secondary" />
                    {date}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-secondary" />
                    {venue}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-headline uppercase tracking-widest text-slate-400">Starting From</p>
                <p className="text-3xl font-headline font-black text-secondary">{price}</p>
              </div>
            </div>
          </div>
        </Link>
      );
    }

    return (
      <Link
        to={href || '#'}
        ref={ref}
        className={cn(
          'customer-bg-surface border-1 border-[var(--customer-bg-opp)] rounded-xl overflow-hidden group hover:translate-y-[-4px] transition-all duration-300 block',
          className
        )}
        {...props}
      >
        <div className="h-48 relative overflow-hidden">
          <img
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            src={image}
          />
          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg text-center min-w-[50px]">
            <p className="text-primary font-headline font-black text-lg leading-none">{date.split(' ')[0]}</p>
            <p className="text-[10px] uppercase font-headline font-bold text-slate-400">{date.split(' ')[1]}</p>
          </div>
        </div>
        <div className="p-5">
          <h4 className="font-headline font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">
            {title}
          </h4>
          <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {venue}
          </p>
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-secondary font-headline font-bold">{price}</span>
            <button className="bg-primary hover:bg-primary hover:opacity-50 text-white font-bold p-2 rounded-xl transition-colors">
              <span className="material-symbols-outlined text-sm">Chi tiết</span>
            </button>
          </div>
        </div>
      </Link>
    );
  }
);
EventCard.displayName = 'EventCard';