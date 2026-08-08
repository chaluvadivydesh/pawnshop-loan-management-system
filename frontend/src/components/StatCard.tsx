import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'gold' | 'silver' | 'emerald' | 'rose' | 'amber' | 'slate';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'slate'
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'gold':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-inner';
      case 'silver':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      case 'rose':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
      case 'amber':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-0.5 border border-slate-200/80 dark:border-slate-800 flex justify-between items-start">
      <div className="space-y-2">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 block">
          {title}
        </span>
        <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      <div className={`p-3.5 rounded-2xl border ${getBadgeStyle()} shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};
