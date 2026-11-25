import clsx from 'clsx';
import { ChevronRight, Folder as FolderIcon, Lock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeView, CopyButton, tryPrettyJson } from '../../components/CodeView';
import { Markdown } from '../../components/Markdown';
import { MethodPill, MethodText } from '../../components/MethodBadge';
import { generateSnippet, SNIPPET_LANGS, type SnippetLang } from '../../lib/codegen';
import { buildRequest, toDraft } from '../../lib/request';
import { buildTree, type TreeNode } from '../../lib/tree';
import { statusColor } from '../../lib/utils';
import { buildScope } from '../../lib/variables';
import type { ApiRequest, AuthConfig, CollectionDetail, KeyValue } from '../../types';

const AUTH_LABEL: Record<string, string> = {
  bearer: 'Bearer token',
  basic: 'Basic auth',
  apikey: 'API key',
};

export function DocsView({ detail, workspaceName }: { detail: CollectionDetail; workspaceName?: string }) {
  const { collection, folders, requests } = detail;
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState<SnippetLang>('curl');
  const tree = useMemo(() => buildTree(folders, requests), [folders, requests]);
  const scope = useMemo(
    () => buildScope([{ source: 'collection', vars: collection.variables.filter((v) => !v.secret) }]),
    [collection.variables],
  );
  const matches = (r: ApiRequest) => {
    const q = query.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.method.toLowerCase() === q;
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-panel/60 lg:flex">
        <div className="p-4">
          {workspaceName && <p className="text-xs uppercase tracking-wide text-faint">{workspaceName}</p>}
          <button onClick={() => scrollTo('docs-top')} className="mt-1 text-left font-semibold hover:text-accent-fg cursor-pointer">
            {collection.name}
          </button>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search endpoints"
              className="h-8 w-full rounded-lg bg-panel-2 pl-8 pr-3 text-sm border border-line placeholder:text-faint focus:outline-none focus:ring-accent/40"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-6">
          <NavNodes nodes={tree} depth={0} matches={matches} onPick={scrollTo} />
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <header id="docs-top" className="scroll-mt-6 border-b border-line pb-8">
            <h1 className="text-3xl font-bold tracking-tight">{collection.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {requests.length} endpoints · Updated {new Date(collection.updatedAt).toLocaleDateString()}
            </p>
            <Markdown className="mt-6">{collection.description}</Markdown>
            <AuthNote auth={collection.auth} prefix="This API uses" />
            {collection.variables.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Variables</h3>
                <ParamTable
                  rows={collection.variables.map((v) => ({ id: v.id, key: `{{${v.key}}}`, value: v.value, enabled: v.enabled, description: v.secret ? 'Secret' : undefined }))}
                />
              </div>
            )}
          </header>

          <div className="sticky top-0 z-10 -mx-6 flex items-center justify-end gap-1 border-b border-line bg-bg/90 px-6 py-2 backdrop-blur">
            <span className="mr-2 text-xs text-faint">Code samples</span>
            {SNIPPET_LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                className={clsx('rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer', lang === l.id ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg')}
              >
                {l.label}
              </button>
            ))}
          </div>

          <DocNodes nodes={tree} matches={matches} detail={detail} scope={scope} lang={lang} />
          {requests.length === 0 && <p className="py-16 text-center text-muted">This collection has no requests yet.</p>}
        </div>
      </div>
    </div>
  );
}

