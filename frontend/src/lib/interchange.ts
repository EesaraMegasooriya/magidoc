/* Import / export between MagiDoc, Postman v2.1, OpenAPI 3 / Swagger 2 and cURL. */
import { parse as parseYaml } from 'yaml';
import type { AuthConfig, BodyMode, ExportCollection, ExportItem, HttpMethod, KeyValue, RequestDraft } from '../types';
import { HTTP_METHODS } from '../types';
import { newDraft, paramsFromUrl } from './request';
import { uid } from './utils';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ImportFormat = 'magidoc' | 'postman' | 'openapi';

export function parseImport(text: string): { format: ImportFormat; collection: ExportCollection } {
  let doc: Json;
  try {
    doc = JSON.parse(text);
  } catch {
    try {
      doc = parseYaml(text);
    } catch {
      throw new Error('The file is not valid JSON or YAML');
    }
  }
  if (!doc || typeof doc !== 'object') throw new Error('Unrecognised file');
  if (doc.magidoc) return { format: 'magidoc', collection: doc as ExportCollection };
  if (doc.openapi || doc.swagger) return { format: 'openapi', collection: fromOpenApi(doc) };
  if (doc.info && Array.isArray(doc.item)) return { format: 'postman', collection: fromPostman(doc) };
  throw new Error('Unsupported format. Use a MagiDoc export, Postman v2.1 collection or OpenAPI/Swagger spec.');
}

// ---------------- Postman ----------------

const text = (d: unknown): string =>
  typeof d === 'string' ? d : d && typeof d === 'object' && 'content' in d ? String((d as Json).content ?? '') : '';

function pmGet(arr: unknown, key: string): string | undefined {
  if (Array.isArray(arr)) return arr.find((x) => x?.key === key)?.value;
  if (arr && typeof arr === 'object') return (arr as Json)[key];
  return undefined;
}

function pmAuth(a: Json | undefined): AuthConfig | undefined {
  if (!a || !a.type) return undefined;
  switch (a.type) {
    case 'noauth':
      return { type: 'none' };
    case 'bearer':
      return { type: 'bearer', token: String(pmGet(a.bearer, 'token') ?? '') };
    case 'basic':
      return {
        type: 'basic',
        username: String(pmGet(a.basic, 'username') ?? ''),
        password: String(pmGet(a.basic, 'password') ?? ''),
      };
    case 'apikey':
      return {
        type: 'apikey',
        key: String(pmGet(a.apikey, 'key') ?? ''),
        value: String(pmGet(a.apikey, 'value') ?? ''),
        in: pmGet(a.apikey, 'in') === 'query' ? 'query' : 'header',
      };
    default:
      return { type: 'none' };
  }
}

const pmKv = (rows: unknown): KeyValue[] =>
  Array.isArray(rows)
    ? rows
        .filter((r) => r && typeof r === 'object' && r.type !== 'file')
        .map((r) => ({
          id: uid(),
          key: String(r.key ?? ''),
          value: String(r.value ?? ''),
          enabled: !r.disabled,
          description: text(r.description) || undefined,
        }))
    : [];

function pmItem(it: Json): ExportItem {
  if (Array.isArray(it.item)) {
    return { type: 'folder', name: it.name ?? 'Folder', description: text(it.description), items: it.item.map(pmItem) };
  }
  const r: Json = typeof it.request === 'string' ? { url: it.request, method: 'GET' } : (it.request ?? {});
  const url = typeof r.url === 'string' ? r.url : (r.url?.raw ?? '');
  const query = pmKv(typeof r.url === 'object' ? r.url?.query : []);
  let body: { mode: BodyMode; raw: string; fields: KeyValue[] } = { mode: 'none', raw: '', fields: [] };
  if (r.body?.mode === 'raw') {
    const lang = r.body?.options?.raw?.language;
    const mode: BodyMode = lang === 'json' || lang === 'xml' || lang === 'html' ? lang : looksJson(r.body.raw) ? 'json' : 'text';
    body = { mode, raw: String(r.body.raw ?? ''), fields: [] };
  } else if (r.body?.mode === 'urlencoded') {
    body = { mode: 'urlencoded', raw: '', fields: pmKv(r.body.urlencoded) };
  } else if (r.body?.mode === 'formdata') {
    body = { mode: 'form-data', raw: '', fields: pmKv(r.body.formdata) };
  } else if (r.body?.mode === 'graphql') {
    body = { mode: 'json', raw: JSON.stringify(r.body.graphql ?? {}, null, 2), fields: [] };
  }
  const examples = Array.isArray(it.response)
    ? it.response.map((ex: Json) => ({
        id: uid(),
        name: ex.name ?? 'Example',
        status: Number(ex.code ?? 200),
        body: String(ex.body ?? ''),
        contentType: pmKv(ex.header).find((h) => h.key.toLowerCase() === 'content-type')?.value ?? null,
        createdAt: new Date().toISOString(),
      }))
    : [];
  return {
    type: 'request',
    name: it.name ?? url ?? 'Request',
    description: text(r.description),
    method: normalizeMethod(r.method),
    url,
    headers: pmKv(r.header),
    queryParams: query,
    body,
    auth: pmAuth(r.auth) ?? { type: 'inherit' },
    examples,
  };
}

