#!/usr/bin/env node
/**
 * MagiDoc Local Agent — lets a hosted MagiDoc send requests to APIs on YOUR machine or network
 * (localhost, 127.0.0.1, 192.168.x.x …), which the MagiDoc server can't reach.
 *
 *   node magidoc-agent.mjs --origin https://magidoc.example.com
 *
 * Options:  --origin <url>   MagiDoc address allowed to use the agent (repeatable; required)
 *           --port <n>       listen port (default 47321)
 * Requires Node.js 18+. No dependencies. Listens on 127.0.0.1 only.
 *
 * Security: only pages from the --origin(s) you pass can use the agent (browsers can't fake the Origin
 * header), so other websites can't use it to reach your local network. Stop it with Ctrl+C.
 */
import http from 'node:http';
import { Buffer } from 'node:buffer';

const VERSION = '1.0.0';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;
const MAX_TIMEOUT_MS = 120_000;
// Managed by fetch itself; setting them would throw or break the request.
const RESTRICTED = new Set(['connection', 'content-length', 'expect', 'host', 'upgrade', 'keep-alive', 'transfer-encoding']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const TEXTUAL = /^text\/|json|xml|javascript|x-www-form-urlencoded|graphql|yaml|csv|html/i;

function parseArgs(argv) {
  const opts = { origins: [], port: 47321 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--origin') opts.origins.push(argv[++i]);
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help || !opts.origins.length) {
  console.log('Usage: node magidoc-agent.mjs --origin https://your-magidoc-address [--port 47321]');
  process.exit(opts.help ? 0 : 1);
}
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`MagiDoc Agent needs Node.js 18 or newer (you have ${process.versions.node}).`);
  process.exit(1);
}
const allowed = new Set(
  opts.origins.map((o) => {
    try {
      return new URL(o).origin;
    } catch {
      console.error(`Invalid --origin: ${o}`);
      process.exit(1);
    }
  }),
);
if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
  console.error('Invalid --port');
  process.exit(1);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !allowed.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Private Network Access preflights (older Chrome) — newer Chrome asks the user instead.
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(json);
}

const failure = (error, durationMs = 0) => ({
  status: 0, statusText: 'Error', headers: [], body: '', bodyEncoding: 'text',
  contentType: null, durationMs, size: 0, truncated: false, error,
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('Request too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function readLimited(response) {
  if (!response.body) return { bytes: Buffer.alloc(0), truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > MAX_RESPONSE_BYTES) {
      chunks.push(value.subarray(0, MAX_RESPONSE_BYTES - size));
      size = MAX_RESPONSE_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  return { bytes: Buffer.concat(chunks.map((c) => Buffer.from(c))), truncated };
}

/** Same request/response contract as MagiDoc's server-side runner (POST /api/workspaces/{id}/execute). */
async function execute(spec) {
  const method = String(spec?.method ?? '').trim().toUpperCase();
  if (!METHODS.has(method)) return failure(`Unsupported HTTP method: ${method || '(none)'}`);
  let url = String(spec?.url ?? '').trim();
  if (url.includes('{{')) return failure('Invalid request: unresolved variable in URL - check your environment');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  try {
    new URL(url);
  } catch {
    return failure('Invalid request: malformed URL');
  }

  const headers = new Headers();
  let hasUserAgent = false;
  for (const h of Array.isArray(spec.headers) ? spec.headers : []) {
    if (!h?.key || RESTRICTED.has(String(h.key).toLowerCase())) continue;
    if (String(h.key).toLowerCase() === 'user-agent') hasUserAgent = true;
    try {
      headers.append(String(h.key).trim(), String(h.value ?? ''));
    } catch {
      return failure(`Invalid request: bad header "${h.key}"`);
    }
  }
  if (!hasUserAgent) headers.set('User-Agent', `MagiDoc-Agent/${VERSION}`);

  let body;
  const b = spec.body ?? {};
  if (b.mode === 'form-data') {
    body = new FormData();
    for (const f of Array.isArray(b.fields) ? b.fields : []) if (f?.key) body.append(String(f.key), String(f.value ?? ''));
    headers.delete('content-type'); // fetch sets the multipart boundary
  } else if (b.mode === 'raw' && typeof b.raw === 'string' && method !== 'GET' && method !== 'HEAD') {
    body = b.raw;
  }

  const timeout = Math.min(Math.max(Number(spec.timeoutMs) || MAX_TIMEOUT_MS, 1), MAX_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: spec.followRedirects === false ? 'manual' : 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    const { bytes, truncated } = await readLimited(response);
    const contentType = response.headers.get('content-type');
    const textual = !contentType || TEXTUAL.test(contentType);
    const charset = /charset=([^;]+)/i.exec(contentType ?? '')?.[1]?.trim().replace(/"/g, '') || 'utf-8';
    let text;
    if (textual) {
      try {
        text = new TextDecoder(charset).decode(bytes);
      } catch {
        text = bytes.toString('utf8');
      }
    }
    const out = [];
    response.headers.forEach((value, key) => out.push({ key, value }));
    return {
      status: response.status,
      statusText: response.statusText,
      headers: out,
      body: textual ? text : bytes.toString('base64'),
      bodyEncoding: textual ? 'text' : 'base64',
      contentType,
      durationMs: Math.round(performance.now() - started),
      size: bytes.length,
      truncated,
      error: null,
    };
  } catch (e) {
    const ms = Math.round(performance.now() - started);
    const cause = e?.cause?.code || e?.name;
    if (cause === 'TimeoutError') return failure('Request timed out', ms);
    if (cause === 'ECONNREFUSED') return failure(`Could not connect to ${new URL(url).host} — is your API running?`, ms);
    if (cause === 'ENOTFOUND') return failure(`Unknown host: ${new URL(url).hostname}`, ms);
    return failure(`Network error: ${e?.cause?.message || e?.message || 'request failed'}`, ms);
  }
}

const server = http.createServer(async (req, res) => {
  const permitted = cors(req, res);
  if (!permitted) {
    // No/foreign Origin: refuse, so other websites can't use this agent.
    return send(res, 403, { error: 'Origin not allowed. Start the agent with --origin <your MagiDoc address>.' });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && path === '/health') {
    return send(res, 200, { name: 'magidoc-agent', version: VERSION });
  }
  if (req.method === 'POST' && path === '/execute') {
    if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 415, { error: 'Content-Type must be application/json' });
    }
    try {
      const spec = await readJson(req);
      const result = await execute(spec);
      const status = result.status ? `${result.status}` : 'ERR';
      console.log(`${new Date().toLocaleTimeString()}  ${String(spec.method).toUpperCase().padEnd(7)} ${status.padEnd(4)} ${result.durationMs}ms  ${spec.url}`);
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }
  return send(res, 404, { error: 'Not found' });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${opts.port} is already in use — is the agent already running? Or use --port.`);
  else console.error(e.message);
  process.exit(1);
});

server.listen(opts.port, '127.0.0.1', () => {
  console.log(`MagiDoc Local Agent ${VERSION} — listening on http://127.0.0.1:${opts.port}`);
  console.log(`Allowed MagiDoc: ${[...allowed].join(', ')}`);
  console.log('Requests to localhost and your private network will now work. Press Ctrl+C to stop.\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
