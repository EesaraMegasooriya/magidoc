import clsx from 'clsx';
import { History, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useClearHistory, useHistory } from '../../api/hooks';
import { MethodText } from '../../components/MethodBadge';
import { EmptyState, IconButton, Spinner } from '../../components/ui';
import { newDraft, paramsFromUrl } from '../../lib/request';
import { statusColor, timeAgo } from '../../lib/utils';
import { confirm } from '../../store/confirm';
import { useNewScratch } from './TabBar';
import { useWs } from './context';

export function HistoryPanel() {
  const { wsId } = useWs();
  const { data, isLoading } = useHistory(wsId);
  const clear = useClearHistory(wsId);
  const newScratch = useNewScratch();

  const groups = useMemo(() => {
    const out: { label: string; items: NonNullable<typeof data> }[] = [];
    for (const h of data ?? []) {
      const d = new Date(h.createdAt);
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const label = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === yesterday.toDateString() ? 'Yesterday' : d.toLocaleDateString();
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(h);
      else out.push({ label, items: [h] });
    }
    return out;
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">History</h2>
        {!!data?.length && (
          <IconButton
            label="Clear history"
            onClick={async () => {
              if (await confirm({ title: 'Clear your request history?', confirmText: 'Clear', danger: true })) clear.mutate(undefined);
            }}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !data?.length ? (
          <EmptyState icon={<History className="size-5" />} title="No history yet" description="Requests you send show up here." />
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{g.label}</p>
              {g.items.map((h) => (
                <button
                  key={h.id}
                  onClick={() => newScratch({ ...newDraft(), name: h.requestName ?? `${h.method} request`, method: h.method, url: h.url, queryParams: paramsFromUrl(h.url, []) })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-panel-3 cursor-pointer"
                  title={h.url}
                >
                  <MethodText method={h.method} className="w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-fg">{h.requestName ?? h.url}</p>
                    <p className="truncate font-mono text-[10.5px] text-faint">{h.url}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={clsx('font-mono text-[11px]', h.statusCode ? statusColor(h.statusCode) : 'text-danger')}>{h.statusCode ?? 'ERR'}</p>
                    <p className="text-[10px] text-faint">{timeAgo(h.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
