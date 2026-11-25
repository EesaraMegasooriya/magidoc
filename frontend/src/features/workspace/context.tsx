import { createContext, useContext, useMemo } from 'react';
import { useEnvironments } from '../../api/hooks';
import { buildScope, type VarMap } from '../../lib/variables';
import { useWorkspaceStore, useWsState } from '../../store/workspace';
import { atLeast, type CollectionDetail, type Role, type Workspace } from '../../types';

interface Ctx {
  wsId: string;
  workspace: Workspace;
  role: Role;
  canEdit: boolean;
  canAdmin: boolean;
}

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const value = useMemo<Ctx>(
    () => ({
      wsId: workspace.id,
      workspace,
      role: workspace.role,
      canEdit: atLeast(workspace.role, 'EDITOR'),
      canAdmin: atLeast(workspace.role, 'ADMIN'),
    }),
    [workspace],
  );
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWs(): Ctx {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWs must be used inside WorkspaceProvider');
  return ctx;
}

/** Variable scope for a request: globals < collection < active environment. */
export function useScope(collection?: CollectionDetail): VarMap {
  const { wsId } = useWs();
  const { data: envs } = useEnvironments(wsId);
  const envId = useWsState(wsId).envId;
  return useMemo(() => {
    const globals = envs?.find((e) => e.global);
    const active = envs?.find((e) => e.id === envId && !e.global);
    return buildScope([
      { source: 'Globals', vars: globals?.variables },
      { source: collection ? `Collection · ${collection.collection.name}` : 'Collection', vars: collection?.collection.variables },
      { source: active ? `Environment · ${active.name}` : 'Environment', vars: active?.variables },
    ]);
  }, [envs, envId, collection]);
}

export function useOpenTab() {
  const { wsId } = useWs();
  return useWorkspaceStore((s) => s.openTab).bind(null, wsId);
}
