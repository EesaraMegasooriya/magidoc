import clsx from 'clsx';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookmarkPlus,
  ChevronDown,
  Info,
  Plug,
  PlugZap,
  Save,
  Send,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateWebSocket, useWebSockets } from '../../api/hooks';
import { CodeView, CopyButton, tryPrettyJson } from '../../components/CodeView';
import { Button, EmptyState, FullPageSpinner, IconButton, Input, SearchInput, Segmented } from '../../components/ui';
import { formatBytes, uid } from '../../lib/utils';
import { resolve, unresolved } from '../../lib/variables';
import { prompt } from '../../store/confirm';
import { useWorkspaceStore, type Tab } from '../../store/workspace';
import { useWsComposer, useWsConn, useWsStore, type WsDraft, type WsLogEntry, type WsStatus } from '../../store/websocket';
import type { WebSocketConnection, WsMessageFormat, WsSavedMessage } from '../../types';
import { CodeTextarea } from './BodyEditor';
import { useScope, useWs } from './context';

const STATUS: Record<WsStatus, { label: string; dot: string; text: string }> = {
  idle: { label: 'Not connected', dot: 'bg-faint', text: 'text-muted' },
  connecting: { label: 'Connecting…', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  open: { label: 'Connected', dot: 'bg-success', text: 'text-success' },
  closing: { label: 'Disconnecting…', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  closed: { label: 'Disconnected', dot: 'bg-faint', text: 'text-muted' },
  error: { label: 'Connection failed', dot: 'bg-danger', text: 'text-danger' },
};

const toDraft = (w: WebSocketConnection): WsDraft => ({ name: w.name, url: w.url, protocols: w.protocols.join(', '), messages: w.messages });
const parseProtocols = (s: string) => s.split(',').map((p) => p.trim()).filter(Boolean);
const sameDraft = (a: WsDraft, b: WsDraft) => JSON.stringify(a) === JSON.stringify(b);

export function WebSocketView({ tab }: Readonly<{ tab: Tab }>) {
  const { wsId } = useWs();
  const { data: list, isLoading } = useWebSockets(wsId);
  const conn = list?.find((w) => w.id === tab.id);
  if (isLoading) return <FullPageSpinner />;
  if (!conn) return <EmptyState icon={<Plug />} title="Connection not found" description="It may have been deleted." />;
  return <WebSocketEditor key={conn.id} conn={conn} tabKey={tab.key} />;
}

function WebSocketEditor({ conn, tabKey }: Readonly<{ conn: WebSocketConnection; tabKey: string }>) {
  const { wsId, canEdit } = useWs();
  const id = conn.id;
  const base = useMemo(() => toDraft(conn), [conn]);
  const stored = useWsStore((s) => s.drafts[id]);
  const draft = stored ?? base;
  const dirty = !!stored && !sameDraft(stored, base);
  const { setDraft, clearDraft, connect, disconnect, send, clearLog, setComposer } = useWsStore();
  const state = useWsConn(id);
  const composer = useWsComposer(id);
  const update = useUpdateWebSocket(wsId);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const scope = useScope();

  const [filter, setFilter] = useState<'all' | 'out' | 'in'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const edit = (patch: Partial<WsDraft>) => setDraft(id, { ...draft, ...patch });
  const resolvedUrl = resolve(draft.url.trim(), scope);
  const missing = [...new Set([...unresolved(draft.url, scope), ...unresolved(composer.body, scope)])];
  const urlError = draft.url.trim() && !/^wss?:\/\//i.test(resolvedUrl) ? 'WebSocket URLs start with ws:// or wss://' : null;
  const insecureFromHttps = window.location.protocol === 'https:' && /^ws:\/\//i.test(resolvedUrl);
  const isLive = state.status === 'open' || state.status === 'connecting' || state.status === 'closing';

  const jsonError = useMemo(() => {
    if (composer.format !== 'json' || !composer.body.trim()) return null;
    try {
      JSON.parse(resolve(composer.body, scope));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON';
    }
  }, [composer, scope]);

  const save = useCallback(() => {
    if (!canEdit || !dirty) return;
    const protocols = parseProtocols(draft.protocols);
    update.mutate(
      { id, name: draft.name.trim() || conn.name, url: draft.url.trim(), protocols, messages: draft.messages },
      {
        onSuccess: (saved) => {
          clearDraft(id);
          renameTab(wsId, tabKey, saved.name);
        },
      },
    );
  }, [canEdit, dirty, draft, id, conn.name, update, clearDraft, renameTab, wsId, tabKey]);

  const sendComposer = useCallback(() => {
    if (state.status !== 'open' || !composer.body || jsonError) return;
    send(id, resolve(composer.body, scope));
  }, [state.status, composer.body, jsonError, send, id, scope]);

  // ⌘/Ctrl+S saves the connection (⌘/Ctrl+Enter is handled by the composer itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.log.filter((m) => (filter === 'all' || m.dir === filter) && (!q || m.data.toLowerCase().includes(q)));
  }, [state.log, filter, search]);

  // Auto-scroll only while the user is already at the bottom of the log.
  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const saveMessage = async () => {
    const name = await prompt({ title: 'Save message', label: 'Message name', placeholder: 'e.g. Subscribe to prices', confirmText: 'Save' });
    if (!name) return;
    edit({ messages: [...draft.messages, { id: uid(), name, body: composer.body, format: composer.format }] });
  };

  const counts = useMemo(
    () => ({ out: state.log.filter((m) => m.dir === 'out').length, in: state.log.filter((m) => m.dir === 'in').length }),
    [state.log],
  );
  const status = STATUS[state.status];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-faint">WebSocket</p>
          <input
            value={draft.name}
            readOnly={!canEdit}
            onChange={(e) => edit({ name: e.target.value })}
            className="w-full truncate bg-transparent text-sm font-semibold focus:outline-none"
            aria-label="Connection name"
            maxLength={200}
          />
        </div>
        {canEdit && (
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon={<Save />} loading={update.isPending} disabled={!dirty} onClick={save} title="Save (⌘/Ctrl+S)">
            Save
          </Button>
        )}
      </div>

      {/* URL bar */}
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-line-strong bg-panel focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
          <span className={clsx('flex w-36 shrink-0 items-center gap-2 border-r border-line px-3 text-xs font-medium', status.text)} aria-live="polite">
            <span className={clsx('size-2 shrink-0 rounded-full', status.dot)} />
            {status.label}
          </span>
          <input
            value={draft.url}
            onChange={(e) => edit({ url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLive && !urlError && draft.url.trim()) connect(id, resolvedUrl, parseProtocols(draft.protocols));
            }}
            placeholder="wss://echo.websocket.org  —  supports {{variables}}"
            spellCheck={false}
            className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-fg placeholder:text-faint focus:outline-none"
            aria-label="WebSocket URL"
            aria-invalid={!!urlError}
          />
          {isLive ? (
            <button
              type="button"
              onClick={() => disconnect(id)}
              disabled={state.status === 'closing'}
              className="m-1 flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 text-[13px] font-semibold text-danger transition-colors hover:border-danger/60 disabled:opacity-50 cursor-pointer"
            >
              <X className="size-4" /> {state.status === 'connecting' ? 'Cancel' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => connect(id, resolvedUrl, parseProtocols(draft.protocols))}
              disabled={!draft.url.trim() || !!urlError}
              className="m-1 flex items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-semibold text-on-accent shadow-sm transition-colors hover:bg-accent-strong disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <PlugZap className="size-4" /> Connect
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex min-w-64 flex-1 items-center gap-2 text-xs text-muted">
            Subprotocols
            <Input
              value={draft.protocols}
              onChange={(e) => edit({ protocols: e.target.value })}
              placeholder="e.g. graphql-ws, json (comma separated)"
              className="h-7 max-w-80 font-mono text-xs"
              disabled={isLive}
            />
          </label>
          {resolvedUrl !== draft.url.trim() && !urlError && <span className="truncate font-mono text-[11px] text-faint">→ {resolvedUrl}</span>}
          {missing.map((v) => (
            <span key={v} className="rounded bg-danger-soft px-1.5 py-0.5 font-mono text-[11px] text-danger">{`{{${v}}}`} undefined</span>
          ))}
        </div>
        {urlError && <p className="mt-1.5 text-xs text-danger">{urlError}</p>}
        {insecureFromHttps && <p className="mt-1.5 text-xs text-warning">Browsers block insecure ws:// connections from an https:// page — use wss://.</p>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Composer */}
        <section className="flex min-h-0 flex-col border-b border-line lg:w-[42%] lg:border-b-0 lg:border-r" aria-label="Message composer">
          <div className="flex items-center gap-2 px-4 py-2">
            <h3 className="text-[13px] font-semibold">Message</h3>
            <Segmented
              variant="pill"
              value={composer.format}
              onChange={(format: WsMessageFormat) => setComposer(id, { ...composer, format })}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'json', label: 'JSON' },
              ]}
            />
            {composer.format === 'json' && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Wand2 />}
                className="ml-auto"
                onClick={() => {
                  const pretty = tryPrettyJson(composer.body);
                  if (pretty) setComposer(id, { ...composer, body: pretty });
                }}
              >
                Beautify
              </Button>
            )}
          </div>
          <div className="flex min-h-40 flex-1 flex-col px-4">
            <CodeTextarea
              value={composer.body}
              onChange={(body) => setComposer(id, { ...composer, body })}
              placeholder={composer.format === 'json' ? '{\n  "type": "subscribe",\n  "channel": "{{channel}}"\n}' : 'Type a message…'}
              className="min-h-32 flex-1"
            />
            {jsonError && <p className="mt-1 font-mono text-xs text-danger">⚠ {jsonError}</p>}
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            {canEdit && (
              <Button size="sm" variant="ghost" icon={<BookmarkPlus />} disabled={!composer.body} onClick={saveMessage}>
                Save message
              </Button>
            )}
            <span className="ml-auto hidden text-[11px] text-faint sm:inline">⌘/Ctrl + Enter</span>
            <Button
              variant="primary"
              icon={<Send />}
              disabled={state.status !== 'open' || !composer.body || !!jsonError}
              onClick={sendComposer}
              title={state.status !== 'open' ? 'Connect first' : 'Send (⌘/Ctrl+Enter)'}
            >
              Send
            </Button>
          </div>
          <SavedMessages
            messages={draft.messages}
            canEdit={canEdit}
            canSend={state.status === 'open'}
            onLoad={(m) => setComposer(id, { body: m.body, format: m.format })}
            onSend={(m) => send(id, resolve(m.body, scope))}
            onDelete={(m) => edit({ messages: draft.messages.filter((x) => x.id !== m.id) })}
          />
          <ComposerShortcut onSend={sendComposer} />
        </section>

        {/* Log */}
        <section className="flex min-h-0 flex-1 flex-col" aria-label="Messages">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
            <Segmented
              variant="pill"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${state.log.length ? state.log.length : ''}`.trim() },
                { value: 'out', label: `Sent ${counts.out || ''}`.trim() },
                { value: 'in', label: `Received ${counts.in || ''}`.trim() },
              ]}
            />
            <SearchInput className="min-w-40 flex-1" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search messages" />
            <IconButton label="Clear messages" onClick={() => clearLog(id)} disabled={!state.log.length}>
              <Trash2 />
            </IconButton>
          </div>
          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            className="min-h-0 flex-1 overflow-y-auto"
            role="log"
            aria-live="polite"
          >
            {visible.length === 0 ? (
              <EmptyState
                compact
                icon={<Plug />}
                title={state.log.length ? 'No matching messages' : 'No messages yet'}
                description={state.log.length ? 'Try a different filter.' : 'Connect, then send a message. Sent and received messages appear here.'}
              />
            ) : (
              <ul className="divide-y divide-line">
                {visible.map((m) => (
                  <LogRow key={m.id} entry={m} expanded={expanded === m.id} onToggle={() => setExpanded(expanded === m.id ? null : m.id)} />
                ))}
              </ul>
            )}
          </div>
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-faint">
            <Info className="size-3.5 shrink-0" />
            Connections run in your browser. Browsers can’t set custom headers on WebSockets — pass auth tokens in the URL or a subprotocol.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Registers ⌘/Ctrl+Enter for sending while this editor is mounted. */
function ComposerShortcut({ onSend }: Readonly<{ onSend: () => void }>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSend();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSend]);
  return null;
}

function SavedMessages({
  messages,
  canEdit,
  canSend,
  onLoad,
  onSend,
  onDelete,
}: Readonly<{
  messages: WsSavedMessage[];
  canEdit: boolean;
  canSend: boolean;
  onLoad: (m: WsSavedMessage) => void;
  onSend: (m: WsSavedMessage) => void;
  onDelete: (m: WsSavedMessage) => void;
}>) {
  const [open, setOpen] = useState(true);
  if (!messages.length) return null;
  return (
    <div className="max-h-56 overflow-y-auto border-t border-line">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-xs font-medium text-muted hover:text-fg cursor-pointer" aria-expanded={open}>
        <ChevronDown className={clsx('size-3.5 transition', !open && '-rotate-90')} />
        Saved messages · {messages.length}
      </button>
      {open && (
        <ul className="px-2 pb-2">
          {messages.map((m) => (
            <li key={m.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-panel-3">
              <button type="button" onClick={() => onLoad(m)} className="min-w-0 flex-1 text-left cursor-pointer" title="Load into composer">
                <span className="block truncate text-[13px]">{m.name}</span>
                <span className="block truncate font-mono text-[11px] text-faint">{m.body.replace(/\s+/g, ' ')}</span>
              </button>
              <span className="rounded bg-panel-3 px-1 text-[10px] uppercase text-muted">{m.format}</span>
              <IconButton size="sm" label={`Send “${m.name}”`} disabled={!canSend} onClick={() => onSend(m)}>
                <Send />
              </IconButton>
              {canEdit && (
                <IconButton size="sm" label={`Delete “${m.name}”`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => onDelete(m)}>
                  <Trash2 />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogRow({ entry, expanded, onToggle }: Readonly<{ entry: WsLogEntry; expanded: boolean; onToggle: () => void }>) {
  const time = new Date(entry.at).toLocaleTimeString(undefined, { hour12: false }) + '.' + String(entry.at % 1000).padStart(3, '0');
  if (entry.dir === 'system') {
    return (
      <li className={clsx('flex items-start gap-2 px-4 py-1.5 text-xs', entry.level === 'error' ? 'bg-danger-soft text-danger' : 'text-muted')}>
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span className="flex-1 break-words">{entry.data}</span>
        <span className="shrink-0 font-mono text-[10.5px] text-faint">{time}</span>
      </li>
    );
  }
  const pretty = !entry.binary ? tryPrettyJson(entry.data) : null;
  const out = entry.dir === 'out';
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-2 px-4 py-2 text-left transition-colors hover:bg-panel-2 cursor-pointer">
        {out ? <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-accent-fg" aria-label="Sent" /> : <ArrowDownLeft className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Received" />}
        <span className={clsx('min-w-0 flex-1 font-mono text-[12.5px]', expanded ? 'whitespace-pre-wrap break-all' : 'truncate')}>
          {expanded ? '' : entry.data.replace(/\s+/g, ' ')}
        </span>
        <span className="shrink-0 font-mono text-[10.5px] text-faint">{formatBytes(entry.size)}</span>
        <span className="shrink-0 font-mono text-[10.5px] text-faint">{time}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <CodeView
            code={pretty ?? entry.data}
            language={pretty ? 'json' : 'text'}
            lineNumbers={false}
            className="max-h-80"
            toolbar={<CopyButton text={entry.data} className="bg-panel" />}
          />
        </div>
      )}
    </li>
  );
}
