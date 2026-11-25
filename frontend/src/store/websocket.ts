import { create } from 'zustand';
import { uid } from '../lib/utils';
import type { WsMessageFormat, WsSavedMessage } from '../types';

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';

export interface WsLogEntry {
  id: string;
  dir: 'out' | 'in' | 'system';
  data: string;
  size: number;
  at: number;
  binary?: boolean;
  level?: 'info' | 'error';
}

export interface WsConnState {
  status: WsStatus;
  log: WsLogEntry[];
  protocol?: string;
  openedAt?: number;
}

/** Unsaved edits of a saved connection, kept in memory so switching tabs doesn't lose them. */
export interface WsDraft {
  name: string;
  url: string;
  protocols: string;
  messages: WsSavedMessage[];
}

export interface WsComposer {
  body: string;
  format: WsMessageFormat;
}

const MAX_LOG = 1000;
const IDLE: WsConnState = { status: 'idle', log: [] };
const EMPTY_COMPOSER: WsComposer = { body: '', format: 'text' };

/** Live sockets live outside React state: they're not serialisable and must survive re-renders. */
const sockets = new Map<string, WebSocket>();

const CLOSE_REASONS: Record<number, string> = {
  1000: 'normal closure',
  1001: 'server going away',
  1002: 'protocol error',
  1003: 'unsupported data',
  1006: 'abnormal closure — the server is unreachable, rejected the handshake, or TLS failed',
  1007: 'invalid message data',
  1008: 'policy violation',
  1009: 'message too big',
  1011: 'server error',
  1015: 'TLS handshake failed',
};

const byteLength = (s: string) => new TextEncoder().encode(s).length;

function describeBinary(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const preview = Array.from(bytes.slice(0, 48), (b) => b.toString(16).padStart(2, '0')).join(' ');
  return `Binary message · ${bytes.length} bytes${preview ? `\n${preview}${bytes.length > 48 ? ' …' : ''}` : ''}`;
}

interface WsStore {
  conns: Record<string, WsConnState>;
  drafts: Record<string, WsDraft>;
  composers: Record<string, WsComposer>;
  connect: (id: string, url: string, protocols: string[]) => void;
  disconnect: (id: string) => void;
  send: (id: string, data: string) => boolean;
  clearLog: (id: string) => void;
  setDraft: (id: string, draft: WsDraft) => void;
  clearDraft: (id: string) => void;
  setComposer: (id: string, composer: WsComposer) => void;
  forget: (id: string) => void;
}

export const useWsStore = create<WsStore>((set, get) => {
  const patch = (id: string, fn: (c: WsConnState) => WsConnState) =>
    set((s) => ({ conns: { ...s.conns, [id]: fn(s.conns[id] ?? IDLE) } }));

  const log = (id: string, entry: Omit<WsLogEntry, 'id' | 'at'>) =>
    patch(id, (c) => {
      const next = [...c.log, { ...entry, id: uid(), at: Date.now() }];
      return { ...c, log: next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next };
    });

  const system = (id: string, text: string, level: 'info' | 'error' = 'info') =>
    log(id, { dir: 'system', data: text, size: 0, level });

  return {
    conns: {},
    drafts: {},
    composers: {},

    connect: (id, url, protocols) => {
      const previous = sockets.get(id);
      if (previous) {
        sockets.delete(id); // detach first so its close event is ignored
        previous.close(1000, 'Reconnecting');
      }
      let socket: WebSocket;
      try {
        socket = new WebSocket(url, protocols.length ? protocols : undefined);
      } catch (e) {
        patch(id, (c) => ({ ...c, status: 'error' }));
        system(id, `Could not connect: ${e instanceof Error ? e.message : 'invalid URL'}`, 'error');
        return;
      }
      socket.binaryType = 'arraybuffer';
      sockets.set(id, socket);
      patch(id, (c) => ({ ...c, status: 'connecting', protocol: undefined, openedAt: undefined }));
      system(id, `Connecting to ${url}${protocols.length ? ` (subprotocols: ${protocols.join(', ')})` : ''}`);

      const current = () => sockets.get(id) === socket;
      socket.onopen = () => {
        if (!current()) return;
        patch(id, (c) => ({ ...c, status: 'open', protocol: socket.protocol || undefined, openedAt: Date.now() }));
        system(id, `Connected${socket.protocol ? ` · subprotocol “${socket.protocol}”` : ''}`);
      };
      socket.onmessage = (event) => {
        if (!current()) return;
        if (typeof event.data === 'string') {
          log(id, { dir: 'in', data: event.data, size: byteLength(event.data) });
        } else if (event.data instanceof ArrayBuffer) {
          log(id, { dir: 'in', data: describeBinary(event.data), size: event.data.byteLength, binary: true });
        }
      };
      socket.onerror = () => {
        if (!current() || get().conns[id]?.status === 'closing') return;
        // Browsers deliberately hide error details; the close event that follows carries the code.
        system(id, 'Connection error', 'error');
      };
      socket.onclose = (event) => {
        if (!current()) return;
        sockets.delete(id);
        const userClosed = get().conns[id]?.status === 'closing';
        if (userClosed) {
          patch(id, (c) => ({ ...c, status: 'closed' }));
          system(id, 'Disconnected');
          return;
        }
        const reason = event.reason ? ` — ${event.reason}` : CLOSE_REASONS[event.code] ? ` — ${CLOSE_REASONS[event.code]}` : '';
        const wasOpen = get().conns[id]?.openedAt !== undefined;
        patch(id, (c) => ({ ...c, status: event.wasClean || wasOpen ? 'closed' : 'error' }));
        system(id, `Disconnected (code ${event.code})${reason}`, event.code === 1000 || event.code === 1001 ? 'info' : 'error');
      };
    },

    disconnect: (id) => {
      const socket = sockets.get(id);
      if (!socket) return;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        patch(id, (c) => ({ ...c, status: 'closing' }));
        socket.close(1000, 'Closed by user');
      }
    },

    send: (id, data) => {
      const socket = sockets.get(id);
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(data);
      log(id, { dir: 'out', data, size: byteLength(data) });
      return true;
    },

    clearLog: (id) => patch(id, (c) => ({ ...c, log: [] })),
    setDraft: (id, draft) => set((s) => ({ drafts: { ...s.drafts, [id]: draft } })),
    clearDraft: (id) =>
      set((s) => {
        const drafts = { ...s.drafts };
        delete drafts[id];
        return { drafts };
      }),
    setComposer: (id, composer) => set((s) => ({ composers: { ...s.composers, [id]: composer } })),

    /** Disconnects and drops all in-memory state for a connection (tab closed or connection deleted). */
    forget: (id) => {
      const socket = sockets.get(id);
      if (socket) {
        sockets.delete(id);
        socket.close(1000, 'Closed by user');
      }
      set((s) => {
        const conns = { ...s.conns };
        const drafts = { ...s.drafts };
        const composers = { ...s.composers };
        delete conns[id];
        delete drafts[id];
        delete composers[id];
        return { conns, drafts, composers };
      });
    },
  };
});

export const useWsConn = (id: string) => useWsStore((s) => s.conns[id] ?? IDLE);
export const useWsComposer = (id: string) => useWsStore((s) => s.composers[id] ?? EMPTY_COMPOSER);
