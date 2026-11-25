import clsx from 'clsx';
import { BookOpen, CheckCircle2, Copy, ExternalLink, Link2, Loader2, Play, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  executeRequest,
  keys,
  useCollection,
  useCreateShare,
  useDeleteShare,
  useShares,
  useUpdateCollection,
  useUpdateShare,
} from '../../api/hooks';
import { CopyButton } from '../../components/CodeView';
import { Markdown } from '../../components/Markdown';
import { MethodText } from '../../components/MethodBadge';
import { Button, EmptyState, FullPageSpinner, Input, Segmented, Select, Toggle } from '../../components/ui';
import { VariableEditor } from '../../components/VariableEditor';
import { errorMessage } from '../../lib/api';
import { buildRequest, toDraft } from '../../lib/request';
import { buildTree, flattenRequests } from '../../lib/tree';
import { statusColor, timeAgo } from '../../lib/utils';
import { confirm } from '../../store/confirm';
import { useWorkspaceStore, type Tab } from '../../store/workspace';
import type { AuthConfig, CollectionDetail, Variable } from '../../types';
import { AuthEditor } from './AuthEditor';
import { CodeTextarea } from './BodyEditor';
import { useScope, useWs } from './context';

type Section = 'overview' | 'variables' | 'auth' | 'runner' | 'share';

export function CollectionView({ tab }: { tab: Tab }) {
  const { data: detail, isLoading } = useCollection(tab.id);
  const [section, setSection] = useState<Section>('overview');
  if (isLoading) return <FullPageSpinner />;
  if (!detail) return <EmptyState title="Collection not found" description="It may have been deleted." />;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionHeader detail={detail} />
      <div className="border-b border-line px-4">
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'variables', label: 'Variables', count: detail.collection.variables.length },
            { value: 'auth', label: 'Authorization' },
            { value: 'runner', label: 'Runner' },
            { value: 'share', label: 'Share & publish' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {section === 'overview' && <OverviewSection key={detail.collection.id} detail={detail} />}
          {section === 'variables' && <VariablesSection key={detail.collection.id} detail={detail} />}
          {section === 'auth' && <AuthSection key={detail.collection.id} detail={detail} />}
          {section === 'runner' && <RunnerSection detail={detail} />}
          {section === 'share' && <ShareSection detail={detail} />}
        </div>
      </div>
    </div>
  );
}

