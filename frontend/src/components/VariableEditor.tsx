import clsx from 'clsx';
import { Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Variable } from '../types';
import { uid } from '../lib/utils';

export function VariableEditor({
  rows,
  onChange,
  readOnly,
}: {
  rows: Variable[];
  onChange: (rows: Variable[]) => void;
  readOnly?: boolean;
}) {
  const pendingId = useRef(uid());
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const display: Variable[] = readOnly ? rows : [...rows, { id: pendingId.current, key: '', value: '', enabled: true, secret: false }];

  const update = (id: string, patch: Partial<Variable>) => {
    if (id === pendingId.current && !rows.some((r) => r.id === id)) {
      onChange([...rows, { id, key: '', value: '', enabled: true, secret: false, ...patch }]);
      pendingId.current = uid();
    } else {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
  };

  const cell = 'h-9 w-full bg-transparent px-3 font-mono text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:bg-accent-soft';

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-panel-2 text-left text-[11px] font-medium text-muted">
            <th className="w-9" />
            <th className="border-l border-line px-3 py-1.5 font-medium">Variable</th>
            <th className="border-l border-line px-3 py-1.5 font-medium">Value</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {display.map((row) => {
            const isNew = !readOnly && row.id === pendingId.current;
            const hidden = row.secret && !revealed[row.id];
            return (
              <tr key={row.id} className="group border-t border-line">
                <td className="text-center">
                  {!isNew && (
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={readOnly}
                      onChange={(e) => update(row.id, { enabled: e.target.checked })}
                      className="size-3.5 cursor-pointer accent-accent"
                    />
                  )}
                </td>
                <td className="border-l border-line">
                  <input className={cell} value={row.key} placeholder="Add variable" readOnly={readOnly} onChange={(e) => update(row.id, { key: e.target.value })} />
                </td>
                <td className="border-l border-line">
                  <input
                    className={cell}
                    type={hidden ? 'password' : 'text'}
                    value={row.value}
                    placeholder="Value"
                    readOnly={readOnly}
                    autoComplete="off"
                    onChange={(e) => update(row.id, { value: e.target.value })}
                  />
                </td>
                <td>
                  {!isNew && (
                    <div className="flex items-center justify-end gap-0.5 pr-1.5">
                      {row.secret && (
                        <button className="rounded p-1 text-faint hover:text-fg cursor-pointer" onClick={() => setRevealed((r) => ({ ...r, [row.id]: !r[row.id] }))} title={hidden ? 'Reveal' : 'Hide'}>
                          {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </button>
                      )}
                      {!readOnly && (
                        <>
                          <button
                            className={clsx('rounded p-1 cursor-pointer', row.secret ? 'text-warning' : 'text-faint hover:text-fg')}
                            onClick={() => update(row.id, { secret: !row.secret })}
                            title={row.secret ? 'Secret (masked in shared docs)' : 'Mark as secret'}
                          >
                            {row.secret ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                          </button>
                          <button className="rounded p-1 text-faint opacity-0 hover:text-danger group-hover:opacity-100 cursor-pointer" onClick={() => onChange(rows.filter((r) => r.id !== row.id))} title="Remove">
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
