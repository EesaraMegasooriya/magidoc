import clsx from 'clsx';
import { CheckCircle2, Copy, Globe2, Layers, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useCreateEnvironment, useDeleteEnvironment, useDuplicateEnvironment, useEnvironments } from '../../api/hooks';
import { IconButton, Menu, Spinner } from '../../components/ui';
import { confirm, prompt } from '../../store/confirm';
import { useWorkspaceStore, useWsState } from '../../store/workspace';
import { activatable } from '../../lib/a11y';
import { useWs } from './context';

export function EnvironmentsPanel() {
  const { wsId, canEdit } = useWs();
  const { data: envs, isLoading } = useEnvironments(wsId);
  const { envId, active } = useWsState(wsId);
  const { openTab, setEnv, closeTabsWhere } = useWorkspaceStore();
  const create = useCreateEnvironment(wsId);
  const dup = useDuplicateEnvironment(wsId);
  const del = useDeleteEnvironment(wsId);

  const add = async () => {
    const name = await prompt({ title: 'New environment', label: 'Environment name', placeholder: 'e.g. Staging', confirmText: 'Create' });
    if (name) create.mutate({ name, variables: [] }, { onSuccess: (e) => openTab(wsId, { kind: 'environment', id: e.id, title: e.name }) });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Environments</h2>
        {canEdit && (
          <IconButton label="New environment" onClick={add}>
            <Plus className="size-4" />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5">
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {envs?.map((e) => {
          const isActiveEnv = e.id === envId;
          return (
            <div
              key={e.id}
              onClick={() => openTab(wsId, { kind: 'environment', id: e.id, title: e.name })}
              {...activatable(() => openTab(wsId, { kind: 'environment', id: e.id, title: e.name }), `Environment ${e.name}`)}
              className={clsx(
                'group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] transition hover:bg-panel-3',
                active === `environment:${e.id}` ? 'bg-accent-soft text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {e.global ? <Globe2 className="size-3.5 text-warning" /> : <Layers className="size-3.5 text-info" />}
              <span className="flex-1 truncate">{e.name}</span>
              <span className="text-[10px] text-faint">{e.variables.length}</span>
              {!e.global && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setEnv(wsId, isActiveEnv ? null : e.id);
                  }}
                  title={isActiveEnv ? 'Active — click to deactivate' : 'Set active'}
                  className={clsx('rounded p-0.5 cursor-pointer', isActiveEnv ? 'text-success' : 'text-faint opacity-0 group-hover:opacity-100 hover:text-fg')}
                >
                  <CheckCircle2 className="size-3.5" />
                </button>
              )}
              {canEdit && !e.global && (
                <Menu
                  align="right"
                  items={[
                    { label: 'Duplicate', icon: <Copy />, onClick: () => dup.mutate(e.id) },
                    {
                      label: 'Delete',
                      icon: <Trash2 />,
                      danger: true,
                      onClick: async () => {
                        if (await confirm({ title: `Delete “${e.name}”?`, confirmText: 'Delete', danger: true }))
                          del.mutate(e.id, {
                            onSuccess: () => {
                              closeTabsWhere(wsId, (t) => t.id === e.id);
                              if (isActiveEnv) setEnv(wsId, null);
                            },
                          });
                      },
                    },
                  ]}
                  trigger={(open) => (
                    <button onClick={open} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer" aria-label="Environment actions">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="border-t border-line p-3 text-[11px] leading-relaxed text-faint">
        Use <code className="text-accent-fg">{'{{name}}'}</code> anywhere. Globals are always on; pick an environment in the top-right to override.
      </p>
    </div>
  );
}
