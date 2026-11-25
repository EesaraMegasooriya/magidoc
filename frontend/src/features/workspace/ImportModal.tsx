import clsx from 'clsx';
import { FileJson, GitMerge, Plus, Terminal, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useCollections, useImportCollection, useImportMerged, useMergeIntoCollection } from '../../api/hooks';
import { Badge, Button, Input, Modal, Segmented, Select } from '../../components/ui';
import { parseCurl, parseImport, type ImportFormat } from '../../lib/interchange';
import { uid } from '../../lib/utils';
import { useWorkspaceStore } from '../../store/workspace';
import type { ExportCollection, ExportItem } from '../../types';
import { CodeTextarea } from './BodyEditor';
import { useNewScratch } from './TabBar';
import { useWs } from './context';

const FORMAT_LABEL: Record<ImportFormat, string> = { magidoc: 'MagiDoc', postman: 'Postman', openapi: 'OpenAPI' };
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCES = 20;

interface Source {
  id: string;
  label: string;
  format?: ImportFormat;
  collection?: ExportCollection;
  error?: string;
}

const countRequests = (items: ExportItem[] = []): number =>
  items.reduce((n, i) => n + (i.type === 'folder' ? countRequests(i.items) : 1), 0);

function toSource(label: string, text: string): Source {
  try {
    const { format, collection } = parseImport(text);
    return { id: uid(), label, format, collection };
  } catch (e) {
    return { id: uid(), label, error: e instanceof Error ? e.message : 'Could not parse file' };
  }
}

/**
 * Import one or more files. Several files are auto-merged into one collection; files can also be merged
 * into an existing collection (matching folders/requests are updated instead of duplicated).
 */
