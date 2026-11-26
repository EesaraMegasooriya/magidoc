import clsx from 'clsx';
import { Copy, MoreHorizontal, Plug, Plus, Trash2 } from 'lucide-react';
import { useCreateWebSocket, useDeleteWebSocket, useDuplicateWebSocket, useWebSockets } from '../../api/hooks';
import { EmptyState, IconButton, Menu, Spinner } from '../../components/ui';
import { confirm, prompt } from '../../store/confirm';
import { useWsStore } from '../../store/websocket';
import { useWorkspaceStore, useWsState } from '../../store/workspace';
import { activatable } from '../../lib/a11y';
import { useWs } from './context';

export function WebSocketsPanel() {
  const { wsId, canEdit } = useWs();
  const { data: list, isLoading } = useWebSockets(wsId);
  const { active } = useWsState(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const closeTabsWhere = useWorkspaceStore((s) => s.closeTabsWhere);
  const conns = useWsStore((s) => s.conns);
  const forget = useWsStore((s) => s.forget);
  const create = useCreateWebSocket(wsId);
  const dup = useDuplicateWebSocket(wsId);
  const del = useDeleteWebSocket(wsId);

  const add = async () => {
    const name = await prompt({ title: 'New WebSocket connection', label: 'Name', placeholder: 'e.g. Live prices', confirmText: 'Create' });
    if (name) {
      create.mutate(
        { name, url: 'wss://echo.websocket.org' },
        { onSuccess: (w) => openTab(wsId, { kind: 'websocket', id: w.id, title: w.name }) },
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">WebSockets</h2>
        {canEdit && (
          <IconButton label="New WebSocket connection" onClick={add}>
            <Plus />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-4">
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {!isLoading && !list?.length && (
          <EmptyState
            compact
            icon={<Plug />}
            title="No WebSocket connections"
            description="Save connections to test real-time APIs: connect, send messages and inspect replies."
            action={canEdit && <button type="button" onClick={add} className="text-[13px] font-medium text-accent-fg hover:underline cursor-pointer">Create a connection</button>}
          />
        )}
        {list?.map((w) => {
          const status = conns[w.id]?.status;
          const live = status === 'open';
          return (
            <div
              key={w.id}
              onClick={() => openTab(wsId, { kind: 'websocket', id: w.id, title: w.name })}
              {...activatable(() => openTab(wsId, { kind: 'websocket', id: w.id, title: w.name }), `WebSocket ${w.name}`)}
              className={clsx(
                'group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] transition-colors hover:bg-panel-3',
                active === `websocket:${w.id}` ? 'bg-accent-soft text-fg' : 'text-muted hover:text-fg',
              )}
              title={w.url}
            >
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <Plug className="size-3.5 text-m-patch" />
                {status && status !== 'idle' && (
                  <span
                    className={clsx('absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-panel', live ? 'bg-success' : status === 'error' ? 'bg-danger' : status === 'connecting' ? 'bg-warning' : 'bg-faint')}
                    aria-label={live ? 'Connected' : status}
                  />
                )}
              </span>
              <span className="flex-1 truncate">{w.name}</span>
              {canEdit && (
                <Menu
                  align="right"
                  items={[
                    { label: 'Duplicate', icon: <Copy />, onClick: () => dup.mutate(w.id) },
                    {
                      label: 'Delete',
                      icon: <Trash2 />,
                      danger: true,
                      onClick: async () => {
                        if (await confirm({ title: `Delete “${w.name}”?`, message: 'Saved messages for this connection are deleted too.', confirmText: 'Delete', danger: true }))
                          del.mutate(w.id, {
                            onSuccess: () => {
                              forget(w.id);
                              closeTabsWhere(wsId, (t) => t.id === w.id);
                            },
                          });
                      },
                    },
                  ]}
                  trigger={(open) => (
                    <button type="button" onClick={open} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer" aria-label="Connection actions">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
