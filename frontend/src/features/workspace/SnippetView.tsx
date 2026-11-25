import axios from 'axios';
import { AlertTriangle, Code2, FileText, Pin, PinOff, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDeleteSnippet, usePinSnippet, useSaveSnippet, useSnippet } from '../../api/hooks';
import { CodeView, CopyButton } from '../../components/CodeView';
import { Markdown } from '../../components/Markdown';
import { Avatar, Button, EmptyState, FullPageSpinner, IconButton, Segmented, Select } from '../../components/ui';
import { timeAgo } from '../../lib/utils';
import { confirm } from '../../store/confirm';
import { CODE_LANGUAGES, draftChanged, draftFrom, languageLabel, useSnippetStore, type SnippetDraft } from '../../store/snippets';
import { useWorkspaceStore, type Tab } from '../../store/workspace';
import type { Snippet, SnippetKind } from '../../types';
import { CodeTextarea } from './BodyEditor';
import { useWs } from './context';

export function SnippetView({ tab }: Readonly<{ tab: Tab }>) {
  const { data, isLoading, isError } = useSnippet(tab.id);
  if (isLoading) return <FullPageSpinner />;
  if (isError || !data) return <EmptyState icon={<FileText />} title="Text not found" description="It may have been deleted by a teammate." />;
  return <SnippetEditor key={data.id} snippet={data} tabKey={tab.key} />;
}

