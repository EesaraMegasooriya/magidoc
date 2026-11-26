/**
 * Decides where a request is sent from:
 *  - server: MagiDoc's backend (no CORS limits; can't reach a user's own machine/network)
 *  - agent:  the MagiDoc Local Agent on the user's computer (for localhost / LAN APIs)
 *  - browser: a direct fetch, used for local targets when no agent runs (works only if the API allows CORS)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, errorMessage } from './api';
import type { ExecutePayload } from '../api/hooks';
import type { ExecuteResponse } from '../types';

export const AGENT_PORT = 47321;
export const AGENT_URL = `http://127.0.0.1:${AGENT_PORT}`;
export const AGENT_FILE = '/magidoc-agent.mjs';

export type RunnerMode = 'auto' | 'server' | 'agent';
export type AgentStatus = 'unknown' | 'checking' | 'online' | 'offline';

interface RunnerState {
  mode: RunnerMode;
  agent: AgentStatus;
  agentVersion: string | null;
  setupOpen: boolean;
  setMode: (mode: RunnerMode) => void;
  setAgent: (agent: AgentStatus, version?: string | null) => void;
  openSetup: () => void;
  closeSetup: () => void;
}

export const useRunner = create<RunnerState>()(
  persist(
    (set) => ({
      mode: 'auto',
      agent: 'unknown',
      agentVersion: null,
      setupOpen: false,
      setMode: (mode) => set({ mode }),
      setAgent: (agent, version = null) => set({ agent, agentVersion: version }),
      openSetup: () => set({ setupOpen: true }),
      closeSetup: () => set({ setupOpen: false }),
    }),
    { name: 'magidoc-runner', partialize: (s) => ({ mode: s.mode }) },
  ),
);

/** Hosts the MagiDoc server can't (or mustn't) reach: the user's own machine and private networks. */
export function isLocalTarget(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `http://${rawUrl.trim()}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  host = host.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'host.docker.internal') return true;
  if (host === '0.0.0.0' || host === '::1' || host === '::') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return true; // IPv6 unique-local / link-local
  return false;
}

let lastCheck = 0;

/**
 * Probes the agent. Only called when it's actually needed (a local request, or the setup dialog),
 * because browsers may ask the user for permission the first time a site contacts localhost.
 */
export async function checkAgent(force = false): Promise<boolean> {
  const { agent, setAgent } = useRunner.getState();
  if (!force && agent === 'online' && Date.now() - lastCheck < 10_000) return true;
  setAgent('checking');
  try {
    const res = await fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(2500) });
    const body = (await res.json()) as { name?: string; version?: string };
    const ok = res.ok && body.name === 'magidoc-agent';
    lastCheck = Date.now();
    setAgent(ok ? 'online' : 'offline', ok ? (body.version ?? null) : null);
    return ok;
  } catch {
    setAgent('offline');
    return false;
  }
}

const failure = (error: string, via: ExecuteResponse['via'], durationMs = 0): ExecuteResponse => ({
  status: 0, statusText: 'Error', headers: [], body: '', bodyEncoding: 'text', contentType: null,
  durationMs, size: 0, truncated: false, error, via,
});

export const AGENT_HELP =
  'MagiDoc’s server can’t reach your own computer or network. Start the MagiDoc Local Agent on this computer ' +
  '(click “Local agent” in the toolbar), and allow access if your browser asks.';

async function viaAgent(payload: ExecutePayload): Promise<ExecuteResponse> {
  try {
    const res = await fetch(`${AGENT_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(130_000),
    });
    if (!res.ok) {
      const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error;
      return failure(`Local agent: ${msg ?? res.statusText}`, 'agent');
    }
    return { ...((await res.json()) as ExecuteResponse), via: 'agent' };
  } catch {
    useRunner.getState().setAgent('offline');
    return failure(`Lost connection to the Local Agent. ${AGENT_HELP}`, 'agent');
  }
}

const TEXTUAL = /^text\/|json|xml|javascript|x-www-form-urlencoded|graphql|yaml|csv|html/i;

/** Direct browser request: only works when the target API allows CORS from this site. */
async function viaBrowser(payload: ExecutePayload): Promise<ExecuteResponse> {
  const started = performance.now();
  const url = /^https?:\/\//i.test(payload.url) ? payload.url : `http://${payload.url}`;
  let body: BodyInit | undefined;
  const headers = new Headers();
  for (const h of payload.headers) {
    try {
      headers.append(h.key, h.value);
    } catch {
      /* browsers reject some header names; skip them */
    }
  }
  if (payload.body.mode === 'form-data') {
    const form = new FormData();
    for (const f of payload.body.fields ?? []) form.append(f.key, f.value);
    body = form;
    headers.delete('content-type');
  } else if (payload.body.mode === 'raw' && payload.method !== 'GET' && payload.method !== 'HEAD') {
    body = payload.body.raw;
  }
  try {
    const res = await fetch(url, { method: payload.method, headers, body, redirect: 'follow', signal: AbortSignal.timeout(60_000) });
    const contentType = res.headers.get('content-type');
    const buf = new Uint8Array(await res.arrayBuffer());
    const textual = !contentType || TEXTUAL.test(contentType);
    let text = '';
    if (textual) text = new TextDecoder().decode(buf);
    else {
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      text = btoa(bin);
    }
    const out: { key: string; value: string }[] = [];
    res.headers.forEach((value, key) => out.push({ key, value }));
    return {
      status: res.status, statusText: res.statusText, headers: out, body: text, bodyEncoding: textual ? 'text' : 'base64',
      contentType, durationMs: Math.round(performance.now() - started), size: buf.length, truncated: false, error: null, via: 'browser',
    };
  } catch {
    // CORS refusal, nothing listening, or the browser blocked access to the local network: all look the same.
    return failure(`Couldn’t reach ${new URL(url).host}. ${AGENT_HELP}`, 'browser', Math.round(performance.now() - started));
  }
}

/** Records client-side executions in the user's history (best effort). */
function recordHistory(wsId: string, payload: ExecutePayload, res: ExecuteResponse) {
  api
    .post(`/workspaces/${wsId}/history`, {
      method: payload.method,
      url: payload.url,
      requestId: payload.requestId ?? null,
      requestName: payload.requestName ?? null,
      statusCode: res.status || null,
      durationMs: res.durationMs,
      responseSize: res.size,
    })
    .catch(() => undefined);
}

/** Sends a request from the right place for its target and the user's runner setting. */
export async function runRequest(wsId: string, payload: ExecutePayload): Promise<ExecuteResponse> {
  const { mode } = useRunner.getState();
  const local = isLocalTarget(payload.url);
  const useLocal = mode === 'agent' || (mode === 'auto' && local);

  if (!useLocal) {
    try {
      const res = await api.post<ExecuteResponse>(`/workspaces/${wsId}/execute`, payload);
      const data = res.data;
      // The server refuses private addresses: point the user at the agent instead of a dead end.
      if (data.error?.includes('private network')) return { ...data, error: `${data.error}. ${AGENT_HELP}`, via: 'server' };
      return { ...data, via: 'server' };
    } catch (e) {
      return failure(errorMessage(e), 'server');
    }
  }

  const result = (await checkAgent()) ? await viaAgent(payload) : mode === 'agent' ? failure(`The Local Agent isn’t running. ${AGENT_HELP}`, 'agent') : await viaBrowser(payload);
  if (!result.error || result.status) recordHistory(wsId, payload, result);
  return result;
}
