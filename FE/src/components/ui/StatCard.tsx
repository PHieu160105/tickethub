import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'blue',
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-surface-bright/20 transition-all duration-300">
      {icon && (
        <div className="mb-2 text-3xl">{icon}</div>
      )}
      <div className="text-3xl font-headline font-black text-white mb-1">
        {value}
      </div>
      <div className="font-label text-[10px] tracking-widest uppercase text-slate-500 mt-1">
        {title}
      </div>
      {trend && (
        <p
          className={`text-xs mt-2 flex items-center ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% so với tháng trước
        </p>
      )}
    </div>
  );
};