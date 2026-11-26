import type { Variable } from '../types';

export type VarMap = Record<string, { value: string; source: string; secret?: boolean }>;

const VAR_RE = /\{\{\s*([\w.\-$]+)\s*\}\}/g;

/**
 * Builds the variable scope. Later layers win, mirroring the usual precedence:
 * globals < collection < active environment.
 */
export function buildScope(layers: { source: string; vars: Variable[] | undefined }[]): VarMap {
  const map: VarMap = {};
  for (const layer of layers) {
    for (const v of layer.vars ?? []) {
      if (v.enabled && v.key.trim()) map[v.key.trim()] = { value: v.value, source: layer.source, secret: !!v.secret };
    }
  }
  return map;
}

/** Replaces {{name}} placeholders; supports one level of nesting (a variable referencing another). */
export function resolve(input: string, scope: VarMap): string {
  if (!input || !input.includes('{{')) return input;
  const once = (s: string) => s.replace(VAR_RE, (m, name: string) => (name in scope ? scope[name].value : m));
  return once(once(input));
}

export function findVariables(input: string): string[] {
  const out = new Set<string>();
  for (const m of input.matchAll(VAR_RE)) out.add(m[1]);
  return [...out];
}

export function unresolved(input: string, scope: VarMap): string[] {
  return findVariables(input).filter((v) => !(v in scope));
}

/** Names that {{…}} can reference: letters, digits, _ . - $ (no spaces or braces). */
export const VALID_VAR_NAME = /^[\w.\-$]+$/;

/**
 * resolved  – defined and has a value
 * empty     – defined but blank (requests usually break)
 * unresolved – not defined, or its value references a variable that isn't defined
 */
export type VarStatus = 'resolved' | 'empty' | 'unresolved';

export interface VarInfo {
  name: string;
  status: VarStatus;
  /** Final value after nested resolution (masked for secrets). */
  display?: string;
  source?: string;
  reason: string;
}

const MASK = '••••••';

export function describeVar(name: string, scope: VarMap): VarInfo {
  const entry = scope[name];
  if (!entry) {
    return { name, status: 'unresolved', reason: 'Not defined in Globals, the collection or the active environment' };
  }
  const finalValue = resolve(entry.value, scope);
  const nestedMissing = unresolved(finalValue, scope);
  if (nestedMissing.length) {
    return {
      name,
      status: 'unresolved',
      source: entry.source,
      display: entry.secret ? MASK : finalValue,
      reason: `Its value uses {{${nestedMissing[0]}}}, which isn't defined`,
    };
  }
  if (finalValue === '') {
    return { name, status: 'empty', source: entry.source, display: '', reason: `Defined in ${entry.source} but empty` };
  }
  return { name, status: 'resolved', source: entry.source, display: entry.secret ? MASK : finalValue, reason: `From ${entry.source}` };
}

export type Token = { kind: 'text'; text: string } | { kind: 'var'; text: string; info: VarInfo };

/** Splits text into plain runs and {{variable}} tokens (token text is exactly as typed). */
export function tokenize(input: string, scope: VarMap): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of input.matchAll(VAR_RE)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ kind: 'text', text: input.slice(last, start) });
    tokens.push({ kind: 'var', text: m[0], info: describeVar(m[1], scope) });
    last = start + m[0].length;
  }
  if (last < input.length) tokens.push({ kind: 'text', text: input.slice(last) });
  return tokens;
}

/** Every distinct variable used across the given texts, in first-seen order. */
export function collectVariables(texts: string[], scope: VarMap): VarInfo[] {
  const seen = new Map<string, VarInfo>();
  for (const t of texts) for (const name of findVariables(t ?? '')) if (!seen.has(name)) seen.set(name, describeVar(name, scope));
  return [...seen.values()];
}

export interface RowStatus {
  level: 'ok' | 'warn' | 'error' | 'off';
  message: string;
}

/** Health of one row in a variables table (null for the blank "add" row). */
export function variableRowStatus(row: Variable, rows: Variable[]): RowStatus | null {
  const key = row.key.trim();
  if (!key) return null;
  if (!VALID_VAR_NAME.test(key)) {
    return { level: 'error', message: `“${key}” can’t be used as {{${key}}}. Use only letters, numbers and _ . - $ (no spaces or braces).` };
  }
  if (!row.enabled) return { level: 'off', message: 'Turned off: requests can’t use it.' };
  const same = rows.filter((r) => r.enabled && r.key.trim() === key);
  if (same.length > 1 && same[same.length - 1].id !== row.id) {
    return { level: 'warn', message: `Duplicate name: another “${key}” further down overrides this one.` };
  }
  if (row.value === '') return { level: 'warn', message: `Empty value: {{${key}}} will be sent as an empty string.` };
  return { level: 'ok', message: `Ready: use it as {{${key}}}.` };
}
