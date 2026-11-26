import { describe, expect, it } from 'vitest';
import type { Variable } from '../types';
import { buildScope, collectVariables, describeVar, tokenize, variableRowStatus } from './variables';

const v = (key: string, value: string, extra: Partial<Variable> = {}): Variable => ({ id: key + value, key, value, enabled: true, ...extra });

const scope = buildScope([
  { source: 'Globals', vars: [v('baseUrl', 'https://global.test'), v('token', 'secret-123', { secret: true })] },
  { source: 'Environment · Dev', vars: [v('baseUrl', 'http://localhost:8080'), v('empty', ''), v('nested', '{{baseUrl}}/v1'), v('broken', '{{missing}}/x')] },
]);

describe('describeVar', () => {
  it('reports the winning value and its source', () => {
    expect(describeVar('baseUrl', scope)).toMatchObject({ status: 'resolved', display: 'http://localhost:8080', source: 'Environment · Dev' });
  });
  it('masks secrets', () => {
    expect(describeVar('token', scope)).toMatchObject({ status: 'resolved', display: '••••••' });
  });
  it('flags empty, undefined and broken nested values', () => {
    expect(describeVar('empty', scope).status).toBe('empty');
    expect(describeVar('nope', scope).status).toBe('unresolved');
    expect(describeVar('nested', scope)).toMatchObject({ status: 'resolved', display: 'http://localhost:8080/v1' });
    expect(describeVar('broken', scope)).toMatchObject({ status: 'unresolved', reason: expect.stringContaining('{{missing}}') });
  });
});

describe('tokenize', () => {
  it('splits text and variables, keeping exact token text', () => {
    const t = tokenize('{{baseUrl}}/users/{{ id }}?q=1', scope);
    expect(t.map((x) => x.text).join('')).toBe('{{baseUrl}}/users/{{ id }}?q=1');
    expect(t.map((x) => (x.kind === 'var' ? `${x.info.name}:${x.info.status}` : 'text'))).toEqual(['baseUrl:resolved', 'text', 'id:unresolved', 'text']);
  });
  it('returns plain text when there are no variables', () => {
    expect(tokenize('https://x.test', scope)).toEqual([{ kind: 'text', text: 'https://x.test' }]);
  });
});

describe('collectVariables', () => {
  it('lists each variable once in first-seen order', () => {
    expect(collectVariables(['{{baseUrl}}/a/{{nope}}', 'Bearer {{token}} {{baseUrl}}'], scope).map((x) => x.name)).toEqual(['baseUrl', 'nope', 'token']);
  });
});

describe('variableRowStatus', () => {
  const rows = [v('ok', '1'), v('bad name', '1'), v('dup', 'a'), v('dup', 'b'), v('blank', ''), v('off', '1', { enabled: false }), v('', '')];
  const status = (i: number) => variableRowStatus(rows[i], rows)?.level ?? null;
  it('classifies rows', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(status)).toEqual(['ok', 'error', 'warn', 'ok', 'warn', 'off', null]);
  });
});
