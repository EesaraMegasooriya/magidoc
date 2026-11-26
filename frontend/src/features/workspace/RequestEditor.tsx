import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Code2, Laptop, Loader2, Save, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keys, useSaveRequest } from '../../api/hooks';
import { isLocalTarget, runRequest, useRunner } from '../../lib/runner';
import { KeyValueEditor } from '../../components/KeyValueEditor';
import { Markdown } from '../../components/Markdown';
import { Button, Segmented } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { buildRequest, effectiveAuth, paramsFromUrl, sameDraft, urlFromParams } from '../../lib/request';
import { folderPath } from '../../lib/tree';
import { METHOD_COLORS, uid } from '../../lib/utils';
import { collectVariables } from '../../lib/variables';
import { VariableChips } from '../../components/VariableChips';
import { VariableInput } from '../../components/VariableInput';
import { prompt } from '../../store/confirm';
import { useWorkspaceStore } from '../../store/workspace';
import { HTTP_METHODS, type ApiRequest, type CollectionDetail, type HttpMethod, type RequestDraft } from '../../types';
import { AuthEditor } from './AuthEditor';
import { BodyEditor, CodeTextarea } from './BodyEditor';
import { ResponsePanel } from './ResponsePanel';
import { SnippetModal } from './SnippetModal';
import { useScope, useWs } from './context';

type Section = 'params' | 'headers' | 'body' | 'auth' | 'docs';