function NavNodes({ nodes, depth, matches, onPick }: { nodes: TreeNode[]; depth: number; matches: (r: ApiRequest) => boolean; onPick: (id: string) => void }) {
  return (
    <>
      {nodes.map((n) =>
        n.type === 'folder' ? (
          <div key={n.folder.id}>
            <button
              onClick={() => onPick(`folder-${n.folder.id}`)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg cursor-pointer"
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              <FolderIcon className="size-3.5" /> {n.folder.name}
            </button>
            <NavNodes nodes={n.children} depth={depth + 1} matches={matches} onPick={onPick} />
          </div>
        ) : matches(n.request) ? (
          <button
            key={n.request.id}
            onClick={() => onPick(`req-${n.request.id}`)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-panel-3 hover:text-fg cursor-pointer"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <MethodText method={n.request.method} className="w-9 shrink-0" />
            <span className="truncate">{n.request.name}</span>
          </button>
        ) : null,
      )}
    </>
  );
}

function DocNodes(props: { nodes: TreeNode[]; matches: (r: ApiRequest) => boolean; detail: CollectionDetail; scope: ReturnType<typeof buildScope>; lang: SnippetLang }) {
  return (
    <>
      {props.nodes.map((n) =>
        n.type === 'folder' ? (
          <section key={n.folder.id} id={`folder-${n.folder.id}`} className="scroll-mt-16 pt-12">
            <div className="flex items-center gap-2 text-accent-fg">
              <FolderIcon className="size-4" />
              <h2 className="text-xl font-bold text-fg">{n.folder.name}</h2>
            </div>
            <Markdown className="mt-3">{n.folder.description}</Markdown>
            <DocNodes {...props} nodes={n.children} />
          </section>
        ) : props.matches(n.request) ? (
          <Endpoint key={n.request.id} request={n.request} {...props} />
        ) : null,
      )}
    </>
  );
}

function Endpoint({ request: r, detail, scope, lang }: { request: ApiRequest; detail: CollectionDetail; scope: ReturnType<typeof buildScope>; lang: SnippetLang }) {
  const built = useMemo(() => buildRequest(toDraft(r), detail.collection.auth, scope), [r, detail.collection.auth, scope]);
  const snippet = useMemo(() => generateSnippet(lang, built), [lang, built]);
  const [example, setExample] = useState(0);
  const auth = r.auth.type === 'inherit' ? null : r.auth;
  const headers = r.headers.filter((h) => h.key);
  const params = r.queryParams.filter((p) => p.key);
  const bodyFields = r.body.fields.filter((f) => f.key);
  const ex = r.examples[example];

  return (
    <article id={`req-${r.id}`} className="scroll-mt-16 border-b border-line py-10">
      <div className="grid gap-8 xl:grid-cols-[1fr_minmax(0,460px)]">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{r.name}</h3>
          <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 border border-line">
            <MethodPill method={r.method} />
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{r.url}</code>
            <CopyButton text={r.url} label="" />
          </div>
          <Markdown className="mt-5">{r.description}</Markdown>
          {auth && <AuthNote auth={auth} prefix="Requires" />}
          {params.length > 0 && (
            <DocSection title="Query parameters">
              <ParamTable rows={params} />
            </DocSection>
          )}
          {headers.length > 0 && (
            <DocSection title="Headers">
              <ParamTable rows={headers} />
            </DocSection>
          )}
          {r.body.mode !== 'none' && (
            <DocSection title={`Request body · ${r.body.mode}`}>
              {r.body.mode === 'form-data' || r.body.mode === 'urlencoded' ? (
                <ParamTable rows={bodyFields} />
              ) : (
                <CodeView code={tryPrettyJson(r.body.raw) ?? r.body.raw} language={r.body.mode === 'json' ? 'json' : 'text'} lineNumbers={false} className="max-h-96" />
              )}
            </DocSection>
          )}
        </div>
        <div className="min-w-0 space-y-4 xl:sticky xl:top-16 xl:self-start">
          <div className="overflow-hidden rounded-xl bg-panel border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-medium text-muted">{SNIPPET_LANGS.find((l) => l.id === lang)?.label}</span>
              <CopyButton text={snippet} />
            </div>
            <CodeView code={snippet} lineNumbers={false} className="max-h-80 rounded-none ring-0" />
          </div>
          {r.examples.length > 0 && ex && (
            <div className="overflow-hidden rounded-xl bg-panel border border-line">
              <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
                {r.examples.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => setExample(i)}
                    className={clsx('flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer', i === example ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg')}
                  >
                    <span className={clsx('font-mono font-semibold', statusColor(e.status))}>{e.status}</span>
                    <span className="max-w-32 truncate">{e.name}</span>
                  </button>
                ))}
              </div>
              <CodeView
                code={tryPrettyJson(ex.body) ?? ex.body}
                language={tryPrettyJson(ex.body) ? 'json' : 'text'}
                lineNumbers={false}
                className="max-h-80 rounded-none ring-0"
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
        <ChevronRight className="size-3.5 text-accent-fg" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function AuthNote({ auth, prefix }: { auth: AuthConfig; prefix: string }) {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return null;
  return (
    <div className="mt-5 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
      <Lock className="size-3.5" />
      {prefix} <strong>{AUTH_LABEL[auth.type] ?? auth.type}</strong>
      {auth.type === 'apikey' && auth.key && (
        <span className="text-warning">
          — <code className="font-mono">{auth.key}</code> in {auth.in === 'query' ? 'query string' : 'header'}
        </span>
      )}
    </div>
  );
}

function ParamTable({ rows }: { rows: KeyValue[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-line first:border-t-0">
              <td className="w-1/3 bg-panel-2/50 px-3 py-2 align-top">
                <code className="font-mono text-[12.5px] text-accent-fg">{p.key}</code>
                {!p.enabled && <span className="ml-2 text-[10px] uppercase text-faint">optional</span>}
              </td>
              <td className="px-3 py-2 align-top">
                {p.value && <code className="break-all font-mono text-[12.5px] text-success">{p.value}</code>}
                {p.description && <p className="mt-0.5 text-xs text-muted">{p.description}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
