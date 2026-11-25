import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExecuteResponse, RequestDraft } from '../types';

export type TabKind = 'request' | 'scratch' | 'collection' | 'environment' | 'settings' | 'docs' | 'websocket' | 'snippet';

export interface Tab {
  key: string;
  kind: TabKind;
  id: string;
  collectionId?: string;
  title: string;
}

export interface WsState {
  tabs: Tab[];
  active: string | null;
  envId: string | null;
}

export interface ResponseState {
  loading: boolean;
  response?: ExecuteResponse;
}

const EMPTY_WS: WsState = { tabs: [], active: null, envId: null };

interface Store {
  byWs: Record<string, WsState>;
  drafts: Record<string, RequestDraft>;
  responses: Record<string, ResponseState>;
  openTab: (wsId: string, tab: Omit<Tab, 'key'>) => void;
  closeTab: (wsId: string, key: string) => void;
  closeTabsWhere: (wsId: string, predicate: (t: Tab) => boolean) => void;
  setActive: (wsId: string, key: string) => void;
  renameTab: (wsId: string, key: string, title: string) => void;
  setEnv: (wsId: string, envId: string | null) => void;
  setDraft: (id: string, draft: RequestDraft) => void;
  clearDraft: (id: string) => void;
  setResponse: (id: string, state: ResponseState) => void;
}

export const tabKey = (kind: TabKind, id: string) => `${kind}:${id}`;

const ws = (s: Store, wsId: string) => s.byWs[wsId] ?? EMPTY_WS;

export const useWorkspaceStore = create<Store>()(
  persist(
    (set) => ({
      byWs: {},
      drafts: {},
      responses: {},
      openTab: (wsId, tab) =>
        set((s) => {
          const cur = ws(s, wsId);
          const key = tabKey(tab.kind, tab.id);
          const exists = cur.tabs.some((t) => t.key === key);
          const tabs = exists
            ? cur.tabs.map((t) => (t.key === key ? { ...t, title: tab.title } : t))
            : [...cur.tabs, { ...tab, key }];
          return { byWs: { ...s.byWs, [wsId]: { ...cur, tabs, active: key } } };
        }),
      closeTab: (wsId, key) =>
        set((s) => {
          const cur = ws(s, wsId);
          const idx = cur.tabs.findIndex((t) => t.key === key);
          const tabs = cur.tabs.filter((t) => t.key !== key);
          let active = cur.active;
          if (active === key) active = tabs[Math.min(idx, tabs.length - 1)]?.key ?? null;
          const closing = cur.tabs[idx];
          const drafts = { ...s.drafts };
          if (closing) delete drafts[closing.id];
          return { byWs: { ...s.byWs, [wsId]: { ...cur, tabs, active } }, drafts };
        }),
      closeTabsWhere: (wsId, predicate) =>
        set((s) => {
          const cur = ws(s, wsId);
          const tabs = cur.tabs.filter((t) => !predicate(t));
          const active = tabs.some((t) => t.key === cur.active) ? cur.active : (tabs[tabs.length - 1]?.key ?? null);
          return { byWs: { ...s.byWs, [wsId]: { ...cur, tabs, active } } };
        }),
      setActive: (wsId, key) => set((s) => ({ byWs: { ...s.byWs, [wsId]: { ...ws(s, wsId), active: key } } })),
      renameTab: (wsId, key, title) =>
        set((s) => {
          const cur = ws(s, wsId);
          return {
            byWs: { ...s.byWs, [wsId]: { ...cur, tabs: cur.tabs.map((t) => (t.key === key ? { ...t, title } : t)) } },
          };
        }),
      setEnv: (wsId, envId) => set((s) => ({ byWs: { ...s.byWs, [wsId]: { ...ws(s, wsId), envId } } })),
      setDraft: (id, draft) => set((s) => ({ drafts: { ...s.drafts, [id]: draft } })),
      clearDraft: (id) =>
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[id];
          return { drafts };
        }),
      setResponse: (id, state) => set((s) => ({ responses: { ...s.responses, [id]: state } })),
    }),
    {
      name: 'magidoc-workspace',
      partialize: (s) => ({ byWs: s.byWs, drafts: s.drafts }),
    },
  ),
);

export const useWsState = (wsId: string) => useWorkspaceStore((s) => s.byWs[wsId] ?? EMPTY_WS);
