import type { ApiRequest, AuthConfig, KeyValue, RequestBody, RequestDraft } from '../types';
import { emptyKv, normalizeKv, uid } from './utils';
import { resolve, type VarMap } from './variables';

export const DEFAULT_BODY: RequestBody = { mode: 'none', raw: '', fields: [] };

export function toDraft(r: ApiRequest): RequestDraft {
  return {
    name: r.name,
    method: r.method,
    url: r.url,
    description: r.description,
    headers: r.headers,
    queryParams: r.queryParams,
    body: r.body,
    auth: r.auth,
  };
}

export function newDraft(): RequestDraft {
  return {
    name: 'Untitled request',
    method: 'GET',
    url: '',
    description: '',
    headers: [],
    queryParams: [],
    body: { ...DEFAULT_BODY },
    auth: { type: 'inherit' },
  };
}

export function normalizeRequest(r: ApiRequest): ApiRequest {
  const body = (r.body ?? {}) as Partial<RequestBody>;
  return {
    ...r,
    description: r.description ?? '',
    headers: normalizeKv(r.headers),
    queryParams: normalizeKv(r.queryParams),
    body: { mode: body.mode ?? 'none', raw: body.raw ?? '', fields: normalizeKv(body.fields) },
    auth: (r.auth && typeof r.auth === 'object' ? r.auth : { type: 'inherit' }) as AuthConfig,
    examples: Array.isArray(r.examples) ? r.examples : [],
  };
}

export const sameDraft = (a: RequestDraft, b: RequestDraft) => JSON.stringify(a) === JSON.stringify(b);

// ---------- URL <-> query param sync ----------

export function splitUrl(url: string): { base: string; query: string } {
  const i = url.indexOf('?');
  return i === -1 ? { base: url, query: '' } : { base: url.slice(0, i), query: url.slice(i + 1) };
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

export function parseQuery(query: string): { key: string; value: string }[] {
  if (!query) return [];
  return query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf('=');
      return i === -1
        ? { key: safeDecode(pair), value: '' }
        : { key: safeDecode(pair.slice(0, i)), value: safeDecode(pair.slice(i + 1)) };
    });
}

const encodePart = (s: string) =>
  // keep {{variables}} readable while encoding everything else that would break the URL
  s
    .split(/(\{\{[^}]*\}\})/g)
    .map((part) => (part.startsWith('{{') ? part : encodeURIComponent(part)))
    .join('');

export function buildQuery(params: KeyValue[]): string {
  return params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${encodePart(p.key)}${p.value !== '' ? `=${encodePart(p.value)}` : ''}`)
    .join('&');
}

/** User typed in the URL bar: re-derive enabled params, keep disabled ones. */
export function paramsFromUrl(url: string, current: KeyValue[]): KeyValue[] {
  const parsed = parseQuery(splitUrl(url).query);
  const enabled = parsed.map((p, i) => {
    const prev = current.filter((c) => c.enabled)[i];
    return { id: prev?.id ?? uid(), key: p.key, value: p.value, enabled: true, description: prev?.description };
  });
  return [...enabled, ...current.filter((c) => !c.enabled)];
}

/** User edited the params table: rebuild the URL's query string. */
export function urlFromParams(url: string, params: KeyValue[]): string {
  const q = buildQuery(params);
  const { base } = splitUrl(url);
  return q ? `${base}?${q}` : base;
}

// ---------- Build the final request ----------

export interface BuiltRequest {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: { mode: 'none' | 'raw' | 'form-data'; raw?: string; fields?: { key: string; value: string }[] };
  bodyMode: RequestBody['mode'];
}

const CONTENT_TYPES: Partial<Record<RequestBody['mode'], string>> = {
  json: 'application/json',
  text: 'text/plain',
  xml: 'application/xml',
  html: 'text/html',
  urlencoded: 'application/x-www-form-urlencoded',
};

function utf8Base64(s: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export function effectiveAuth(draft: RequestDraft, collectionAuth: AuthConfig | undefined): AuthConfig {
  return draft.auth.type === 'inherit' ? (collectionAuth ?? { type: 'none' }) : draft.auth;
}

export function buildRequest(draft: RequestDraft, collectionAuth: AuthConfig | undefined, scope: VarMap): BuiltRequest {
  const r = (s: string | undefined) => resolve(s ?? '', scope);
  let url = r(draft.url).trim();
  const headers = draft.headers
    .filter((h) => h.enabled && h.key.trim())
    .map((h) => ({ key: r(h.key).trim(), value: r(h.value) }));
  const hasHeader = (name: string) => headers.some((h) => h.key.toLowerCase() === name.toLowerCase());

  const auth = effectiveAuth(draft, collectionAuth);
  if (auth.type === 'bearer' && auth.token) {
    if (!hasHeader('authorization')) headers.push({ key: 'Authorization', value: `Bearer ${r(auth.token)}` });
  } else if (auth.type === 'basic' && (auth.username || auth.password)) {
    if (!hasHeader('authorization'))
      headers.push({ key: 'Authorization', value: `Basic ${utf8Base64(`${r(auth.username)}:${r(auth.password)}`)}` });
  } else if (auth.type === 'apikey' && auth.key) {
    if (auth.in === 'query') {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}${encodeURIComponent(r(auth.key))}=${encodeURIComponent(r(auth.value))}`;
    } else if (!hasHeader(r(auth.key))) {
      headers.push({ key: r(auth.key), value: r(auth.value) });
    }
  }

  const mode = draft.body.mode;
  let body: BuiltRequest['body'] = { mode: 'none' };
  if (draft.method !== 'GET' && draft.method !== 'HEAD') {
    if (mode === 'form-data') {
      body = {
        mode: 'form-data',
        fields: draft.body.fields.filter((f) => f.enabled && f.key).map((f) => ({ key: r(f.key), value: r(f.value) })),
      };
    } else if (mode === 'urlencoded') {
      const raw = draft.body.fields
        .filter((f) => f.enabled && f.key)
        .map((f) => `${encodeURIComponent(r(f.key))}=${encodeURIComponent(r(f.value))}`)
        .join('&');
      body = { mode: 'raw', raw };
    } else if (mode !== 'none') {
      body = { mode: 'raw', raw: r(draft.body.raw) };
    }
    const ct = CONTENT_TYPES[mode];
    if (ct && !hasHeader('content-type')) headers.push({ key: 'Content-Type', value: ct });
  }

  return { method: draft.method, url, headers, body, bodyMode: mode };
}

export { emptyKv };
