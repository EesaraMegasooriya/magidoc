import clsx from 'clsx';
import { Wand2 } from 'lucide-react';
import { useMemo } from 'react';
import { KeyValueEditor } from '../../components/KeyValueEditor';
import { Button } from '../../components/ui';
import type { VarMap } from '../../lib/variables';
import type { BodyMode, RequestBody } from '../../types';

const MODES: { value: BodyMode; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'form-data', label: 'form-data' },
];

export function CodeTextarea({
  value,
  onChange,
  readOnly,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Tab' && !readOnly) {
          e.preventDefault();
          const el = e.currentTarget;
          const { selectionStart: s, selectionEnd: end } = el;
          const next = value.slice(0, s) + '  ' + value.slice(end);
          onChange(next);
          requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
        }
      }}
      className={clsx(
        'code-area w-full resize-none rounded-lg bg-bg p-3 text-fg border border-line placeholder:text-faint focus:outline-none focus:ring-accent/40',
        className,
      )}
    />
  );
}

export function BodyEditor({ body, onChange, readOnly, disabledReason, scope }: { body: RequestBody; onChange: (b: RequestBody) => void; readOnly?: boolean; disabledReason?: string; scope?: VarMap }) {
  const jsonError = useMemo(() => {
    if (body.mode !== 'json' || !body.raw.trim()) return null;
    // Allow {{variables}} inside JSON by substituting a placeholder before validating.
    const probe = body.raw.replace(/"?\{\{[^}]+\}\}"?/g, '"__var__"');
    try {
      JSON.parse(probe);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON';
    }
  }, [body.mode, body.raw]);

  const beautify = () => {
    try {
      onChange({ ...body, raw: JSON.stringify(JSON.parse(body.raw), null, 2) });
    } catch {
      /* ignore: invalid JSON or contains variables */
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {MODES.map((m) => (
          <label key={m.value} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input
              type="radio"
              className="accent-accent"
              checked={body.mode === m.value}
              disabled={readOnly}
              onChange={() => onChange({ ...body, mode: m.value })}
            />
            <span className={clsx(body.mode === m.value && 'text-fg')}>{m.label}</span>
          </label>
        ))}
        {body.mode === 'json' && !readOnly && (
          <Button size="sm" variant="ghost" icon={<Wand2 className="size-3.5" />} onClick={beautify} className="ml-auto">
            Beautify
          </Button>
        )}
      </div>
      {disabledReason && body.mode !== 'none' && <p className="text-xs text-warning">{disabledReason}</p>}
      {body.mode === 'none' && <p className="py-8 text-center text-sm text-faint">This request does not have a body.</p>}
      {(body.mode === 'urlencoded' || body.mode === 'form-data') && (
        <KeyValueEditor rows={body.fields} readOnly={readOnly} scope={scope} onChange={(fields) => onChange({ ...body, fields })} />
      )}
      {['json', 'text', 'xml', 'html'].includes(body.mode) && (
        <>
          <CodeTextarea
            value={body.raw}
            readOnly={readOnly}
            onChange={(raw) => onChange({ ...body, raw })}
            placeholder={body.mode === 'json' ? '{\n  "key": "{{value}}"\n}' : ''}
            className="min-h-40 flex-1"
          />
          {jsonError && <p className="font-mono text-xs text-danger">⚠ {jsonError}</p>}
        </>
      )}
    </div>
  );
}
