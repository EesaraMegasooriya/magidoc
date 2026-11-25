import clsx from 'clsx';
import { Code2, FileText, NotebookPen, Pin, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCreateSnippet, useSnippets } from '../../api/hooks';
import { Avatar, EmptyState, IconButton, Menu, SearchInput, Segmented, Spinner } from '../../components/ui';
import { timeAgo } from '../../lib/utils';
import { useAuth } from '../../store/auth';
import { prompt } from '../../store/confirm';
import { languageLabel } from '../../store/snippets';
import { useWorkspaceStore, useWsState } from '../../store/workspace';
import type { SnippetKind } from '../../types';
import { useWs } from './context';

type Filter = 'all' | 'mine' | 'pinned';

/** Readable one-line preview of Markdown: drops headings, emphasis, code ticks, quotes and list/task markers. */
export function plainPreview(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links & images → their text
    .replace(/(^|\s)[-*+]\s+\[[ xX]\]\s+/g, '$1') // task markers
    .replace(/(^|\s)(#{1,6}|>|[-*+]|\d+\.)\s+/g, '$1') // headings, quotes, list markers
    .replace(/[*_~`]+/g, '') // emphasis & code
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shared notes & code snippets for everyone in the workspace. */
export function SnippetsPanel() {
  const { wsId, canEdit } = useWs();
  const me = useAuth((s) => s.user);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, isFetching } = useSnippets(wsId, debounced);
  const create = useCreateSnippet(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const { active } = useWsState(wsId);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const add = async (kind: SnippetKind) => {
    const title = await prompt({
      title: kind === 'NOTE' ? 'New note' : 'New code snippet',
      label: 'Title',
      placeholder: kind === 'NOTE' ? 'e.g. Release checklist' : 'e.g. Auth header example',
      confirmText: 'Create',
    });
    if (!title) return;
    create.mutate(
      { title, kind, language: kind === 'CODE' ? 'plaintext' : undefined, content: '' },
      { onSuccess: (s) => openTab(wsId, { kind: 'snippet', id: s.id, title: s.title }) },
    );
  };

  const list = (data ?? []).filter((s) => (filter === 'mine' ? s.createdBy?.id === me?.id : filter === 'pinned' ? s.pinned : true));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Text space</h2>
        {canEdit && (
          <Menu
            align="right"
            items={[
              { label: 'New note', icon: <FileText />, onClick: () => add('NOTE') },
              { label: 'New code snippet', icon: <Code2 />, onClick: () => add('CODE') },
            ]}
            trigger={(open) => (
              <IconButton label="New text" onClick={open}>
                <Plus />
              </IconButton>
            )}
          />
        )}
      </div>
      <div className="space-y-2 px-3 pb-2">
        <SearchInput placeholder="Search titles and content" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search texts" />
        <Segmented
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'mine', label: 'Mine' },
            { value: 'pinned', label: 'Pinned' },
          ]}
        />
      </div>
      <div className={clsx('min-h-0 flex-1 overflow-y-auto px-1.5 pb-4 transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState
            compact
            icon={<NotebookPen />}
            title={debounced || filter !== 'all' ? 'Nothing found' : 'No shared texts yet'}
            description={
              debounced || filter !== 'all'
                ? 'Try another search or filter.'
                : 'Share notes and code snippets with everyone in this workspace — no more pasting them into chats.'
            }
            action={
              canEdit && !debounced && filter === 'all' && (
                <div className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => add('NOTE')} className="text-[13px] font-medium text-accent-fg hover:underline cursor-pointer">New note</button>
                  <button type="button" onClick={() => add('CODE')} className="text-[13px] font-medium text-accent-fg hover:underline cursor-pointer">New code snippet</button>
                </div>
              )
            }
          />
        ) : (
          <ul className="space-y-0.5">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openTab(wsId, { kind: 'snippet', id: s.id, title: s.title })}
                  className={clsx(
                    'flex w-full gap-2.5 rounded-lg px-2 py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    active === `snippet:${s.id}` ? 'bg-accent-soft' : 'hover:bg-panel-3',
                  )}
                >
                  <span className="mt-0.5 text-muted">{s.kind === 'NOTE' ? <FileText className="size-4" /> : <Code2 className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-fg">{s.title}</span>
                      {s.pinned && <Pin className="size-3 shrink-0 text-accent-fg" aria-label="Pinned" />}
                    </span>
                    {s.preview && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{s.kind === 'NOTE' ? plainPreview(s.preview) : s.preview}</span>}
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                      {s.createdBy && <Avatar name={s.createdBy.name} color={s.createdBy.avatarColor} size={14} />}
                      <span className="truncate">{s.createdBy?.id === me?.id ? 'You' : (s.createdBy?.name ?? 'Unknown')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{timeAgo(s.updatedAt)}</span>
                      {s.kind === 'CODE' && (
                        <span className="ml-auto shrink-0 rounded bg-panel-3 px-1 font-mono text-[10px] text-muted">{languageLabel(s.language)}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