export function fromPostman(pm: Json): ExportCollection {
  return {
    magidoc: '1.0',
    name: pm.info?.name ?? 'Imported collection',
    description: text(pm.info?.description),
    variables: (Array.isArray(pm.variable) ? pm.variable : []).map((v: Json) => ({
      id: uid(),
      key: String(v.key ?? ''),
      value: String(v.value ?? ''),
      enabled: !v.disabled,
      secret: v.type === 'secret',
    })),
    auth: pmAuth(pm.auth) ?? { type: 'none' },
    items: pm.item.map(pmItem),
  };
}

function toPmAuth(a: AuthConfig | undefined): Json | undefined {
  if (!a || a.type === 'inherit') return undefined;
  switch (a.type) {
    case 'none':
      return { type: 'noauth' };
    case 'bearer':
      return { type: 'bearer', bearer: [{ key: 'token', value: a.token ?? '', type: 'string' }] };
    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: a.username ?? '', type: 'string' },
          { key: 'password', value: a.password ?? '', type: 'string' },
        ],
      };
    case 'apikey':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: a.key ?? '', type: 'string' },
          { key: 'value', value: a.value ?? '', type: 'string' },
          { key: 'in', value: a.in ?? 'header', type: 'string' },
        ],
      };
  }
}

const toPmKv = (rows: unknown) =>
  (Array.isArray(rows) ? rows : []).map((r: Json) => ({
    key: r.key,
    value: r.value,
    disabled: r.enabled === false || undefined,
    description: r.description,
  }));

function toPmItem(it: ExportItem): Json {
  if (it.type === 'folder') return { name: it.name, description: it.description ?? '', item: (it.items ?? []).map(toPmItem) };
  const body = (it.body ?? { mode: 'none' }) as { mode: BodyMode; raw?: string; fields?: unknown };
  let pmBody: Json | undefined;
  if (body.mode === 'urlencoded') pmBody = { mode: 'urlencoded', urlencoded: toPmKv(body.fields) };
  else if (body.mode === 'form-data') pmBody = { mode: 'formdata', formdata: toPmKv(body.fields).map((f) => ({ ...f, type: 'text' })) };
  else if (body.mode !== 'none') pmBody = { mode: 'raw', raw: body.raw ?? '', options: { raw: { language: body.mode } } };
  return {
    name: it.name,
    request: {
      method: it.method,
      header: toPmKv(it.headers),
      url: { raw: it.url, query: toPmKv(it.queryParams) },
      body: pmBody,
      auth: toPmAuth(it.auth as AuthConfig),
      description: it.description ?? '',
    },
    response: (Array.isArray(it.examples) ? it.examples : []).map((ex: Json) => ({
      name: ex.name,
      code: ex.status,
      body: ex.body,
      header: ex.contentType ? [{ key: 'Content-Type', value: ex.contentType }] : [],
    })),
  };
}

export function toPostman(c: ExportCollection): Json {
  return {
    info: {
      name: c.name,
      description: c.description ?? '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: c.items.map(toPmItem),
    variable: (Array.isArray(c.variables) ? c.variables : []).map((v: Json) => ({
      key: v.key,
      value: v.value,
      disabled: v.enabled === false || undefined,
      type: v.secret ? 'secret' : 'default',
    })),
    auth: toPmAuth(c.auth as AuthConfig),
  };
}

// ---------------- OpenAPI / Swagger ----------------

function resolveRef(doc: Json, obj: Json | undefined): Json | undefined {
  let cur = obj;
  for (let i = 0; i < 10 && cur && typeof cur.$ref === 'string'; i++) {
    const path = cur.$ref.replace(/^#\//, '').split('/').map((p: string) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    cur = path.reduce((acc: Json | undefined, key: string) => acc?.[key], doc);
  }
  return cur;
}

function sample(doc: Json, schemaIn: Json | undefined, depth = 0): unknown {
  const schema = resolveRef(doc, schemaIn);
  if (!schema || depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((acc: Json, s: Json) => ({ ...acc, ...((sample(doc, s, depth + 1) as Json) ?? {}) }), {});
  }
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) return sample(doc, (schema.oneOf ?? schema.anyOf)[0], depth + 1);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'object' || schema.properties) {
    const out: Json = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = sample(doc, v as Json, depth + 1);
    return out;
  }
  if (type === 'array') return [sample(doc, schema.items, depth + 1)];
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'string') {
    if (schema.format === 'date-time') return new Date(0).toISOString();
    if (schema.format === 'date') return '2024-01-01';
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    return 'string';
  }
  return null;
}

