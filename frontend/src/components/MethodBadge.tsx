import clsx from 'clsx';
import type { HttpMethod } from '../types';
import { METHOD_BG, METHOD_COLORS } from '../lib/utils';

export function MethodText({ method, className }: { method: HttpMethod | string; className?: string }) {
  const m = method as HttpMethod;
  return (
    <span className={clsx('font-mono text-[10.5px] font-semibold tracking-tight', METHOD_COLORS[m] ?? 'text-muted', className)}>
      {m === 'DELETE' ? 'DEL' : m === 'OPTIONS' ? 'OPT' : m}
    </span>
  );
}

export function MethodPill({ method }: { method: HttpMethod | string }) {
  return (
    <span className={clsx('inline-flex rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold', METHOD_BG[method as HttpMethod] ?? 'bg-panel-3')}>
      {method}
    </span>
  );
}
