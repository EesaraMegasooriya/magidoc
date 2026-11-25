import clsx from 'clsx';
import { Check, Copy } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { copyText } from '../lib/utils';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Tiny, dependency-free JSON highlighter (input is escaped before tagging). */
export function highlightJson(src: string): string {
  return escapeHtml(src).replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'j-num';
      if (m.startsWith('"')) cls = m.trimEnd().endsWith(':') ? 'j-key' : 'j-str';
      else if (m === 'true' || m === 'false') cls = 'j-bool';
      else if (m === 'null') cls = 'j-null';
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

export function tryPrettyJson(s: string): string | null {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

export function CopyButton({ text, className, label = 'Copy' }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label || 'Copy'}
      onClick={async () => {
        await copyText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={clsx('inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-panel-3 hover:text-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50', className)}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function CodeView({
  code,
  language,
  className,
  lineNumbers = true,
  toolbar,
}: {
  code: string;
  language?: 'json' | 'text';
  className?: string;
  lineNumbers?: boolean;
  toolbar?: ReactNode;
}) {
  const html = useMemo(() => (language === 'json' ? highlightJson(code) : escapeHtml(code)), [code, language]);
  const lines = useMemo(() => code.split('\n').length, [code]);
  return (
    <div className={clsx('relative rounded-lg border border-line code-surface', className)}>
      {toolbar && <div className="absolute right-2 top-2 z-10 flex gap-1">{toolbar}</div>}
      <div className="flex overflow-auto code-area h-full">
        {lineNumbers && (
          <pre className="sticky left-0 select-none border-r border-line bg-bg px-3 py-3 text-right text-faint">
            {Array.from({ length: Math.min(lines, 20000) }, (_, i) => i + 1).join('\n')}
          </pre>
        )}
        <pre className="flex-1 whitespace-pre px-4 py-3 text-fg" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