export function fromOpenApi(doc: Json): ExportCollection {
  const isSwagger2 = !!doc.swagger;
  const baseUrl: string = isSwagger2
    ? doc.host
      ? `${doc.schemes?.[0] ?? 'https'}://${doc.host}${doc.basePath ?? ''}`
      : (doc.basePath ?? '')
    : (doc.servers?.[0]?.url ?? '');

  const folders = new Map<string, ExportItem>();
  const root: ExportItem[] = [];

  for (const [path, opsRaw] of Object.entries<Json>(doc.paths ?? {})) {
    const ops = resolveRef(doc, opsRaw) ?? {};
    for (const m of HTTP_METHODS) {
      const op: Json | undefined = ops[m.toLowerCase()];
      if (!op) continue;
      const params: Json[] = [...(ops.parameters ?? []), ...(op.parameters ?? [])]
        .map((p: Json) => resolveRef(doc, p))
        .filter(Boolean) as Json[];
      const kv = (where: string) =>
        params
          .filter((p) => p.in === where)
          .map((p) => ({
            id: uid(),
            key: String(p.name),
            value: String(p.example ?? p.schema?.example ?? p.default ?? p.schema?.default ?? ''),
            enabled: !!p.required,
            description: p.description,
          }));

      let body: { mode: BodyMode; raw: string; fields: KeyValue[] } = { mode: 'none', raw: '', fields: [] };
      const headers = kv('header');
      if (isSwagger2) {
        const bp = params.find((p) => p.in === 'body');
        if (bp) body = { mode: 'json', raw: JSON.stringify(sample(doc, bp.schema), null, 2), fields: [] };
      } else {
        const rb = resolveRef(doc, op.requestBody);
        const content: Json = rb?.content ?? {};
        const json = content['application/json'] ?? Object.entries(content).find(([k]) => k.includes('json'))?.[1];
        if (json) {
          const ex = json.example ?? (json.examples ? (Object.values(json.examples)[0] as Json)?.value : undefined);
          body = { mode: 'json', raw: JSON.stringify(ex ?? sample(doc, json.schema), null, 2), fields: [] };
        } else if (content['application/x-www-form-urlencoded'] || content['multipart/form-data']) {
          const isForm = !!content['multipart/form-data'];
          const schema = resolveRef(doc, (content['multipart/form-data'] ?? content['application/x-www-form-urlencoded']).schema);
          body = {
            mode: isForm ? 'form-data' : 'urlencoded',
            raw: '',
            fields: Object.keys(schema?.properties ?? {}).map((k) => ({ id: uid(), key: k, value: '', enabled: true })),
          };
        }
      }
      if (body.mode === 'json') headers.push({ id: uid(), key: 'Content-Type', value: 'application/json', enabled: true, description: undefined });

      const query = kv('query');
      const urlBase = `{{baseUrl}}${path.replace(/\{([^}]+)\}/g, '{{$1}}')}`;
      const enabledQuery = query.filter((q) => q.enabled).map((q) => `${q.key}=${q.value}`).join('&');
      const responses = Object.entries<Json>(op.responses ?? {});
      const examples = responses
        .map(([code, resRaw]) => {
          const res = resolveRef(doc, resRaw) ?? {};
          const json = res.content?.['application/json'];
          const payload = json?.example ?? (json?.schema ? sample(doc, json.schema) : res.schema ? sample(doc, res.schema) : undefined);
          if (payload === undefined) return null;
          return {
            id: uid(),
            name: res.description || `${code} response`,
            status: Number(code) || 200,
            body: JSON.stringify(payload, null, 2),
            contentType: 'application/json',
            createdAt: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      const item: ExportItem = {
        type: 'request',
        name: op.summary || op.operationId || `${m} ${path}`,
        description: [op.description ?? '', op.deprecated ? '\n> ⚠️ **Deprecated**' : ''].join('').trim(),
        method: m,
        url: enabledQuery ? `${urlBase}?${enabledQuery}` : urlBase,
        headers,
        queryParams: query,
        body,
        auth: { type: 'inherit' },
        examples,
      };
      const tag = op.tags?.[0];
      if (tag) {
        if (!folders.has(tag)) {
          const tagDoc = (doc.tags ?? []).find((t: Json) => t.name === tag);
          const folder: ExportItem = { type: 'folder', name: tag, description: tagDoc?.description ?? '', items: [] };
          folders.set(tag, folder);
          root.push(folder);
        }
        folders.get(tag)!.items!.push(item);
      } else {
        root.push(item);
      }
    }
  }

  return {
    magidoc: '1.0',
    name: doc.info?.title ?? 'Imported API',
    description: [doc.info?.description ?? '', doc.info?.version ? `\n\n**Version:** ${doc.info.version}` : ''].join('').trim(),
    variables: [{ id: uid(), key: 'baseUrl', value: baseUrl, enabled: true, secret: false }],
    auth: { type: 'none' },
    items: root,
  };
}

// ---------------- cURL ----------------

function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;
  const s = cmd.replace(/\\\r?\n/g, ' ');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < s.length) cur += s[++i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (/\s/.test(ch)) {
      if (hasToken || cur) tokens.push(cur);
      cur = '';
      hasToken = false;
    } else if (ch === '\\' && i + 1 < s.length) {
      cur += s[++i];
    } else {
      cur += ch;
    }
  }
  if (hasToken || cur) tokens.push(cur);
  return tokens;
}

export function parseCurl(cmd: string): RequestDraft {
  const t = tokenize(cmd.trim());
  if (t[0] !== 'curl') throw new Error('Command must start with "curl"');
  const draft = newDraft();
  let method: string | null = null;
  const data: string[] = [];
  const form: KeyValue[] = [];
  for (let i = 1; i < t.length; i++) {
    const a = t[i];
    const next = () => t[++i] ?? '';
    if (a === '-X' || a === '--request') method = next().toUpperCase();
    else if (a === '-H' || a === '--header') {
      const h = next();
      const idx = h.indexOf(':');
      if (idx > 0) draft.headers.push({ id: uid(), key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim(), enabled: true });
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'].includes(a)) data.push(next());
    else if (a === '-F' || a === '--form') {
      const f = next();
      const idx = f.indexOf('=');
      form.push({ id: uid(), key: idx > 0 ? f.slice(0, idx) : f, value: idx > 0 ? f.slice(idx + 1) : '', enabled: true });
    } else if (a === '-u' || a === '--user') {
      const [username, ...rest] = next().split(':');
      draft.auth = { type: 'basic', username, password: rest.join(':') };
    } else if (a === '--url') draft.url = next();
    else if (a === '-I' || a === '--head') method = 'HEAD';
    else if (['-A', '--user-agent', '-e', '--referer', '-b', '--cookie', '-o', '--output', '-m', '--max-time', '--connect-timeout'].includes(a)) {
      const v = next();
      if (a === '-A' || a === '--user-agent') draft.headers.push({ id: uid(), key: 'User-Agent', value: v, enabled: true });
      if (a === '-b' || a === '--cookie') draft.headers.push({ id: uid(), key: 'Cookie', value: v, enabled: true });
    } else if (!a.startsWith('-') && !draft.url) draft.url = a;
  }
  if (form.length) draft.body = { mode: 'form-data', raw: '', fields: form };
  else if (data.length) {
    const raw = data.join('&');
    const ct = draft.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
    draft.body = { mode: /json/i.test(ct) || looksJson(raw) ? 'json' : /xml/i.test(ct) ? 'xml' : 'text', raw, fields: [] };
  }
  draft.method = normalizeMethod(method ?? (data.length || form.length ? 'POST' : 'GET'));
  draft.queryParams = paramsFromUrl(draft.url, []);
  try {
    const u = new URL(draft.url);
    draft.name = `${draft.method} ${u.pathname}`;
  } catch {
    draft.name = 'Imported from cURL';
  }
  return draft;
}

function looksJson(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (!(v.startsWith('{') || v.startsWith('['))) return false;
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}

function normalizeMethod(m: unknown): HttpMethod {
  const up = String(m ?? 'GET').toUpperCase() as HttpMethod;
  return HTTP_METHODS.includes(up) ? up : 'GET';
}
