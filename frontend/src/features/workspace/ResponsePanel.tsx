import clsx from 'clsx';
import { AlertTriangle, BookmarkPlus, Download, Laptop, Send, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeView, CopyButton, tryPrettyJson } from '../../components/CodeView';
import { Button, Segmented, Spinner } from '../../components/ui';
import { useRunner } from '../../lib/runner';
import { formatBytes, statusColor } from '../../lib/utils';
import type { ExecuteResponse } from '../../types';

type View = 'pretty' | 'raw' | 'preview';

export function ResponsePanel({
  loading,
  response,
  onSaveExample,
}: {
  loading: boolean;
  response?: ExecuteResponse;
  onSaveExample?: () => void;
}) {
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const openSetup = useRunner((s) => s.openSetup);
  const [view, setView] = useState<View>('pretty');

  const ct = response?.contentType?.toLowerCase() ?? '';
  const isImage = ct.startsWith('image/') && response?.bodyEncoding === 'base64';
  const isHtml = ct.includes('html');
  const pretty = useMemo(() => (response && response.bodyEncoding === 'text' ? tryPrettyJson(response.body) : null), [response]);

  if (loading && !response) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        <Spinner className="size-6" />
        <p className="text-sm">Sending request…</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent-fg">
          <Send className="size-5" />
        </div>
        <p className="text-sm text-muted">
          Hit <strong className="text-fg">Send</strong> to see the response
        </p>
        <p className="text-xs text-faint">
          <kbd className="rounded bg-panel-3 px-1.5 py-0.5 font-mono">⌘/Ctrl</kbd> + <kbd className="rounded bg-panel-3 px-1.5 py-0.5 font-mono">Enter</kbd>
        </p>
      </div>
    );
  }

  if (response.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="size-5" />
        </div>
        <p className="font-medium">Could not send request</p>
        <p className="max-w-lg text-sm text-danger">{response.error}</p>
        {response.durationMs > 0 && <p className="text-xs text-faint">after {response.durationMs} ms</p>}
        {response.error.includes('Local Agent') && (
          <Button variant="primary" size="sm" icon={<Laptop />} onClick={openSetup}>
            Set up Local Agent
          </Button>
        )}
      </div>
    );
  }

  const body = response.bodyEncoding === 'base64' && !isImage ? '[binary content — download to view]' : response.body;
  const download = () => {
    const bytes =
      response.bodyEncoding === 'base64' ? Uint8Array.from(atob(response.body), (c) => c.charCodeAt(0)) : new TextEncoder().encode(response.body);
    const url = URL.createObjectURL(new Blob([bytes], { type: response.contentType ?? 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'response';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-1.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'body', label: 'Body' },
            { value: 'headers', label: 'Headers', count: response.headers.length },
          ]}
        />
        <div className="ml-auto flex items-center gap-3 text-xs">
          {loading && <Spinner className="size-3.5" />}
          {response.via && response.via !== 'server' && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-3 px-1.5 py-0.5 text-[11px] text-muted" title={response.via === 'agent' ? 'Sent by the Local Agent on your computer' : 'Sent directly from your browser'}>
              <Laptop className="size-3" /> {response.via === 'agent' ? 'via Local Agent' : 'via browser'}
            </span>
          )}
          <span className={clsx('font-mono font-semibold', statusColor(response.status))}>
            {response.status} {response.statusText}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <Zap className="size-3" />
            {response.durationMs} ms
          </span>
          <span className="text-muted">{formatBytes(response.size)}</span>
          {response.truncated && <span className="text-warning">truncated</span>}
        </div>
      </div>

      {tab === 'body' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-4 py-2">
            <Segmented variant="pill"
              value={view}
              onChange={setView}
              options={[
                { value: 'pretty', label: 'Pretty' },
                { value: 'raw', label: 'Raw' },
                ...(isHtml || isImage ? [{ value: 'preview' as View, label: 'Preview' }] : []),
              ]}
            />
            <div className="ml-auto flex items-center gap-1">
              {onSaveExample && (
                <Button size="sm" variant="ghost" icon={<BookmarkPlus className="size-3.5" />} onClick={onSaveExample} title="Save this response as a documentation example">
                  Save as example
                </Button>
              )}
              <CopyButton text={response.body} />
              <button onClick={download} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-panel-3 hover:text-fg cursor-pointer">
                <Download className="size-3.5" /> Save
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-4 pb-4">
            {view === 'preview' && isImage ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-bg border border-line">
                <img src={`data:${response.contentType};base64,${response.body}`} alt="Response preview" className="max-h-full max-w-full" />
              </div>
            ) : view === 'preview' && isHtml ? (
              <iframe title="HTML preview" sandbox="" srcDoc={response.body} className="h-full w-full rounded-lg border border-line bg-white" />
            ) : (
              <CodeView
                className="h-full"
                code={view === 'pretty' && pretty ? pretty : body}
                language={view === 'pretty' && pretty ? 'json' : 'text'}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <table className="w-full text-sm">
            <tbody>
              {response.headers.map((h, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="w-1/3 py-1.5 pr-4 align-top font-mono text-[12.5px] text-accent-fg">{h.key}</td>
                  <td className="break-all py-1.5 font-mono text-[12.5px] text-fg">{h.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
