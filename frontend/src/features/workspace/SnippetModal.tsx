import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { CodeView, CopyButton } from '../../components/CodeView';
import { Modal } from '../../components/ui';
import { generateSnippet, SNIPPET_LANGS, type SnippetLang } from '../../lib/codegen';
import type { BuiltRequest } from '../../lib/request';

export function SnippetModal({ built, onClose }: { built: BuiltRequest; onClose: () => void }) {
  const [lang, setLang] = useState<SnippetLang>('curl');
  const code = useMemo(() => generateSnippet(lang, built), [lang, built]);
  return (
    <Modal open onClose={onClose} title="Code snippet" description="Generated with your current variables resolved." width="max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {SNIPPET_LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className={clsx('rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer', lang === l.id ? 'bg-panel-3 text-fg border border-line-strong' : 'text-muted hover:text-fg')}
          >
            {l.label}
          </button>
        ))}
        <CopyButton text={code} className="ml-auto" />
      </div>
      <CodeView code={code} lineNumbers={false} className="max-h-[60vh]" />
    </Modal>
  );
}