function SnippetEditor({ snippet, tabKey }: Readonly<{ snippet: Snippet; tabKey: string }>) {
  const { wsId, canEdit } = useWs();
  const id = snippet.id;
  const stored = useSnippetStore((s) => s.drafts[id]);
  const setDraft = useSnippetStore((s) => s.setDraft);
  const clearDraft = useSnippetStore((s) => s.clearDraft);
  const draft: SnippetDraft = stored ?? draftFrom(snippet);
  const dirty = !!stored && draftChanged(stored, snippet);
  const save = useSaveSnippet(wsId);
  const pin = usePinSnippet(wsId);
  const del = useDeleteSnippet(wsId);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const [mode, setMode] = useState<'write' | 'preview'>(snippet.content ? 'preview' : 'write');
  const [conflict, setConflict] = useState(false);

  // A teammate saved a newer version while this tab had no local edits → follow it automatically.
  const staleDraft = !!stored && stored.baseVersion < snippet.version;
  const edit = (patch: Partial<SnippetDraft>) => setDraft(id, { ...draft, ...patch });

  const persist = useCallback(
    (version: number) => {
      save.mutate(
        { id, title: draft.title.trim() || snippet.title, kind: draft.kind, language: draft.language, content: draft.content, version },
        {
          onSuccess: (saved) => {
            clearDraft(id);
            setConflict(false);
            renameTab(wsId, tabKey, saved.title);
          },
          onError: (e) => {
            if (axios.isAxiosError(e) && e.response?.status === 409) setConflict(true);
          },
        },
      );
    },
    [save, id, draft, snippet.title, clearDraft, renameTab, wsId, tabKey],
  );

  const onSave = useCallback(() => {
    if (canEdit && dirty && !save.isPending) persist(draft.baseVersion);
  }, [canEdit, dirty, save.isPending, persist, draft.baseVersion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave]);

  const latest = useSnippet(id); // same query; used to refetch on conflict
  const loadLatest = async () => {
    clearDraft(id);
    setConflict(false);
    await latest.refetch();
  };
  const overwrite = async () => {
    const fresh = await latest.refetch();
    if (fresh.data) persist(fresh.data.version);
  };

  const setKind = (kind: SnippetKind) => edit({ kind, language: kind === 'CODE' ? draft.language ?? 'plaintext' : null });
  const isNote = draft.kind === 'NOTE';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
          {isNote ? <FileText className="size-4" /> : <Code2 className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={draft.title}
            readOnly={!canEdit}
            onChange={(e) => edit({ title: e.target.value })}
            className="w-full truncate bg-transparent text-[15px] font-semibold focus:outline-none"
            aria-label="Title"
            maxLength={200}
          />
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {snippet.createdBy && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={snippet.createdBy.name} color={snippet.createdBy.avatarColor} size={16} />
                {snippet.createdBy.name}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>
              Edited {timeAgo(snippet.updatedAt)}
              {snippet.updatedBy && snippet.updatedBy.id !== snippet.createdBy?.id ? ` by ${snippet.updatedBy.name}` : ''}
            </span>
            {dirty && <span className="font-medium text-warning">· Unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <CopyButton text={draft.content} label="Copy" />
          {canEdit && (
            <IconButton
              label={snippet.pinned ? 'Unpin' : 'Pin to top'}
              onClick={() => pin.mutate({ id, pinned: !snippet.pinned })}
              disabled={pin.isPending}
              className={snippet.pinned ? 'text-accent-fg' : undefined}
            >
              {snippet.pinned ? <PinOff /> : <Pin />}
            </IconButton>
          )}
          {snippet.canDelete && (
            <IconButton
              label="Delete text"
              onClick={async () => {
                if (await confirm({ title: `Delete “${snippet.title}”?`, message: 'It will be removed for everyone in this workspace.', confirmText: 'Delete', danger: true }))
                  del.mutate(id, {
                    onSuccess: () => {
                      clearDraft(id);
                      closeTab(wsId, tabKey);
                    },
                  });
              }}
            >
              <Trash2 />
            </IconButton>
          )}
          {canEdit && (
            <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon={<Save />} disabled={!dirty} loading={save.isPending} onClick={onSave} title="Save (⌘/Ctrl+S)" className="ml-1">
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Conflict / staleness banners */}
      {conflict && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px] text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">A teammate saved this text while you were editing. Your changes are still here.</span>
          <Button size="sm" icon={<RefreshCw />} onClick={loadLatest}>Load latest (discard mine)</Button>
          <Button size="sm" variant="primary" onClick={overwrite} loading={save.isPending}>Overwrite with mine</Button>
        </div>
      )}
      {!conflict && staleDraft && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-info-soft px-4 py-2 text-[13px] text-info">
          <span className="flex-1">A newer version was saved by {snippet.updatedBy?.name ?? 'a teammate'}.</span>
          <Button size="sm" icon={<RefreshCw />} onClick={loadLatest}>Load latest</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        {canEdit ? (
          <Segmented
            variant="pill"
            value={draft.kind}
            onChange={setKind}
            options={[
              { value: 'NOTE', label: <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />Note</span> },
              { value: 'CODE', label: <span className="inline-flex items-center gap-1.5"><Code2 className="size-3.5" />Code</span> },
            ]}
          />
        ) : (
          <span className="text-xs font-medium text-muted">{isNote ? 'Note' : languageLabel(draft.language)}</span>
        )}
        {!isNote && canEdit && (
          <Select className="h-7 w-40 text-xs" value={draft.language ?? 'plaintext'} onChange={(e) => edit({ language: e.target.value })} aria-label="Language">
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </Select>
        )}
        {isNote && canEdit && (
          <Segmented
            variant="pill"
            className="ml-auto"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'write', label: 'Write' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
        )}
        {isNote && <span className="text-[11px] text-faint">{canEdit ? 'Markdown supported' : ''}</span>}
        <span className="ml-auto text-[11px] tabular-nums text-faint">{draft.content.length.toLocaleString()} characters</span>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isNote ? (
          canEdit && mode === 'write' ? (
            <CodeTextarea
              value={draft.content}
              onChange={(content) => edit({ content })}
              placeholder={'# Title\n\nWrite anything your team should know — steps, decisions, links…'}
              className="h-full min-h-64 font-sans text-sm"
            />
          ) : draft.content.trim() ? (
            <div className="mx-auto max-w-3xl rounded-xl border border-line bg-panel p-6">
              <Markdown>{draft.content}</Markdown>
            </div>
          ) : (
            <EmptyState compact icon={<FileText />} title="This note is empty" description={canEdit ? 'Switch to Write to add content.' : undefined} />
          )
        ) : canEdit ? (
          <CodeTextarea value={draft.content} onChange={(content) => edit({ content })} placeholder="Paste or type code…" className="h-full min-h-64" />
        ) : (
          <CodeView code={draft.content || ' '} language={draft.language === 'json' ? 'json' : 'text'} className="h-full" />
        )}
      </div>
    </div>
  );
}