export function RequestEditor({
  draftId,
  base,
  request,
  detail,
  onSave,
  saving,
}: {
  draftId: string;
  base: RequestDraft;
  request?: ApiRequest;
  detail?: CollectionDetail;
  onSave: (draft: RequestDraft) => void;
  saving?: boolean;
}) {
  const { wsId, canEdit } = useWs();
  const qc = useQueryClient();
  const stored = useWorkspaceStore((s) => s.drafts[draftId]);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const respState = useWorkspaceStore((s) => s.responses[draftId]);
  const setResponse = useWorkspaceStore((s) => s.setResponse);
  const saveRequest = useSaveRequest(wsId);
  const draft = stored ?? base;
  const dirty = !!stored && !sameDraft(stored, base);
  const readOnly = !canEdit && !!request;
  const scope = useScope(detail);

  const [section, setSection] = useState<Section>('params');
  const [docMode, setDocMode] = useState<'write' | 'preview'>('preview');
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [split, setSplit] = useState(() => {
    try {
      return Number(localStorage.getItem('magidoc-split')) || 0.5;
    } catch {
      return 0.5;
    }
  });
  const container = useRef<HTMLDivElement>(null);

  const update = useCallback((patch: Partial<RequestDraft>) => setDraft(draftId, { ...draft, ...patch }), [draft, draftId, setDraft]);

  const built = useMemo(() => buildRequest(draft, detail?.collection.auth, scope), [draft, detail, scope]);
  const runnerMode = useRunner((s) => s.mode);
  const openSetup = useRunner((s) => s.openSetup);
  const sendsLocally = !!built.url && (runnerMode === 'agent' || (runnerMode === 'auto' && isLocalTarget(built.url)));
  /** Every variable the request will actually send (mirrors buildRequest: no body on GET/HEAD). */
  const usedVars = useMemo(() => {
    const auth = effectiveAuth(draft, detail?.collection.auth);
    const sendsBody = draft.method !== 'GET' && draft.method !== 'HEAD' && draft.body.mode !== 'none';
    const fieldBody = draft.body.mode === 'form-data' || draft.body.mode === 'urlencoded';
    const texts = [
      draft.url,
      ...draft.headers.filter((h) => h.enabled).flatMap((h) => [h.key, h.value]),
      ...(sendsBody && !fieldBody ? [draft.body.raw] : []),
      ...(sendsBody && fieldBody ? draft.body.fields.filter((f) => f.enabled).flatMap((f) => [f.key, f.value]) : []),
      ...(auth.type === 'bearer' ? [auth.token ?? ''] : []),
      ...(auth.type === 'basic' ? [auth.username ?? '', auth.password ?? ''] : []),
      ...(auth.type === 'apikey' ? [auth.key ?? '', auth.value ?? ''] : []),
    ];
    return collectVariables(texts, scope);
  }, [draft, scope, detail]);

  const send = useCallback(async () => {
    if (!draft.url.trim()) return;
    setResponse(draftId, { loading: true, response: respState?.response });
    try {
      const res = await runRequest(wsId, {
        method: built.method,
        url: built.url,
        headers: built.headers,
        body: built.body,
        requestId: request?.id ?? null,
        requestName: draft.name,
      });
      setResponse(draftId, { loading: false, response: res });
    } catch (e) {
      setResponse(draftId, {
        loading: false,
        response: { status: 0, statusText: 'Error', headers: [], body: '', bodyEncoding: 'text', contentType: null, durationMs: 0, size: 0, truncated: false, error: errorMessage(e) },
      });
    }
    qc.invalidateQueries({ queryKey: keys.history(wsId) });
  }, [built, draft, draftId, qc, request?.id, respState?.response, setResponse, wsId]);

  const save = useCallback(() => {
    if (readOnly) return;
    onSave(draft);
  }, [draft, onSave, readOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send, save]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    const move = (ev: MouseEvent) => {
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientY - rect.top) / rect.height));
      setSplit(ratio);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setSplit((v) => {
        try {
          localStorage.setItem('magidoc-split', String(v));
        } catch {
          /* storage unavailable */
        }
        return v;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const saveExample = async () => {
    const res = respState?.response;
    if (!request || !res) return;
    const name = await prompt({ title: 'Save response as example', label: 'Example name', initial: `${res.status} ${res.statusText}`.trim(), confirmText: 'Save example' });
    if (!name) return;
    const examples = [
      ...request.examples,
      { id: uid(), name, status: res.status, body: res.bodyEncoding === 'text' ? res.body : '[binary]', contentType: res.contentType, createdAt: new Date().toISOString() },
    ];
    saveRequest.mutate({ id: request.id, draft: {}, examples });
  };

  const crumbs = detail ? [detail.collection.name, folderPath(detail.folders, request?.folderId ?? null)].filter(Boolean).join(' / ') : 'Unsaved request';
  const resolvedUrl = built.url !== draft.url.trim() ? built.url : null;
  const enabledCount = (rows: { enabled: boolean; key: string }[]) => rows.filter((r) => r.enabled && r.key).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Title row */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-faint">{crumbs}</p>
          <input
            value={draft.name}
            readOnly={readOnly}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full truncate bg-transparent text-sm font-semibold focus:outline-none"
            aria-label="Request name"
          />
        </div>
        <Button size="sm" variant="ghost" icon={<Code2 className="size-3.5" />} onClick={() => setSnippetOpen(true)}>
          Code
        </Button>
        {!readOnly && (
          <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon={<Save className="size-3.5" />} loading={saving} onClick={save} title="Save (⌘/Ctrl+S)">
            Save
          </Button>
        )}
      </div>

      <div ref={container} className="flex min-h-0 flex-1 flex-col">
        {/* Request config */}
        <div className="flex min-h-0 flex-col" style={{ height: `${split * 100}%` }}>
          <div className="px-4 pt-3">
            <div className="flex items-stretch overflow-hidden rounded-lg bg-panel-2 border border-line focus-within:ring-accent/40">
              <select
                value={draft.method}
                disabled={readOnly}
                onChange={(e) => update({ method: e.target.value as HttpMethod })}
                className={clsx('w-28 cursor-pointer border-r border-line bg-transparent px-3 font-mono text-[13px] font-bold focus:outline-none', METHOD_COLORS[draft.method])}
                aria-label="HTTP method"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m} className="bg-panel-2 text-fg">
                    {m}
                  </option>
                ))}
              </select>
              <VariableInput
                scope={scope}
                value={draft.url}
                readOnly={readOnly}
                onChange={(e) => update({ url: e.target.value, queryParams: paramsFromUrl(e.target.value, draft.queryParams) })}
                placeholder="https://api.example.com/v1/users  —  use {{variables}}"
                spellCheck={false}
                wrapperClassName="flex-1"
                className="h-10 bg-transparent text-fg placeholder:text-faint focus:outline-none"
                textClassName="px-3 font-mono text-[13px]"
                aria-label="Request URL"
              />
              <button
                onClick={send}
                disabled={!draft.url.trim() || respState?.loading}
                className="m-1 flex items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-semibold text-on-accent shadow-sm transition-colors hover:bg-accent-strong disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1"
                title="Send (⌘/Ctrl+Enter)"
              >
                {respState?.loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send
              </button>
            </div>
            <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-2 text-[11px]">
              {resolvedUrl && <span className="truncate font-mono text-faint" title={resolvedUrl}>→ {resolvedUrl}</span>}
              {sendsLocally && (
                <button
                  type="button"
                  onClick={openSetup}
                  className="inline-flex items-center gap-1 rounded bg-panel-3 px-1.5 py-0.5 text-muted hover:text-fg cursor-pointer"
                  title="This address is on your computer or network, so it's sent from your machine (Local Agent)"
                >
                  <Laptop className="size-3" /> sent from your computer
                </button>
              )}
              <VariableChips vars={usedVars} />
            </div>
          </div>

          <div className="border-b border-line px-3 pt-1">
            <Segmented
              value={section}
              onChange={setSection}
              options={[
                { value: 'params', label: 'Params', count: enabledCount(draft.queryParams) },
                { value: 'headers', label: 'Headers', count: enabledCount(draft.headers) },
                { value: 'body', label: 'Body', count: draft.body.mode !== 'none' ? 1 : 0 },
                { value: 'auth', label: 'Auth' },
                { value: 'docs', label: 'Docs' },
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {section === 'params' && (
              <KeyValueEditor
                rows={draft.queryParams}
                readOnly={readOnly}
                scope={scope}
                onChange={(queryParams) => update({ queryParams, url: urlFromParams(draft.url, queryParams) })}
              />
            )}
            {section === 'headers' && <KeyValueEditor rows={draft.headers} readOnly={readOnly} scope={scope} onChange={(headers) => update({ headers })} />}
            {section === 'body' && (
              <BodyEditor
                body={draft.body}
                readOnly={readOnly}
                scope={scope}
                onChange={(body) => update({ body })}
                disabledReason={draft.method === 'GET' || draft.method === 'HEAD' ? `${draft.method} requests are sent without a body.` : undefined}
              />
            )}
            {section === 'auth' && <AuthEditor value={draft.auth} readOnly={readOnly} scope={scope} inherited={detail?.collection.auth} onChange={(auth) => update({ auth })} />}
            {section === 'docs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">Markdown documentation shown in shared docs.</p>
                  {!readOnly && (
                    <Segmented variant="pill"
                      value={docMode}
                      onChange={setDocMode}
                      options={[
                        { value: 'write', label: 'Write' },
                        { value: 'preview', label: 'Preview' },
                      ]}
                    />
                  )}
                </div>
                {docMode === 'write' && !readOnly ? (
                  <CodeTextarea value={draft.description} onChange={(description) => update({ description })} placeholder="## What this endpoint does…" className="min-h-48 font-sans" />
                ) : draft.description.trim() ? (
                  <Markdown>{draft.description}</Markdown>
                ) : (
                  <p className="py-6 text-center text-sm text-faint">No documentation yet{!readOnly && ' — switch to Write to add some'}.</p>
                )}
                {request && request.examples.length > 0 && (
                  <div className="pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Saved examples</p>
                    <ul className="space-y-1.5">
                      {request.examples.map((ex) => (
                        <li key={ex.id} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm border border-line">
                          <span className="font-mono text-xs font-semibold text-success">{ex.status}</span>
                          <span className="flex-1 truncate">{ex.name}</span>
                          {!readOnly && (
                            <button
                              className="text-xs text-faint hover:text-danger cursor-pointer"
                              onClick={() => saveRequest.mutate({ id: request.id, draft: {}, examples: request.examples.filter((e) => e.id !== ex.id) })}
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div onMouseDown={startDrag} className="group relative h-1.5 shrink-0 cursor-row-resize border-y border-line bg-panel hover:bg-accent/30" role="separator" aria-label="Resize panels">
          <span className="absolute left-1/2 top-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong group-hover:bg-accent" />
        </div>

        <div className="min-h-0 flex-1">
          <ResponsePanel
            loading={!!respState?.loading}
            response={respState?.response}
            onSaveExample={request && canEdit && respState?.response && !respState.response.error ? saveExample : undefined}
          />
        </div>
      </div>

      {snippetOpen && <SnippetModal built={built} onClose={() => setSnippetOpen(false)} />}
    </div>
  );
}

