import type { HttpMethod, KeyValue, Variable } from '../types';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const emptyKv = (): KeyValue => ({ id: uid(), key: '', value: '', enabled: true });

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-m-get',
  POST: 'text-m-post',
  PUT: 'text-m-put',
  PATCH: 'text-m-patch',
  DELETE: 'text-m-delete',
  HEAD: 'text-m-head',
  OPTIONS: 'text-m-options',
};

export const METHOD_BG: Record<HttpMethod, string> = {
  GET: 'bg-m-get/10 text-m-get',
  POST: 'bg-m-post/10 text-m-post',
  PUT: 'bg-m-put/10 text-m-put',
  PATCH: 'bg-m-patch/10 text-m-patch',
  DELETE: 'bg-m-delete/10 text-m-delete',
  HEAD: 'bg-m-head/10 text-m-head',
  OPTIONS: 'bg-m-options/10 text-m-options',
};

export function statusColor(status: number): string {
  if (status === 0) return 'text-danger';
  if (status < 300) return 'text-success';
  if (status < 400) return 'text-info';
  if (status < 500) return 'text-warning';
  return 'text-danger';
}

export function statusTone(status: number): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 0 || status >= 500) return 'danger';
  if (status < 300) return 'success';
  if (status < 400) return 'info';
  return 'warning';
}

/** Ensures every key/value row has an id and the expected fields (data may come from imports). */
export function normalizeKv(rows: unknown): KeyValue[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r === 'object')
    .map((r: Record<string, unknown>) => ({
      id: typeof r.id === 'string' && r.id ? r.id : uid(),
      key: String(r.key ?? ''),
      value: String(r.value ?? ''),
      enabled: r.enabled !== false,
      description: typeof r.description === 'string' ? r.description : undefined,
    }));
}

export function normalizeVars(rows: unknown): Variable[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r === 'object')
    .map((r: Record<string, unknown>) => ({
      id: typeof r.id === 'string' && r.id ? r.id : uid(),
      key: String(r.key ?? ''),
      value: String(r.value ?? ''),
      enabled: r.enabled !== false,
      secret: r.secret === true,
    }));
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'collection';

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
