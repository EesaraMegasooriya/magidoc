import { describe, expect, it } from 'vitest';
import type { ExportItem } from '../types';
import { findFolderPathNames, groupByFolderPaths, splitFolderPath } from './interchange';

const req = (name: string): ExportItem => ({ type: 'request', name, method: 'GET', url: '{{baseUrl}}/x' });
const folder = (name: string, items: ExportItem[] = []): ExportItem => ({ type: 'folder', name, items });
/** Compact view of a tree: "Folder[child, child]". */
const shape = (items: ExportItem[]): string[] =>
  items.map((i) => (i.type === 'folder' ? `${i.name}[${shape(i.items ?? []).join(', ')}]` : i.name));

describe('splitFolderPath', () => {
  it.each([
    ['External/Get users', ['External', 'Get users']],
    ['External/ Get users', ['External', 'Get users']],
    ['External/Payments/Refund', ['External', 'Payments', 'Refund']],
    ['  External / Payments ', null], // "/" preceded by a space looks like a path, not a folder
    ['External/', null],
    ['GET /users/{id}', null],
    ['POST/users', null],
    ['/health', null],
    ['https://api.example.com/users', null],
    ['{{baseUrl}}/users', null],
    ['a//b', null],
    ['Plain name', null],
  ])('%s → %j', (name, expected) => {
    expect(splitFolderPath(name)).toEqual(expected);
  });
});

describe('groupByFolderPaths', () => {
  it('moves "Folder/Name" items into folders and keeps order', () => {
    const out = groupByFolderPaths([req('Login'), req('External/Get users'), req('External/ Create user'), req('Internal/Ping')]);
    expect(shape(out)).toEqual(['Login', 'External[Get users, Create user]', 'Internal[Ping]']);
  });

  it('creates nested folders and reuses existing ones case-insensitively', () => {
    const out = groupByFolderPaths([
      folder('external', [req('Old')]),
      req('External/Payments/Refund'),
      req('EXTERNAL/Payments/Capture'),
    ]);
    expect(shape(out)).toEqual(['external[Old, Payments[Refund, Capture]]']);
  });

  it('merges folders whose names are paths or have a trailing slash', () => {
    const out = groupByFolderPaths([
      folder('External/', [req('A')]),
      folder('External/Admin', [req('B')]),
      folder('External', [folder('Admin', [req('C')])]),
    ]);
    expect(shape(out)).toEqual(['External[A, Admin[B, C]]']);
  });

  it('works inside existing folders', () => {
    const out = groupByFolderPaths([folder('Api', [req('V1/List'), req('V1/Get')])]);
    expect(shape(out)).toEqual(['Api[V1[List, Get]]']);
  });

  it('leaves URL-like names untouched', () => {
    const items = [req('GET /users/{id}'), req('{{baseUrl}}/health'), req('/ping')];
    expect(shape(groupByFolderPaths(items))).toEqual(['GET /users/{id}', '{{baseUrl}}/health', '/ping']);
  });

  it('does not mutate its input', () => {
    const input = [folder('External', [req('A')]), req('External/B')];
    const snapshot = JSON.stringify(input);
    groupByFolderPaths(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('keeps request details', () => {
    const [f] = groupByFolderPaths([{ ...req('External/Get users'), method: 'POST', url: '{{baseUrl}}/users', description: 'd' }]);
    expect(f.items?.[0]).toMatchObject({ type: 'request', name: 'Get users', method: 'POST', url: '{{baseUrl}}/users', description: 'd' });
  });
});

describe('findFolderPathNames', () => {
  it('finds path names at any depth, including trailing-slash folders', () => {
    expect(findFolderPathNames([req('A/B'), folder('X/', [req('Y/Z'), req('plain')]), req('GET /x')])).toEqual(['A/B', 'X/', 'Y/Z']);
  });
});
