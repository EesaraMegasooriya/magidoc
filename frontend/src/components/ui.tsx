import { cn as clsx } from '../lib/cn';
import { Loader2, Search, X } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ Buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&_svg]:shrink-0',
        size === 'sm' && 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        size === 'md' && 'h-8.5 px-3 text-[13px] [&_svg]:size-4',
        size === 'lg' && 'h-10 px-4 text-sm [&_svg]:size-4',
        variant === 'primary' && 'bg-accent text-on-accent shadow-sm hover:bg-accent-strong',
        variant === 'secondary' && 'border border-line-strong bg-panel text-fg shadow-xs hover:bg-panel-2',
        variant === 'ghost' && 'text-muted hover:bg-panel-3 hover:text-fg',
        variant === 'danger' && 'border border-danger/30 bg-danger-soft text-danger hover:border-danger/50',
        variant === 'danger-solid' && 'bg-danger text-white shadow-sm hover:opacity-90',
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  label,
  children,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-3 hover:text-fg cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'size-6 [&_svg]:size-3.5' : 'size-8 [&_svg]:size-4',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Inputs */

const fieldCls =
  'w-full rounded-lg border border-line-strong bg-panel px-3 text-[13px] text-fg shadow-xs placeholder:text-faint transition-colors ' +
  'hover:border-faint/60 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 ' +
  'read-only:bg-panel-2 read-only:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={clsx(fieldCls, 'h-8.5', className)} />;
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
      <input {...rest} type="search" className={clsx(fieldCls, 'h-8 pl-8')} />
    </div>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={clsx(fieldCls, 'py-2 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx(fieldCls, 'h-8.5 cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

/**
 * Label + control + hint/error. The label is linked via htmlFor/id and the hint/error via aria-describedby,
 * so assistive tech announces "Password" (not "Password Forgot password?") plus the description.
 * Pass `htmlFor` when the control isn't the direct child (the caller then sets id/aria-describedby itself;
 * the description id is `${htmlFor}-desc`).
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const descId = `${id}-desc`;
  const hasDesc = !!error || !!hint;
  let control = children;
  if (!htmlFor && isValidElement<Record<string, unknown>>(children)) {
    control = cloneElement(children, {
      id: (children.props.id as string | undefined) ?? id,
      'aria-describedby': hasDesc ? descId : undefined,
      'aria-invalid': error ? true : children.props['aria-invalid'],
    });
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-fg">
        {label}
      </label>
      {control}
      {error ? (
        <span id={descId} role="alert" className="block text-xs text-danger">{error}</span>
      ) : (
        hint && <span id={descId} className="block text-xs text-faint">{hint}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog unless a child already took it (autoFocus).
    requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        className={clsx('w-full rounded-xl border border-line bg-panel shadow-2xl outline-none', width)}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
            <X />
          </IconButton>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-panel-2/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------- Display atoms */

export function Avatar({ name, color, size = 28 }: { name: string; color?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: color ?? '#7c5cff' }}
      title={name}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-panel-3 text-muted',
  accent: 'bg-accent-soft text-accent-fg',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4', TONES[tone], className)}>
      {children}
    </span>
  );
}

const ROLE_TONE: Record<string, Tone> = { OWNER: 'accent', ADMIN: 'info', EDITOR: 'success', VIEWER: 'neutral', MEMBER: 'neutral' };

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? 'neutral'}>{role.charAt(0) + role.slice(1).toLowerCase()}</Badge>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-panel px-1 font-sans text-[10.5px] font-medium text-muted shadow-xs">
      {children}
    </kbd>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-accent', className)} aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={clsx('rounded-xl border border-line bg-panel shadow-xs', padded && 'p-5', className)}>{children}</section>;
}

export function SectionHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, compact }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}>
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-line bg-panel text-muted shadow-xs [&_svg]:size-5">{icon}</div>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Tabs-ish */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  variant = 'underline',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  variant?: 'underline' | 'pill';
}) {
  if (variant === 'pill') {
    return (
      <div className={clsx('inline-flex items-center rounded-lg bg-panel-3 p-0.5', className)} role="tablist">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              'h-6.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              value === o.value ? 'bg-panel text-fg shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={clsx('flex items-center gap-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative inline-flex h-9 items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 rounded-md',
            value === o.value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
          {!!o.count && (
            <span className={clsx('rounded px-1 text-[10.5px] tabular-nums', value === o.value ? 'bg-accent-soft text-accent-fg' : 'bg-panel-3 text-muted')}>{o.count}</span>
          )}
          {value === o.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- Menu */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** Dropdown menu rendered in a portal (never clipped). Supports keyboard navigation. */
export function Menu({ trigger, items, align = 'left', width = 210 }: { trigger: (open: () => void) => ReactNode; items: (MenuItem | 'divider')[]; align?: 'left' | 'right'; width?: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const open = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const x = align === 'right' ? r.right - width : r.left;
    const estimatedHeight = items.reduce((h, i) => h + (i === 'divider' ? 9 : 32), 8);
    const y = r.bottom + 4 + estimatedHeight > window.innerHeight ? Math.max(8, r.top - 4 - estimatedHeight) : r.bottom + 4;
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y });
  };

  return (
    <>
      <span ref={anchor} className="inline-flex" onClick={(e) => e.stopPropagation()}>
        {trigger(open)}
      </span>
      {pos &&
        createPortal(
          <div
            ref={list}
            role="menu"
            className="fixed z-[60] rounded-lg border border-line bg-panel p-1 shadow-xl"
            style={{ left: pos.x, top: pos.y, width }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {items.map((item, i) =>
              item === 'divider' ? (
                <div key={i} className="my-1 h-px bg-line" role="separator" />
              ) : (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPos(null);
                    item.onClick();
                  }}
                  className={clsx(
                    'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                    item.danger ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft' : 'text-fg hover:bg-panel-3 focus:bg-panel-3',
                  )}
                >
                  {item.icon && <span className={clsx('[&>svg]:size-4', item.danger ? 'text-danger' : 'text-muted')}>{item.icon}</span>}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-[11px] text-faint">{item.hint}</span>}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span className={clsx('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  );
}
