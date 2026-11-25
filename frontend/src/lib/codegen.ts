import type { BuiltRequest } from './request';

export type SnippetLang = 'curl' | 'fetch' | 'axios' | 'python' | 'http';

export const SNIPPET_LANGS: { id: SnippetLang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'JavaScript' },
  { id: 'axios', label: 'Axios' },
  { id: 'python', label: 'Python' },
  { id: 'http', label: 'HTTP' },
];

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const jsq = (s: string) => JSON.stringify(s);

function bodyString(req: BuiltRequest): string | null {
  if (req.body.mode === 'raw') return req.body.raw ?? '';
  return null;
}

function prettyJsonIfPossible(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export function generateSnippet(lang: SnippetLang, req: BuiltRequest): string {
  const url = req.url || 'https://example.com';
  const raw = bodyString(req);
  const isJson = req.bodyMode === 'json';
  const fields = req.body.mode === 'form-data' ? (req.body.fields ?? []) : [];

  switch (lang) {
    case 'curl': {
      const lines = [`curl -X ${req.method} ${shq(url)}`];
      for (const h of req.headers) lines.push(`  -H ${shq(`${h.key}: ${h.value}`)}`);
      for (const f of fields) lines.push(`  -F ${shq(`${f.key}=${f.value}`)}`);
      if (raw !== null && raw !== '') lines.push(`  --data-raw ${shq(raw)}`);
      return lines.join(' \\\n');
    }
    case 'fetch': {
      const opts: string[] = [`  method: ${jsq(req.method)},`];
      const headers = req.headers.filter((h) => !(fields.length && h.key.toLowerCase() === 'content-type'));
      if (headers.length) {
        opts.push('  headers: {');
        for (const h of headers) opts.push(`    ${jsq(h.key)}: ${jsq(h.value)},`);
        opts.push('  },');
      }
      let pre = '';
      if (fields.length) {
        pre = 'const form = new FormData();\n' + fields.map((f) => `form.append(${jsq(f.key)}, ${jsq(f.value)});`).join('\n') + '\n\n';
        opts.push('  body: form,');
      } else if (raw) {
        opts.push(isJson ? `  body: JSON.stringify(${indent(prettyJsonIfPossible(raw), 2)}),` : `  body: ${jsq(raw)},`);
      }
      return `${pre}const response = await fetch(${jsq(url)}, {\n${opts.join('\n')}\n});\n\nconst data = await response.${isJson || /json/i.test(headerValue(req, 'accept')) ? 'json' : 'text'}();\nconsole.log(data);`;
    }
    case 'axios': {
      const lines = ["import axios from 'axios';", '', 'const response = await axios({', `  method: ${jsq(req.method.toLowerCase())},`, `  url: ${jsq(url)},`];
      if (req.headers.length) {
        lines.push('  headers: {');
        for (const h of req.headers) lines.push(`    ${jsq(h.key)}: ${jsq(h.value)},`);
        lines.push('  },');
      }
      if (fields.length) {
        lines.push(`  data: { ${fields.map((f) => `${jsq(f.key)}: ${jsq(f.value)}`).join(', ')} },`);
      } else if (raw) {
        lines.push(isJson ? `  data: ${indent(prettyJsonIfPossible(raw), 2)},` : `  data: ${jsq(raw)},`);
      }
      lines.push('});', '', 'console.log(response.data);');
      return lines.join('\n');
    }
    case 'python': {
      const lines = ['import requests', '', `url = ${jsq(url)}`];
      const headers = req.headers.filter((h) => !(fields.length && h.key.toLowerCase() === 'content-type'));
      if (headers.length) {
        lines.push('headers = {');
        for (const h of headers) lines.push(`    ${jsq(h.key)}: ${jsq(h.value)},`);
        lines.push('}');
      }
      let arg = '';
      if (fields.length) {
        lines.push(`files = {${fields.map((f) => `${jsq(f.key)}: (None, ${jsq(f.value)})`).join(', ')}}`);
        arg = ', files=files';
      } else if (raw) {
        if (isJson) {
          try {
            lines.push(`payload = ${toPython(JSON.parse(raw), 0)}`);
            arg = ', json=payload';
          } catch {
            lines.push(`payload = ${jsq(raw)}`);
            arg = ', data=payload';
          }
        } else {
          lines.push(`payload = ${jsq(raw)}`);
          arg = ', data=payload';
        }
      }
      lines.push('', `response = requests.request(${jsq(req.method)}, url${headers.length ? ', headers=headers' : ''}${arg})`, 'print(response.status_code)', 'print(response.text)');
      return lines.join('\n');
    }
    case 'http': {
      let path = url;
      let host = '';
      try {
        const u = new URL(url.match(/^https?:\/\//) ? url : `http://${url}`);
        path = u.pathname + u.search;
        host = u.host;
      } catch {
        /* keep raw */
      }
      const lines = [`${req.method} ${path} HTTP/1.1`];
      if (host) lines.push(`Host: ${host}`);
      for (const h of req.headers) lines.push(`${h.key}: ${h.value}`);
      if (fields.length) lines.push('Content-Type: multipart/form-data');
      const out = lines.join('\n');
      if (fields.length) return `${out}\n\n${fields.map((f) => `${f.key}=${f.value}`).join('\n')}`;
      return raw ? `${out}\n\n${raw}` : out;
    }
  }
}

function headerValue(req: BuiltRequest, name: string) {
  return req.headers.find((h) => h.key.toLowerCase() === name)?.value ?? '';
}

function indent(s: string, spaces: number) {
  const pad = ' '.repeat(spaces);
  return s.split('\n').map((l, i) => (i === 0 ? l : pad + l)).join('\n');
}

function toPython(v: unknown, depth: number): string {
  const pad = '    '.repeat(depth + 1);
  const end = '    '.repeat(depth);
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x) => pad + toPython(x, depth + 1)).join(',\n')}\n${end}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${toPython(x, depth + 1)}`).join(',\n')}\n${end}}`;
}
