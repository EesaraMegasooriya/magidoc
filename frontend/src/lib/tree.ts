import type { ApiRequest, Folder } from '../types';

export type TreeNode =
  | { type: 'folder'; folder: Folder; children: TreeNode[] }
  | { type: 'request'; request: ApiRequest };

const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

export function buildTree(folders: Folder[], requests: ApiRequest[]): TreeNode[] {
  const ids = new Set(folders.map((f) => f.id));
  const build = (parentId: string | null): TreeNode[] => [
    ...folders
      .filter((f) => (f.parentId && ids.has(f.parentId) ? f.parentId : null) === parentId)
      .sort(byOrder)
      .map((f) => ({ type: 'folder' as const, folder: f, children: build(f.id) })),
    ...requests
      .filter((r) => (r.folderId && ids.has(r.folderId) ? r.folderId : null) === parentId)
      .sort(byOrder)
      .map((r) => ({ type: 'request' as const, request: r })),
  ];
  return build(null);
}

/** Depth-first list of requests in tree order. */
export function flattenRequests(nodes: TreeNode[]): ApiRequest[] {
  return nodes.flatMap((n) => (n.type === 'request' ? [n.request] : flattenRequests(n.children)));
}

/** Descendant folder ids (including itself), used to prevent invalid moves. */
export function descendantFolderIds(folders: Folder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export function folderPath(folders: Folder[], id: string | null): string {
  const parts: string[] = [];
  let cur = id ? folders.find((f) => f.id === id) : undefined;
  let guard = 0;
  while (cur && guard++ < 50) {
    parts.unshift(cur.name);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return parts.join(' / ');
}