export function ImportModal({ onClose, initialCollectionId }: Readonly<{ onClose: () => void; initialCollectionId?: string }>) {
  const { wsId } = useWs();
  const [mode, setMode] = useState<'files' | 'curl'>('files');
  const [sources, setSources] = useState<Source[]>([]);
  const [paste, setPaste] = useState('');
  const [curl, setCurl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [destination, setDestination] = useState<'new' | 'existing'>(initialCollectionId ? 'existing' : 'new');
  const [targetId, setTargetId] = useState(initialCollectionId ?? '');
  const [name, setName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: collections } = useCollections(wsId);
  const importOne = useImportCollection(wsId);
  const importMerged = useImportMerged(wsId);
  const mergeInto = useMergeIntoCollection(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const newScratch = useNewScratch();

  const valid = sources.filter((s): s is Source & { collection: ExportCollection } => !!s.collection);
  const defaultName = valid.length ? valid.map((s) => s.collection.name).join(' + ').slice(0, 150) : '';
  const target = collections?.find((c) => c.id === targetId);
  const busy = importOne.isPending || importMerged.isPending || mergeInto.isPending;
  const totalRequests = valid.reduce((n, s) => n + countRequests(s.collection.items), 0);

  const curlParsed = useMemo(() => {
    if (!curl.trim()) return null;
    try {
      return { ok: true as const, draft: parseCurl(curl) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Could not parse command' };
    }
  }, [curl]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, MAX_SOURCES - sources.length));
    const parsed = await Promise.all(
      list.map(async (f): Promise<Source> => {
        if (f.size > MAX_FILE_BYTES) return { id: uid(), label: f.name, error: 'File is larger than 15 MB' };
        try {
          return toSource(f.name, await f.text());
        } catch {
          return { id: uid(), label: f.name, error: 'Could not read file' };
        }
      }),
    );
    setSources((prev) => [...prev, ...parsed]);
  };

  const addPaste = () => {
    if (!paste.trim()) return;
    setSources((prev) => [...prev, toSource(`Pasted content ${prev.length + 1}`, paste)].slice(0, MAX_SOURCES));
    setPaste('');
  };

  const openCollection = (id: string, title: string) => {
    openTab(wsId, { kind: 'collection', id, title });
    onClose();
  };

  const submit = () => {
    if (mode === 'curl') {
      if (curlParsed?.ok) {
        newScratch(curlParsed.draft);
        onClose();
      }
      return;
    }
    const payload = valid.map((s) => s.collection);
    if (!payload.length) return;
    if (destination === 'existing') {
      if (!targetId) return;
      mergeInto.mutate({ collectionId: targetId, collections: payload }, { onSuccess: (r) => openCollection(r.collection.id, r.collection.name) });
    } else if (payload.length === 1) {
      const only = payload[0];
      importOne.mutate(
        { ...only, name: name.trim() || only.name },
        { onSuccess: (c) => openCollection(c.id, c.name) },
      );
    } else {
      importMerged.mutate(
        { collections: payload, name: name.trim() || defaultName },
        { onSuccess: (r) => openCollection(r.collection.id, r.collection.name) },
      );
    }
  };

  const canSubmit =
    mode === 'curl' ? !!curlParsed?.ok : valid.length > 0 && (destination === 'new' || !!targetId);
  const submitLabel =
    mode === 'curl'
      ? 'Open as request'
      : destination === 'existing'
        ? `Merge into ${target?.name ?? 'collection'}`
        : valid.length > 1
          ? `Merge ${valid.length} files into new collection`
          : 'Import collection';

  return (
    <Modal
      open
      onClose={onClose}
      title="Import"
      description="Postman v2.x, OpenAPI 3 / Swagger 2 (JSON or YAML), MagiDoc exports or a cURL command."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={destination === 'existing' || valid.length > 1 ? <GitMerge /> : undefined} disabled={!canSubmit} loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Segmented
        className="-mt-2 mb-4 border-b border-line"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'files', label: <span className="inline-flex items-center gap-1.5"><FileJson className="size-3.5" />Files & JSON</span> },
          { value: 'curl', label: <span className="inline-flex items-center gap-1.5"><Terminal className="size-3.5" />cURL</span> },
        ]}
      />

      {mode === 'curl' ? (
        <>
          <CodeTextarea
            value={curl}
            onChange={setCurl}
            placeholder={"curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'"}
            className="h-40"
          />
          <div className="mt-2 min-h-5 text-[13px]">
            {curlParsed && !curlParsed.ok && <p className="text-danger">{curlParsed.error}</p>}
            {curlParsed?.ok && <p className="text-success">✓ {curlParsed.draft.method} {curlParsed.draft.url}</p>}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            className={clsx(
              'flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent/60',
            )}
          >
            <Upload className="size-5 text-accent-fg" />
            <span className="text-sm font-medium">Drop files here or click to browse</span>
            <span className="text-xs text-muted">Select several files to auto-merge them · .json, .yaml, .yml</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".json,.yaml,.yml,application/json,text/yaml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <details className="group rounded-lg border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-muted hover:text-fg">Paste JSON or YAML instead</summary>
            <div className="space-y-2 border-t border-line p-3">
              <CodeTextarea value={paste} onChange={setPaste} placeholder='{ "info": { … }, "item": [ … ] }' className="h-32" />
              <Button size="sm" icon={<Plus />} disabled={!paste.trim()} onClick={addPaste}>Add pasted content</Button>
            </div>
          </details>

          {sources.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Files to import">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                  <FileJson className={clsx('size-4 shrink-0', s.error ? 'text-danger' : 'text-muted')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{s.collection?.name ?? s.label}</p>
                    <p className={clsx('truncate text-xs', s.error ? 'text-danger' : 'text-faint')}>
                      {s.error ?? `${s.label} · ${countRequests(s.collection?.items)} requests`}
                    </p>
                  </div>
                  {s.format && <Badge tone="accent">{FORMAT_LABEL[s.format]}</Badge>}
                  <button
                    type="button"
                    onClick={() => setSources((prev) => prev.filter((x) => x.id !== s.id))}
                    className="flex size-6 items-center justify-center rounded text-faint hover:bg-panel-3 hover:text-fg cursor-pointer"
                    aria-label={`Remove ${s.collection?.name ?? s.label}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {valid.length > 0 && (
            <fieldset className="space-y-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-xs font-medium text-muted">Destination</legend>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="radio" className="mt-1 accent-accent" checked={destination === 'new'} onChange={() => setDestination('new')} />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">New collection</span>
                  <span className="block text-xs text-muted">
                    {valid.length > 1 ? `${valid.length} files are merged into one (${totalRequests} requests before de-duplication).` : 'Creates a new collection.'}
                  </span>
                  {destination === 'new' && (
                    <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} maxLength={150} aria-label="Collection name" />
                  )}
                </span>
              </label>
              <label className={clsx('flex items-start gap-2.5', collections?.length ? 'cursor-pointer' : 'opacity-50')}>
                <input
                  type="radio"
                  className="mt-1 accent-accent"
                  disabled={!collections?.length}
                  checked={destination === 'existing'}
                  onChange={() => setDestination('existing')}
                />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">Merge into an existing collection</span>
                  <span className="block text-xs text-muted">Matching folders and requests are updated in place; new ones are added. Nothing is deleted.</span>
                  {destination === 'existing' && (
                    <Select className="mt-2" value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Collection to merge into">
                      <option value="" disabled>Choose a collection…</option>
                      {collections?.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.requestCount} requests)</option>
                      ))}
                    </Select>
                  )}
                </span>
              </label>
            </fieldset>
          )}
          {(valid.length > 1 || destination === 'existing') && (
            <p className="text-xs leading-relaxed text-faint">
              Merge rules: folders match by name; requests match by method + URL (query string ignored), otherwise by
              method + name. Incoming request details win; existing variable values are kept and new variables added.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
