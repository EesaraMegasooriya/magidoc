import clsx from 'clsx';
import { BookOpen, Box, Globe2, Layers, NotebookPen, Plug, Plus, Settings, X } from 'lucide-react';
import { useEnvironments } from '../../api/hooks';
import { MethodText } from '../../components/MethodBadge';
import { newDraft, sameDraft, toDraft } from '../../lib/request';
import { uid } from '../../lib/utils';
import { confirm } from '../../store/confirm';
import { useWsStore } from '../../store/websocket';
import { draftChanged, useSnippetStore } from '../../store/snippets';
import { useWorkspaceStore, useWsState, type Tab } from '../../store/workspace';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { keys, normalizeDetail } from '../../api/hooks';
import { api } from '../../lib/api';
import type { CollectionDetail, Snippet, WebSocketConnection } from '../../types';
import { useWs } from './context';

export function useNewScratch() {
  const { wsId } = useWs();
  const openTab = useWorkspaceStore((s) => s.openTab);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  return (draft = newDraft()) => {
    const id = `scratch-${uid()}`;
    setDraft(id, draft);
    openTab(wsId, { kind: 'scratch', id, title: draft.name });
  };
}

export function TabBar() {
  const { wsId } = useWs();
  const { tabs, active, envId } = useWsState(wsId);
  const { setActive, closeTab, setEnv } = useWorkspaceStore();
  const drafts = useWorkspaceStore((s) => s.drafts);
  const { data: envs } = useEnvironments(wsId);
  const newScratch = useNewScratch();
  const qc = useQueryClient();
  // Keep the collections behind open request tabs loaded so tab metadata (method, dirty state) is accurate after reloads.
  const collectionIds = [...new Set(tabs.filter((t) => t.kind === 'request' && t.collectionId).map((t) => t.collectionId!))];
  useQueries({
    queries: collectionIds.map((id) => ({
      queryKey: keys.collection(id),
      queryFn: () => api.get<CollectionDetail>(`/collections/${id}`).then((r) => normalizeDetail(r.data)),
      staleTime: 30_000,
    })),
  });

  const wsDrafts = useWsStore((s) => s.drafts);
  const wsConns = useWsStore((s) => s.conns);
  const forgetWs = useWsStore((s) => s.forget);

  const snippetDrafts = useSnippetStore((s) => s.drafts);
  const clearSnippetDraft = useSnippetStore((s) => s.clearDraft);

  const isDirty = (t: Tab) => {
    if (t.kind === 'snippet') {
      const d = snippetDrafts[t.id];
      const saved = qc.getQueryData<Snippet>(keys.snippet(t.id));
      return !!d && !!saved && draftChanged(d, saved);
    }
    if (t.kind === 'websocket') {
      const d = wsDrafts[t.id];
      const saved = qc.getQueryData<WebSocketConnection[]>(keys.websockets(wsId))?.find((w) => w.id === t.id);
      return !!d && !!saved && JSON.stringify(d) !== JSON.stringify({ name: saved.name, url: saved.url, protocols: saved.protocols.join(', '), messages: saved.messages });
    }
    const d = drafts[t.id];
    if (!d) return false;
    if (t.kind === 'scratch') return !!(d.url.trim() || d.body.raw.trim() || d.headers.length);
    if (t.kind !== 'request' || !t.collectionId) return false;
    const col = qc.getQueryData<CollectionDetail>(keys.collection(t.collectionId));
    const base = col?.requests.find((r) => r.id === t.id);
    return base ? !sameDraft(d, toDraft(base)) : false;
  };

  const close = async (t: Tab) => {
    if (isDirty(t)) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: `“${t.title}” has changes that haven't been saved.`,
        confirmText: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    if (t.kind === 'websocket') forgetWs(t.id); // closing the tab disconnects the socket
    if (t.kind === 'snippet') clearSnippetDraft(t.id);
    closeTab(wsId, t.key);
  };

  const icon = (t: Tab) => {
    switch (t.kind) {
      case 'request':
      case 'scratch': {
        const method = drafts[t.id]?.method ?? (t.collectionId ? qc.getQueryData<CollectionDetail>(keys.collection(t.collectionId))?.requests.find((r) => r.id === t.id)?.method : undefined);
        return <MethodText method={method ?? 'GET'} className="w-7 text-left" />;
      }
      case 'collection':
        return <Box className="size-3.5 text-accent-fg" />;
      case 'environment':
        return <Layers className="size-3.5 text-info" />;
      case 'settings':
        return <Settings className="size-3.5 text-muted" />;
      case 'docs':
        return <BookOpen className="size-3.5 text-accent-fg" />;
      case 'snippet':
        return <NotebookPen className="size-3.5 text-warning" />;
      case 'websocket':
        return (
          <span className="relative">
            <Plug className="size-3.5 text-m-patch" />
            {wsConns[t.id]?.status === 'open' && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-success" aria-label="Connected" />}
          </span>
        );
    }
  };

  const nonGlobal = (envs ?? []).filter((e) => !e.global);

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-line bg-panel">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setActive(wsId, t.key)}
            onAuxClick={(e) => e.button === 1 && close(t)}
            className={clsx(
              'group relative flex max-w-56 shrink-0 cursor-pointer items-center gap-2 border-r border-line pl-3 pr-1.5 text-[13px] transition',
              active === t.key ? 'bg-bg text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg',
            )}
            title={t.title}
          >
            {active === t.key && <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
            {icon(t)}
            <span className={clsx('truncate', t.kind === 'scratch' && 'italic')}>{t.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                close(t);
              }}
              className="relative flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-panel-3 hover:text-fg cursor-pointer"
              aria-label={`Close ${t.title}`}
            >
              {isDirty(t) ? (
                <>
                  <span className="size-2 rounded-full bg-accent group-hover:hidden" />
                  <X className="hidden size-3.5 group-hover:block" />
                </>
              ) : (
                <X className="size-3.5 opacity-0 group-hover:opacity-100" />
              )}
            </button>
          </div>
        ))}
        <button onClick={() => newScratch()} className="flex w-9 shrink-0 items-center justify-center text-muted hover:text-fg cursor-pointer" title="New request" aria-label="New request">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-l border-line px-3">
        <Globe2 className="size-3.5 text-faint" />
        <select
          value={envId ?? ''}
          onChange={(e) => setEnv(wsId, e.target.value || null)}
          className="h-7 max-w-44 cursor-pointer rounded-md bg-panel-2 px-2 text-xs text-fg border border-line focus:outline-none focus:ring-accent/40"
          aria-label="Active environment"
        >
          <option value="">No environment</option>
          {nonGlobal.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
