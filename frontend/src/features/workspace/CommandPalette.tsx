import { useQueries } from '@tanstack/react-query';
import clsx from 'clsx';
import { BookOpen, Box, Code2, CornerDownLeft, FilePlus2, FileText, Layers, Plug, Search, Settings, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { keys, normalizeDetail, useCollections, useEnvironments, useSnippets, useWebSockets } from '../../api/hooks';
import { MethodText } from '../../components/MethodBadge';
import { Kbd } from '../../components/ui';
import { useWorkspaceStore } from '../../store/workspace';
import type { CollectionDetail } from '../../types';
import { useNewScratch } from './TabBar';
import { useWs } from './context';

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  keywords: string;
  run: () => void;
}

/** ⌘K / Ctrl+K quick switcher for requests, collections, environments and actions. */
export function CommandPalette({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: () => void }) {
  const { wsId, canEdit } = useWs();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const newScratch = useNewScratch();
  const { data: collections } = useCollections(wsId);
  const { data: envs } = useEnvironments(wsId);
  const { data: sockets } = useWebSockets(wsId);
  const { data: texts } = useSnippets(wsId);

  // Load every collection's requests (shares the cache with the sidebar) only while the palette is open.
  const details = useQueries({
    queries: (open ? (collections ?? []) : []).map((c) => ({
      queryKey: keys.collection(c.id),
      queryFn: () => api.get<CollectionDetail>(`/collections/${c.id}`).then((r) => normalizeDetail(r.data)),
      staleTime: 30_000,
    })),
  });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [
      { id: 'a-new', group: 'Actions', label: 'New request', icon: <FilePlus2 />, keywords: 'new request create', run: () => newScratch() },
      ...(canEdit ? [{ id: 'a-import', group: 'Actions', label: 'Import collection or cURL', icon: <Upload />, keywords: 'import postman openapi swagger curl', run: onImport }] : []),
      { id: 'a-settings', group: 'Actions', label: 'Workspace settings & members', icon: <Settings />, keywords: 'settings members invite team', run: () => openTab(wsId, { kind: 'settings', id: 'settings', title: 'Settings' }) },
    ];
    for (const d of details) {
      const detail = d.data;
      if (!detail) continue;
      for (const r of detail.requests) {
        out.push({
          id: `r-${r.id}`,
          group: 'Requests',
          label: r.name,
          sub: `${detail.collection.name} · ${r.url}`,
          icon: <MethodText method={r.method} className="w-9 text-left" />,
          keywords: `${r.name} ${r.url} ${r.method} ${detail.collection.name}`.toLowerCase(),
          run: () => openTab(wsId, { kind: 'request', id: r.id, collectionId: r.collectionId, title: r.name }),
        });
      }
    }
    for (const c of collections ?? []) {
      out.push({ id: `c-${c.id}`, group: 'Collections', label: c.name, sub: `${c.requestCount} requests`, icon: <Box />, keywords: c.name.toLowerCase(), run: () => openTab(wsId, { kind: 'collection', id: c.id, title: c.name }) });
      out.push({ id: `d-${c.id}`, group: 'Documentation', label: `${c.name} docs`, icon: <BookOpen />, keywords: `docs documentation ${c.name}`.toLowerCase(), run: () => openTab(wsId, { kind: 'docs', id: c.id, title: `Docs · ${c.name}` }) });
    }
    for (const w of sockets ?? []) {
      out.push({ id: `w-${w.id}`, group: 'WebSockets', label: w.name, sub: w.url, icon: <Plug />, keywords: `websocket ws ${w.name} ${w.url}`.toLowerCase(), run: () => openTab(wsId, { kind: 'websocket', id: w.id, title: w.name }) });
    }
    for (const t of texts ?? []) {
      out.push({ id: `t-${t.id}`, group: 'Text space', label: t.title, sub: t.preview, icon: t.kind === 'NOTE' ? <FileText /> : <Code2 />, keywords: `text note snippet ${t.title} ${t.preview}`.toLowerCase(), run: () => openTab(wsId, { kind: 'snippet', id: t.id, title: t.title }) });
    }
    for (const e of envs ?? []) {
      out.push({ id: `e-${e.id}`, group: 'Environments', label: e.name, sub: `${e.variables.length} variables`, icon: <Layers />, keywords: `environment ${e.name}`.toLowerCase(), run: () => openTab(wsId, { kind: 'environment', id: e.id, title: e.name }) });
    }
    return out;
  }, [details, collections, sockets, texts, envs, canEdit, wsId, openTab, newScratch, onImport]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group !== 'Requests' && i.group !== 'Documentation').concat(items.filter((i) => i.group === 'Requests').slice(0, 8));
    const terms = q.split(/\s+/);
    const groupOrder = ['Requests', 'Collections', 'Text space', 'WebSockets', 'Environments', 'Documentation', 'Actions'];
    // Label matches outrank keyword-only matches; groups stay contiguous so headers render once.
    const score = (i: Item) => {
      const label = i.label.toLowerCase();
      return label.startsWith(q) ? 0 : label.includes(q) ? 1 : terms.every((t) => label.includes(t)) ? 2 : 3;
    };
    const matched = items
      .filter((i) => terms.every((t) => i.keywords.includes(t) || i.label.toLowerCase().includes(t)))
      .map((i) => ({ i, s: score(i) }));
    const best = new Map<string, number>();
    for (const m of matched) best.set(m.i.group, Math.min(best.get(m.i.group) ?? 9, m.s));
    matched.sort(
      (a, b) =>
        best.get(a.i.group)! - best.get(b.i.group)! ||
        groupOrder.indexOf(a.i.group) - groupOrder.indexOf(b.i.group) ||
        a.s - b.s,
    );
    return matched.map((x) => x.i).slice(0, 50);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-overlay p-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(results[index]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search requests, collections, environments…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-10 text-center text-[13px] text-muted">No results for “{query}”</p>}
          {results.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium text-faint">{header}</p>}
                <button
                  id={`cmd-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-index={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => choose(item)}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left cursor-pointer', i === index ? 'bg-accent-soft' : '')}
                >
                  <span className="flex w-9 shrink-0 justify-center text-muted [&>svg]:size-4">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{item.label}</span>
                    {item.sub && <span className="block truncate font-mono text-[11px] text-faint">{item.sub}</span>}
                  </span>
                  {i === index && <CornerDownLeft className="size-3.5 text-faint" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-panel-2 px-4 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
