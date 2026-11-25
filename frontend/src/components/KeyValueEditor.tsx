import { Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { KeyValue } from '../types';
import { uid } from '../lib/utils';

/**
 * Spreadsheet-like editor. A blank trailing row is always shown; typing into it appends a new row.
 */
export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  readOnly,
  showDescription = true,
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  readOnly?: boolean;
  showDescription?: boolean;
}) {
  // The trailing blank row keeps a stable id that becomes the real row's id once the user types,
  // so React keeps the same input mounted and focus is not lost.
  const pendingId = useRef(uid());
  const display: KeyValue[] = readOnly
    ? rows
    : [...rows, { id: pendingId.current, key: '', value: '', enabled: true }];

  const update = (id: string, patch: Partial<KeyValue>) => {
    if (id === pendingId.current && !rows.some((r) => r.id === id)) {
      onChange([...rows, { id, key: '', value: '', enabled: true, ...patch }]);
      pendingId.current = uid();
    } else {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
  };

  const cell =
    'h-8 w-full bg-transparent px-2.5 font-mono text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:bg-accent-soft';

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-panel-2 text-left text-[11px] font-medium text-muted">
            <th className="w-9" />
            <th className="border-l border-line px-2.5 py-1.5 font-medium">{keyPlaceholder}</th>
            <th className="border-l border-line px-2.5 py-1.5 font-medium">{valuePlaceholder}</th>
            {showDescription && <th className="hidden border-l border-line px-2.5 py-1.5 font-medium md:table-cell">Description</th>}
            <th className="w-9" />
          </tr>
        </thead>
        <tbody>
          {display.map((row) => {
            const isNew = !readOnly && row.id === pendingId.current;
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
                  <input
                    className={cell}
                    value={row.key}
                    placeholder={keyPlaceholder}
                    readOnly={readOnly}
                    onChange={(e) => update(row.id, { key: e.target.value })}
                  />
                </td>
                <td className="border-l border-line">
                  <input
                    className={cell}
                    value={row.value}
                    placeholder={valuePlaceholder}
                    readOnly={readOnly}
                    onChange={(e) => update(row.id, { value: e.target.value })}
                  />
                </td>
                {showDescription && (
                  <td className="hidden border-l border-line md:table-cell">
                    <input
                      className={`${cell} font-sans`}
                      value={row.description ?? ''}
                      placeholder="Description"
                      readOnly={readOnly}
                      onChange={(e) => update(row.id, { description: e.target.value })}
                    />
                  </td>
                )}
                <td className="text-center">
                  {!isNew && !readOnly && (
                    <button
                      onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                      className="rounded p-1 text-faint opacity-0 transition hover:text-danger group-hover:opacity-100 cursor-pointer"
                      aria-label="Remove row"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
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
