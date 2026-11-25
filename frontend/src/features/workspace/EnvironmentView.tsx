import { CheckCircle2, Globe2, Layers, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEnvironments, useUpdateEnvironment } from '../../api/hooks';
import { Button, EmptyState, FullPageSpinner } from '../../components/ui';
import { VariableEditor } from '../../components/VariableEditor';
import { useWorkspaceStore, useWsState, type Tab } from '../../store/workspace';
import type { Variable } from '../../types';
import { useWs } from './context';

export function EnvironmentView({ tab }: { tab: Tab }) {
  const { wsId, canEdit } = useWs();
  const { data: envs, isLoading } = useEnvironments(wsId);
  const env = envs?.find((e) => e.id === tab.id);
  const update = useUpdateEnvironment(wsId);
  const activeId = useWsState(wsId).envId;
  const setEnv = useWorkspaceStore((s) => s.setEnv);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const [name, setName] = useState('');
  const [vars, setVars] = useState<Variable[]>([]);

  useEffect(() => {
    if (env) {
      setName(env.name);
      setVars(env.variables);
    }
  }, [env]);

  if (isLoading) return <FullPageSpinner />;
  if (!env) return <EmptyState title="Environment not found" description="It may have been deleted." />;

  const dirty = name !== env.name || JSON.stringify(vars) !== JSON.stringify(env.variables);
  const save = () =>
    update.mutate(
      { id: env.id, name: env.global ? undefined : name.trim(), variables: vars.filter((v) => v.key.trim()) },
      { onSuccess: (e) => renameTab(wsId, tab.key, e.name) },
    );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex size-11 items-center justify-center rounded-xl ${env.global ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'}`}>
            {env.global ? <Globe2 className="size-5" /> : <Layers className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            {env.global ? (
              <h2 className="text-xl font-bold">Globals</h2>
            ) : (
              <input value={name} readOnly={!canEdit} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-xl font-bold focus:outline-none" aria-label="Environment name" />
            )}
            <p className="text-xs text-muted">
              {env.global ? 'Always available in this workspace — lowest precedence.' : 'Overrides globals and collection variables while active.'}
            </p>
          </div>
          {!env.global &&
            (activeId === env.id ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" /> Active
              </span>
            ) : (
              <Button onClick={() => setEnv(wsId, env.id)}>Set active</Button>
            ))}
          {canEdit && (
            <Button variant="primary" icon={<Save className="size-4" />} disabled={!dirty || (!env.global && !name.trim())} loading={update.isPending} onClick={save}>
              Save
            </Button>
          )}
        </div>
        <div className="mt-6">
          <VariableEditor rows={vars} onChange={setVars} readOnly={!canEdit} />
        </div>
        <p className="mt-4 text-xs text-faint">
          Precedence: Globals → Collection variables → Active environment. Reference values with <code className="text-accent-fg">{'{{name}}'}</code> in URLs, headers, bodies and auth.
        </p>
      </div>
    </div>
  );
}
