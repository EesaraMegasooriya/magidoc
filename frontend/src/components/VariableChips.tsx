import clsx from 'clsx';
import type { VarInfo } from '../lib/variables';
import { VAR_STATUS_CLASS } from './VariableInput';

const LABEL = { resolved: 'defined', empty: 'empty', unresolved: 'undefined' } as const;

/** Status chips for the variables a request uses; hover shows the value and where it comes from. */
export function VariableChips({ vars }: Readonly<{ vars: VarInfo[] }>) {
  if (!vars.length) return null;
  const broken = vars.filter((v) => v.status !== 'resolved').length;
  return (
    <span className="flex flex-wrap items-center gap-1.5" aria-label={`Variables: ${vars.length} used, ${broken} with problems`}>
      {vars.map((v) => {
        const detail =
          v.status === 'resolved' ? `= ${v.display}\n${v.reason}` : v.status === 'empty' ? v.reason : v.reason + (v.display ? `\nCurrent value: ${v.display}` : '');
        return (
          <span
            key={v.name}
            data-var-chip={v.name}
            data-var-status={v.status}
            title={`{{${v.name}}} — ${LABEL[v.status]}\n${detail}`}
            className={clsx('inline-flex max-w-72 items-center gap-1 rounded px-1.5 py-0.5 font-mono', VAR_STATUS_CLASS[v.status])}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <span className="truncate">{`{{${v.name}}}`}</span>
            {v.status !== 'resolved' && <span className="shrink-0 font-sans">{LABEL[v.status]}</span>}
            <span className="sr-only">{detail}</span>
          </span>
        );
      })}
    </span>
  );
}