function CollectionHeader({ detail }: { detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const update = useUpdateCollection(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const [name, setName] = useState(detail.collection.name);
  useEffect(() => setName(detail.collection.name), [detail.collection.name]);

  const commit = () => {
    const n = name.trim();
    if (!n || n === detail.collection.name) return setName(detail.collection.name);
    update.mutate({ id: detail.collection.id, name: n }, { onSuccess: () => renameTab(wsId, `collection:${detail.collection.id}`, n) });
  };

  return (
    <div className="flex items-center gap-4 px-6 pb-2 pt-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent-fg">{detail.collection.name[0]?.toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <input
          value={name}
          readOnly={!canEdit}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full bg-transparent text-xl font-bold focus:outline-none"
          aria-label="Collection name"
        />
        <p className="text-xs text-muted">
          {detail.requests.length} requests · {detail.folders.length} folders · updated {timeAgo(detail.collection.updatedAt)}
        </p>
      </div>
      <Button
        icon={<BookOpen className="size-4" />}
        onClick={() => openTab(wsId, { kind: 'docs', id: detail.collection.id, title: `Docs · ${detail.collection.name}` })}
      >
        View docs
      </Button>
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 rounded-xl border border-line-strong bg-panel p-3 shadow-lg">
      <span className="mr-auto text-sm text-muted">You have unsaved changes</span>
      <Button variant="ghost" onClick={onReset}>Discard</Button>
      <Button variant="primary" icon={<Save className="size-4" />} loading={saving} onClick={onSave}>Save changes</Button>
    </div>
  );
}

function OverviewSection({ detail }: { detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const update = useUpdateCollection(wsId);
  const [value, setValue] = useState(detail.collection.description);
  const [mode, setMode] = useState<'write' | 'preview'>(detail.collection.description ? 'preview' : 'write');
  const dirty = value !== detail.collection.description;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Documentation</h3>
        {canEdit && (
          <Segmented variant="pill" value={mode} onChange={setMode} options={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} />
        )}
      </div>
      {mode === 'write' && canEdit ? (
        <CodeTextarea value={value} onChange={setValue} className="min-h-80 font-sans" placeholder="# My API&#10;&#10;Describe authentication, rate limits, conventions…" />
      ) : value.trim() ? (
        <div className="rounded-xl bg-panel p-6 border border-line">
          <Markdown>{value}</Markdown>
        </div>
      ) : (
        <p className="rounded-xl bg-panel p-10 text-center text-sm text-faint border border-line">No documentation yet.</p>
      )}
      <SaveBar dirty={dirty} saving={update.isPending} onReset={() => setValue(detail.collection.description)} onSave={() => update.mutate({ id: detail.collection.id, description: value })} />
    </div>
  );
}

function VariablesSection({ detail }: { detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const update = useUpdateCollection(wsId);
  const [vars, setVars] = useState<Variable[]>(detail.collection.variables);
  const dirty = JSON.stringify(vars) !== JSON.stringify(detail.collection.variables);
  return (
    <div>
      <h3 className="font-semibold">Collection variables</h3>
      <p className="mb-4 mt-1 text-sm text-muted">
        Available to every request in this collection as <code className="text-accent-fg">{'{{name}}'}</code>. The active environment overrides them; secret values are masked in shared docs.
      </p>
      <VariableEditor rows={vars} onChange={setVars} readOnly={!canEdit} />
      <SaveBar dirty={dirty} saving={update.isPending} onReset={() => setVars(detail.collection.variables)} onSave={() => update.mutate({ id: detail.collection.id, variables: vars.filter((v) => v.key.trim()) })} />
    </div>
  );
}

function AuthSection({ detail }: { detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const update = useUpdateCollection(wsId);
  const [auth, setAuth] = useState<AuthConfig>(detail.collection.auth);
  const dirty = JSON.stringify(auth) !== JSON.stringify(detail.collection.auth);
  return (
    <div>
      <h3 className="font-semibold">Collection authorization</h3>
      <p className="mb-5 mt-1 text-sm text-muted">Requests set to “Inherit from collection” use this configuration.</p>
      <AuthEditor value={auth} onChange={setAuth} allowInherit={false} readOnly={!canEdit} />
      <SaveBar dirty={dirty} saving={update.isPending} onReset={() => setAuth(detail.collection.auth)} onSave={() => update.mutate({ id: detail.collection.id, auth })} />
    </div>
  );
}

interface RunResult {
  id: string;
  name: string;
  method: string;
  status: number;
  durationMs: number;
  error?: string | null;
}

function RunnerSection({ detail }: { detail: CollectionDetail }) {
  const { wsId } = useWs();
  const scope = useScope(detail);
  const qc = useQueryClient();
  const ordered = useMemo(() => flattenRequests(buildTree(detail.folders, detail.requests)), [detail]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ordered.map((r) => r.id)));
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [stopOnFail, setStopOnFail] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    for (const r of ordered.filter((x) => selected.has(x.id))) {
      const built = buildRequest(toDraft(r), detail.collection.auth, scope);
      let result: RunResult;
      try {
        const res = await executeRequest(wsId, { method: built.method, url: built.url, headers: built.headers, body: built.body, requestId: r.id, requestName: r.name });
        result = { id: r.id, name: r.name, method: r.method, status: res.status, durationMs: res.durationMs, error: res.error };
      } catch (e) {
        result = { id: r.id, name: r.name, method: r.method, status: 0, durationMs: 0, error: errorMessage(e) };
      }
      setResults((prev) => [...prev, result]);
      const failed = result.status === 0 || result.status >= 400;
      if (failed && stopOnFail) break;
    }
    setRunning(false);
    qc.invalidateQueries({ queryKey: keys.history(wsId) });
  };

  const passed = results.filter((r) => r.status >= 200 && r.status < 400).length;
  const total = results.reduce((n, r) => n + r.durationMs, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Collection runner</h3>
          <p className="mt-1 text-sm text-muted">Run requests in order using the active environment. 2xx/3xx responses count as passed.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <Toggle checked={stopOnFail} onChange={setStopOnFail} label="Stop on failure" /> Stop on failure
          </label>
          <Button variant="primary" icon={running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} disabled={running || selected.size === 0} onClick={run}>
            Run {selected.size}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Passed" value={passed} className="text-success" />
          <Stat label="Failed" value={results.length - passed} className="text-danger" />
          <Stat label="Total time" value={`${total} ms`} />
        </div>
      )}

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl bg-panel border border-line">
        {ordered.length === 0 && <li className="p-6 text-center text-sm text-faint">No requests to run.</li>}
        {ordered.map((r) => {
          const res = results.find((x) => x.id === r.id);
          const ok = res && res.status >= 200 && res.status < 400;
          return (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                className="size-3.5 accent-accent"
                checked={selected.has(r.id)}
                disabled={running}
                onChange={(e) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(r.id);
                    else n.delete(r.id);
                    return n;
                  })
                }
              />
              <MethodText method={r.method} className="w-10" />
              <span className="flex-1 truncate text-sm">{r.name}</span>
              {res ? (
                <>
                  <span className={clsx('font-mono text-xs', res.error ? 'text-danger' : statusColor(res.status))}>{res.error ? 'error' : res.status}</span>
                  <span className="w-16 text-right text-xs text-faint">{res.durationMs} ms</span>
                  {ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}
                </>
              ) : (
                running && selected.has(r.id) && <span className="text-xs text-faint">queued</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-xl bg-panel p-4 border border-line">
      <p className={clsx('text-xl font-bold', className)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ShareSection({ detail }: { detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const colId = detail.collection.id;
  const { data: shares } = useShares(colId);
  const create = useCreateShare(wsId, colId);
  const update = useUpdateShare(colId);
  const del = useDeleteShare(colId);
  const [expiry, setExpiry] = useState('');
  const linkFor = (token: string) => `${window.location.origin}/docs/${token}`;

  return (
    <div>
      <div className="rounded-xl border border-line bg-panel p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-fg">
            <Link2 className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Publish documentation</h3>
            <p className="mt-1 text-sm text-muted">
              Anyone with the link can read this collection’s docs — no account needed. Auth secrets and secret variables are masked automatically.
            </p>
            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select className="w-44" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                  <option value="">Never expires</option>
                  <option value="1">Expires in 1 day</option>
                  <option value="7">Expires in 7 days</option>
                  <option value="30">Expires in 30 days</option>
                  <option value="90">Expires in 90 days</option>
                </Select>
                <Button variant="primary" icon={<Plus className="size-4" />} loading={create.isPending} onClick={() => create.mutate({ expiresInDays: expiry ? Number(expiry) : null })}>
                  Create public link
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <h4 className="mb-3 mt-8 text-sm font-semibold">Active links</h4>
      {!shares?.length ? (
        <p className="rounded-xl bg-panel p-6 text-center text-sm text-faint border border-line">No public links yet.</p>
      ) : (
        <ul className="space-y-2">
          {shares.map((s) => (
            <li key={s.id} className="rounded-xl bg-panel p-4 border border-line">
              <div className="flex flex-wrap items-center gap-3">
                <Input readOnly value={linkFor(s.token)} className={clsx('min-w-64 flex-1 font-mono text-xs', !s.active && 'opacity-50')} onFocus={(e) => e.target.select()} />
                <CopyButton text={linkFor(s.token)} label="Copy link" />
                <a href={linkFor(s.token)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-panel-3 hover:text-fg">
                  <ExternalLink className="size-3.5" /> Open
                </a>
                {canEdit && (
                  <>
                    <Toggle checked={s.enabled} onChange={(enabled) => update.mutate({ id: s.id, enabled })} label="Link enabled" />
                    <button
                      className="rounded p-1.5 text-faint hover:text-danger cursor-pointer"
                      aria-label="Revoke link"
                      onClick={async () => {
                        if (await confirm({ title: 'Revoke this link?', message: 'People using it will lose access immediately.', confirmText: 'Revoke', danger: true })) del.mutate(s.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-faint">
                <span className={s.active ? 'text-success' : 'text-warning'}>{s.active ? '● Live' : s.enabled ? '● Expired' : '● Disabled'}</span>
                <span>{s.viewCount} views</span>
                <span>created {timeAgo(s.createdAt)}</span>
                {s.expiresAt && <span>expires {new Date(s.expiresAt).toLocaleDateString()}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-faint">
        <Copy className="size-3.5" /> Want to collaborate instead? Invite people from workspace Settings → Members.
      </p>
    </div>
  );
}
