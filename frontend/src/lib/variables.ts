import type { Variable } from '../types';

export type VarMap = Record<string, { value: string; source: string }>;

const VAR_RE = /\{\{\s*([\w.\-$]+)\s*\}\}/g;

/**
 * Builds the variable scope. Later layers win, mirroring the usual precedence:
 * globals < collection < active environment.
 */
export function buildScope(layers: { source: string; vars: Variable[] | undefined }[]): VarMap {
  const map: VarMap = {};
  for (const layer of layers) {
    for (const v of layer.vars ?? []) {
      if (v.enabled && v.key.trim()) map[v.key.trim()] = { value: v.value, source: layer.source };
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
