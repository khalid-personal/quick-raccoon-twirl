import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface DawmBrandProps {
  appearance?: 'light' | 'dark';
  compact?: boolean;
  iconOnly?: boolean;
  showOrigin?: boolean;
  subtitle?: string;
  className?: string;
}

const LogoMark: React.FC<{ className?: string }> = ({ className }) => {
  const gradientId = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label="DAWM logo"
      className={cn('shrink-0 drop-shadow-[0_8px_16px_rgba(14,34,37,0.22)]', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#328078" />
          <stop offset="1" stopColor="#12282A" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="40" fill={`url(#${gradientId})`} />
      <rect x="1" y="1" width="158" height="158" rx="39" fill="none" stroke="#C8F575" strokeOpacity="0.28" strokeWidth="2" />
      <path d="M46 42 H78 C104 42 122 59 122 80 C122 101 104 118 78 118 H46 Z" fill="none" stroke="#F4F4ED" strokeWidth="14" strokeLinejoin="round" />
      <polyline points="64,98 79,84 94,70" fill="none" stroke="#C8F575" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="64" cy="98" r="5" fill="#F4F4ED" />
      <circle cx="79" cy="84" r="5" fill="#F4F4ED" />
      <circle cx="94" cy="70" r="9" fill="#C8F575" fillOpacity="0.3" />
      <circle cx="94" cy="70" r="6" fill="#C8F575" />
    </svg>
  );
};

const EthiopiaFlag: React.FC<{ className?: string }> = ({ className }) => {
  const clipId = useId().replace(/:/g, '');

  return (
    <svg viewBox="0 0 72 48" role="img" aria-label="Flag of Ethiopia" className={className}>
      <defs>
        <clipPath id={clipId}><rect width="72" height="48" rx="6" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="72" height="16" fill="#078930" />
        <rect y="16" width="72" height="16" fill="#FCDD09" />
        <rect y="32" width="72" height="16" fill="#DA121D" />
        <circle cx="36" cy="24" r="12" fill="#0F47AF" />
        <g transform="translate(36 24)" stroke="#FCDD09" strokeLinecap="round">
          <g strokeWidth="0.9">
            <line y1="-3.4" y2="-10.4" />
            <line x1="3.23" y1="1.05" x2="9.9" y2="3.2" />
            <line y1="3.4" y2="10.4" />
            <line x1="-3.23" y1="1.05" x2="-9.9" y2="3.2" />
          </g>
          <path d="M0 -8.5 L2 -2.75 L8.08 -2.63 L3.23 1.05 L5 6.88 L0 3.4 L-5 6.88 L-3.23 1.05 L-8.08 -2.63 L-2 -2.75 Z" fill="none" strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      </g>
      <rect x="0.5" y="0.5" width="71" height="47" rx="5.5" fill="none" stroke="#0B1230" strokeOpacity="0.25" />
    </svg>
  );
};

const DawmBrand: React.FC<DawmBrandProps> = ({
  appearance = 'light',
  compact = false,
  iconOnly = false,
  showOrigin = false,
  subtitle,
  className,
}) => {
  const isDark = appearance === 'dark';

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <LogoMark className={compact ? 'h-9 w-9' : 'h-12 w-12 sm:h-14 sm:w-14'} />
      {!iconOnly && <div className="min-w-0">
        <div className={cn(
          'font-bold leading-none tracking-[0.07em]',
          compact ? 'text-base' : 'text-2xl sm:text-[30px]',
          'font-["Sora",Inter,ui-sans-serif,sans-serif]',
          isDark ? 'text-[#F4F4ED]' : 'text-[#12282A]',
        )}>
          DAWM
        </div>
        <div className={cn(
          'mt-1 truncate text-[8px] font-medium uppercase tracking-[0.13em] sm:text-[9px]',
          isDark ? 'text-[#BCD0C3]' : 'text-[#587167]',
        )}>
          {subtitle ?? (compact ? 'Portal' : 'Domestic Agency Workforce Management')}
        </div>
      </div>}
      {showOrigin && (
        <div className={cn(
          'ml-auto hidden shrink-0 items-center gap-2.5 border-l pl-4 sm:flex',
          isDark ? 'border-[#F4F4ED]/15' : 'border-[#12282A]/15',
        )}>
          <EthiopiaFlag className="h-8 w-12 rounded-md shadow-sm" />
          <div className="leading-tight">
            <div className={cn('text-[9px] font-semibold tracking-[0.16em]', isDark ? 'text-[#F4F4ED]' : 'text-[#12282A]')}>MADE IN ETHIOPIA</div>
            <div className={cn('mt-1 text-[11px]', isDark ? 'text-[#BCD0C3]' : 'text-[#587167]')} lang="am">በኢትዮጵያ የተሰራ</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DawmBrand;
