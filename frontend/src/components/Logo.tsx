import { useId } from 'react';
import clsx from 'clsx';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <radialGradient
          id={`${id}-glow`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(20 14) rotate(50) scale(44)"
        >
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      <rect width="64" height="64" rx="16" fill={`url(#${id}-glow)`} />
      <path
        d="M23 17c-4.5 0-6.5 2.2-6.5 6.5v3.8c0 2.6-1.6 4.4-4.5 4.7 2.9.3 4.5 2.1 4.5 4.7v3.8c0 4.3 2 6.5 6.5 6.5"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41 17c4.5 0 6.5 2.2 6.5 6.5v3.8c0 2.6 1.6 4.4 4.5 4.7-2.9.3-4.5 2.1-4.5 4.7v3.8c0 4.3-2 6.5-6.5 6.5"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M32 21.5c.9 6.1 3.9 9.6 10 10.5-6.1.9-9.1 4.4-10 10.5-.9-6.1-3.9-9.6-10-10.5 6.1-.9 9.1-4.4 10-10.5Z" fill="#fff" />
      <path
        d="M51.5 7.5c.35 2.2 1.3 3.15 3.5 3.5-2.2.35-3.15 1.3-3.5 3.5-.35-2.2-1.3-3.15-3.5-3.5 2.2-.35 3.15-1.3 3.5-3.5Z"
        fill="#fff"
        fillOpacity=".9"
      />
    </svg>
  );
}

export function Logo({ size = 30, className, showText = true }: { size?: number; className?: string; showText?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
      <LogoMark size={size} />
      {showText && (
        <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.62 }}>
          <span className="text-fg">Magi</span>
          <span className="brand-text">Doc</span>
        </span>
      )}
    </span>
  );
}
