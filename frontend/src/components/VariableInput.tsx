import { useLayoutEffect, useMemo, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { tokenize, type VarMap, type VarStatus } from '../lib/variables';

export const VAR_STATUS_CLASS: Record<VarStatus, string> = {
  resolved: 'bg-success-soft text-success',
  empty: 'bg-warning-soft text-warning',
  unresolved: 'bg-danger-soft text-danger',
};

/**
 * A text input that colours {{variables}} by status (defined / empty / undefined).
 *
 * A click-through mirror layer on top of the (transparent-text) input renders the coloured tokens — on top so it
 * also works for inputs with an opaque background — while the native input keeps
 * caret, selection, IME and accessibility. The element structure never changes while typing (so focus is
 * never lost); when there are no variables the input simply shows its own text.
 *
 * `textClassName` holds the classes that place text inside the input (horizontal padding, font family/size);
 * they are applied to both layers. `mirrorClassName` offsets the mirror for bordered inputs (e.g. "inset-px").
 */
export function VariableInput({
  scope,
  className,
  textClassName,
  wrapperClassName,
  mirrorClassName,
  value,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {
  value: string;
  scope: VarMap | undefined;
  textClassName: string;
  wrapperClassName?: string;
  mirrorClassName?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);
  const tokens = useMemo(() => (scope && value.includes('{{') ? tokenize(value, scope) : null), [value, scope]);
  const highlighted = !!tokens?.some((t) => t.kind === 'var');

  const sync = () => {
    if (input.current && mirror.current) mirror.current.style.transform = `translateX(${-input.current.scrollLeft}px)`;
  };
  useLayoutEffect(sync);

  return (
    <span className={cn('relative flex min-w-0', wrapperClassName)}>
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 z-10 flex items-center overflow-hidden whitespace-pre', textClassName, mirrorClassName)}
      >
        <span ref={mirror} className="text-fg">
          {highlighted &&
            tokens!.map((t, i) =>
              t.kind === 'text' ? (
                <span key={i}>{t.text}</span>
              ) : (
                <span key={i} data-var={t.info.name} data-var-status={t.info.status} className={cn('rounded-[3px]', VAR_STATUS_CLASS[t.info.status])}>
                  {t.text}
                </span>
              ),
            )}
        </span>
      </span>
      <input
        {...rest}
        ref={input}
        value={value}
        onScroll={(e) => {
          sync();
          rest.onScroll?.(e);
        }}
        onSelect={(e) => {
          sync();
          rest.onSelect?.(e);
        }}
        onKeyUp={(e) => {
          sync();
          rest.onKeyUp?.(e);
        }}
        className={cn('relative w-full min-w-0', className, textClassName, highlighted && 'text-transparent caret-fg selection:bg-accent/25')}
      />
    </span>
  );
}
