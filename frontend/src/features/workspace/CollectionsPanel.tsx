import clsx from 'clsx';
import {
  BookOpen,
  Box,
  ChevronRight,
  Copy,
  Download,
  FilePlus2,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  FolderTree,
  GitMerge,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  exportCollection,
  useCollection,
  useCollections,
  useCreateCollection,
  useCreateFolder,
  useCreateRequest,
  useDeleteCollection,
  useDeleteFolder,
  useDeleteRequest,
  useDuplicateCollection,
  useDuplicateRequest,
  useMoveFolder,
  useMoveRequest,
  useSaveRequest,
  useUpdateCollection,
  useUpdateFolder,
} from '../../api/hooks';
import { MethodText } from '../../components/MethodBadge';
import { Button, EmptyState, IconButton, Menu, Spinner, type MenuItem } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { toPostman } from '../../lib/interchange';
import { buildTree, descendantFolderIds, type TreeNode } from '../../lib/tree';
import { downloadJson, slug } from '../../lib/utils';
import { confirm, prompt } from '../../store/confirm';
import { useWorkspaceStore, useWsState } from '../../store/workspace';
import type { CollectionDetail, CollectionSummary } from '../../types';
import toast from 'react-hot-toast';
import { activatable } from '../../lib/a11y';
import { useWs } from './context';
import { ImportModal } from './ImportModal';
import { useOrganize } from './OrganizeFolders';
import { StatusIcon, StatusPicker, useStatusMenuItems } from './IntegrationStatus';
import { INTEGRATION_STATUSES, STATUS_FILTER_LABEL, matchesStatus, type StatusFilter } from '../../lib/integration';

const DND_TYPE = 'application/x-magidoc-item';
interface DragItem {
  kind: 'request' | 'folder';
  id: string;
  collectionId: string;
}

export function CollectionsPanel() {
  const { wsId, canEdit } = useWs();
  const { data: collections, isLoading } = useCollections(wsId);
  const create = useCreateCollection(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [importOpen, setImportOpen] = useState(false);

  const newCollection = async () => {
    const name = await prompt({ title: 'New collection', label: 'Collection name', placeholder: 'e.g. Users API', confirmText: 'Create' });
    if (name) create.mutate({ name }, { onSuccess: (c) => openTab(wsId, { kind: 'collection', id: c.id, title: c.name }) });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Collections</h2>
        {canEdit && (
          <div className="flex items-center">
            <IconButton label="Import" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
            </IconButton>
            <IconButton label="New collection" onClick={newCollection}>
              <Plus className="size-4" />
            </IconButton>
          </div>
        )}
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-2 size-3.5 text-faint" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter requests"
              aria-label="Filter requests"
              className="h-7 w-full rounded-md bg-panel-2 pl-8 pr-2 text-xs border border-line placeholder:text-faint focus:outline-none focus:ring-accent/40"
            />
          </div>
          <Menu
            align="right"
            width={190}
            items={(['ALL', ...INTEGRATION_STATUSES, 'UNMARKED'] as StatusFilter[]).map((s) => ({
              label: STATUS_FILTER_LABEL[s],
              icon: s === 'ALL' || s === 'UNMARKED' ? <ListFilter /> : <StatusIcon status={s} />,
              checked: status === s,
              onClick: () => setStatus(s),
            }))}
            trigger={(open) => (
              <button
                type="button"
                onClick={open}
                aria-label={`Filter by integration status: ${STATUS_FILTER_LABEL[status]}`}
                aria-haspopup="menu"
                title="Filter by integration status"
                className={clsx(
                  'flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                  status === 'ALL' ? 'border-line bg-panel-2 text-faint hover:text-fg' : 'border-accent/40 bg-accent-soft text-accent-fg',
                )}
              >
                <ListFilter className="size-3.5" />
              </button>
            )}
          />
        </div>
        {status !== 'ALL' && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            {status !== 'UNMARKED' && <StatusIcon status={status} className="size-3" />}
            <span className="truncate">Showing: {STATUS_FILTER_LABEL[status]}</span>
            <button type="button" onClick={() => setStatus('ALL')} className="ml-auto flex items-center gap-0.5 rounded px-1 text-faint hover:text-fg cursor-pointer" aria-label="Clear status filter">
              <X className="size-3" /> Clear
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !collections?.length ? (
          <EmptyState
            icon={<Box className="size-5" />}
            title="No collections"
            description="Group related requests and document them together."
            action={canEdit && (
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="primary" onClick={newCollection}>New collection</Button>
                <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>Import Postman / OpenAPI</Button>
              </div>
            )}
          />
        ) : (
          collections.map((c) => <CollectionNode key={c.id} summary={c} filter={filter.trim().toLowerCase()} status={status} />)
        )}
      </div>
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function CollectionNode({ summary, filter, status }: { summary: CollectionSummary; filter: string; status: StatusFilter }) {
  const { wsId, canEdit } = useWs();
  const [open, setOpen] = useState(false);
  const filtering = !!filter || status !== 'ALL';
  const expanded = open || filtering;
  const { data: detail, isLoading } = useCollection(expanded ? summary.id : undefined);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const closeTabsWhere = useWorkspaceStore((s) => s.closeTabsWhere);
  const del = useDeleteCollection(wsId);
  const dup = useDuplicateCollection(wsId);
  const update = useUpdateCollection(wsId);
  const createFolder = useCreateFolder(wsId);
  const createRequest = useCreateRequest(wsId);
  const { drop, dragOver, isOver, onDragLeave } = useDropTarget(summary.id, null, detail);
  const [mergeOpen, setMergeOpen] = useState(false);
  const organize = useOrganize(detail);

  const addRequest = async (folderId: string | null) => {
    const name = await prompt({ title: 'New request', label: 'Request name', placeholder: 'e.g. List users', confirmText: 'Create' });
    if (!name) return;
    setOpen(true);
    createRequest.mutate(
      { collectionId: summary.id, folderId, draft: { name, method: 'GET', url: '' } },
      { onSuccess: (r) => openTab(wsId, { kind: 'request', id: r.id, collectionId: r.collectionId, title: r.name }) },
    );
  };
  const addFolder = async (parentId: string | null) => {
    const name = await prompt({ title: 'New folder', label: 'Folder name', confirmText: 'Create' });
    if (!name) return;
    setOpen(true);
    createFolder.mutate({ collectionId: summary.id, name, parentId });
  };
  const doExport = async (format: 'magidoc' | 'postman') => {
    try {
      const data = await exportCollection(summary.id);
      if (format === 'postman') downloadJson(`${slug(summary.name)}.postman_collection.json`, toPostman(data));
      else downloadJson(`${slug(summary.name)}.magidoc.json`, data);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items: (MenuItem | 'divider')[] = [
    { label: 'Overview', icon: <Box />, onClick: () => openTab(wsId, { kind: 'collection', id: summary.id, title: summary.name }) },
    { label: 'View docs', icon: <BookOpen />, onClick: () => openTab(wsId, { kind: 'docs', id: summary.id, title: `Docs · ${summary.name}` }) },
    ...(canEdit
      ? ([
          'divider',
          { label: 'Add request', icon: <FilePlus2 />, onClick: () => addRequest(null) },
          { label: 'Add folder', icon: <FolderPlus />, onClick: () => addFolder(null) },
          {
            label: 'Rename',
            icon: <Pencil />,
            onClick: async () => {
              const name = await prompt({ title: 'Rename collection', initial: summary.name });
              if (name) update.mutate({ id: summary.id, name });
            },
          },
          { label: 'Duplicate', icon: <Copy />, onClick: () => dup.mutate(summary.id) },
          { label: 'Merge JSON into…', icon: <GitMerge />, onClick: () => setMergeOpen(true) },
          { label: 'Organize into folders', icon: <FolderTree />, onClick: () => void organize.run(), disabled: !detail },
          { label: 'Share & publish', icon: <Share2 />, onClick: () => openTab(wsId, { kind: 'collection', id: summary.id, title: summary.name }) },
        ] as (MenuItem | 'divider')[])
      : []),
    'divider',
    { label: 'Export (MagiDoc)', icon: <Download />, onClick: () => doExport('magidoc') },
    { label: 'Export (Postman v2.1)', icon: <Download />, onClick: () => doExport('postman') },
    ...(canEdit
      ? ([
          'divider',
          {
            label: 'Delete',
            icon: <Trash2 />,
            danger: true,
            onClick: async () => {
              if (await confirm({ title: `Delete “${summary.name}”?`, message: `All ${summary.requestCount} requests, folders and share links will be removed.`, confirmText: 'Delete', danger: true }))
                del.mutate(summary.id, { onSuccess: () => closeTabsWhere(wsId, (t) => t.id === summary.id || t.collectionId === summary.id) });
            },
          },
        ] as (MenuItem | 'divider')[])
      : []),
  ];

  const tree = detail ? buildTree(detail.folders, detail.requests) : [];

  return (
    <div>
      <div
        onDragOver={dragOver}
        onDragLeave={onDragLeave}
        onDrop={drop}
        className={clsx('group flex h-8 cursor-pointer items-center gap-1 rounded-md pl-1 pr-1 text-sm hover:bg-panel-3', isOver && 'bg-accent-soft outline-1 outline-dashed outline-accent')}
        onClick={() => setOpen(!open)}
        {...activatable(() => setOpen(!open), summary.name)}
      >
        <ChevronRight className={clsx('size-3.5 shrink-0 text-faint transition', expanded && 'rotate-90')} />
        <Box className="size-3.5 shrink-0 text-accent-fg" />
        <span className="flex-1 truncate font-medium">{summary.name}</span>
        <span className="text-[10px] text-faint group-hover:hidden">{summary.requestCount}</span>
        <Menu
          align="right"
          items={items}
          trigger={(openMenu) => (
            <button onClick={openMenu} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer" aria-label="Collection actions">
              <MoreHorizontal className="size-4" />
            </button>
          )}
        />
      </div>
      {expanded && (
        <div className="ml-3 border-l border-line pl-1">
          {isLoading && <div className="py-2 pl-4"><Spinner className="size-4" /></div>}
          {canEdit && organize.names.length > 0 && (
            <button
              type="button"
              onClick={() => void organize.run()}
              disabled={organize.pending}
              className="my-1 ml-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md border border-info/25 bg-info-soft px-2 py-1.5 text-left text-xs text-info hover:border-info/50 cursor-pointer disabled:opacity-60"
            >
              <FolderTree className="size-3.5 shrink-0" />
              <span className="flex-1">{organize.names.length} items look like “Folder/Name”. Organize into folders</span>
            </button>
          )}
          {detail && <TreeNodes nodes={tree} detail={detail} filter={filter} status={status} depth={0} onAddRequest={addRequest} onAddFolder={addFolder} />}
          {detail && filtering && tree.length > 0 && !tree.some((n) => matchesFilter(n, filter, status)) && (
            <p className="py-1.5 pl-5 text-xs text-faint">No matching requests</p>
          )}
          {detail && tree.length === 0 && (
            <p className="py-1.5 pl-5 text-xs text-faint">
              Empty —{' '}
              {canEdit ? (
                <button className="text-accent-fg hover:underline cursor-pointer" onClick={() => addRequest(null)}>add a request</button>
              ) : (
                'no requests yet'
              )}
            </p>
          )}
        </div>
      )}
      {mergeOpen && <ImportModal initialCollectionId={summary.id} onClose={() => setMergeOpen(false)} />}
    </div>
  );
}

/** Text matches a request's name/URL or a folder's name; a status filter only ever matches requests. */
function matchesFilter(node: TreeNode, filter: string, status: StatusFilter): boolean {
  if (!filter && status === 'ALL') return true;
  if (node.type === 'request') {
    const r = node.request;
    return matchesStatus(r, status) && (!filter || r.name.toLowerCase().includes(filter) || r.url.toLowerCase().includes(filter));
  }
  if (status === 'ALL' && node.folder.name.toLowerCase().includes(filter)) return true;
  return node.children.some((c) => matchesFilter(c, filter, status));
}

function TreeNodes(props: { nodes: TreeNode[]; detail: CollectionDetail; filter: string; status: StatusFilter; depth: number; onAddRequest: (f: string | null) => void; onAddFolder: (f: string | null) => void }) {
  return (
    <>
      {/* Non-matching items are hidden, not removed, so folders keep their open/closed state when a filter is cleared. */}
      {props.nodes.map((n) => (
        <div key={n.type === 'folder' ? n.folder.id : n.request.id} hidden={!matchesFilter(n, props.filter, props.status)}>
          {n.type === 'folder' ? <FolderNode node={n} {...props} /> : <RequestNode node={n} detail={props.detail} />}
        </div>
      ))}
    </>
  );
}

function FolderNode({ node, ...props }: { node: Extract<TreeNode, { type: 'folder' }> } & Parameters<typeof TreeNodes>[0]) {
  const { wsId, canEdit } = useWs();
  const [open, setOpen] = useState(false);
  const expanded = open || !!props.filter || props.status !== 'ALL';
  const del = useDeleteFolder(wsId);
  const update = useUpdateFolder(wsId);
  const move = useMoveFolder(wsId);
  const f = node.folder;
  const { drop, dragOver, isOver, onDragLeave } = useDropTarget(f.collectionId, f.id, props.detail);

  const invalidTargets = descendantFolderIds(props.detail.folders, f.id);
  const moveTargets = props.detail.folders.filter((x) => !invalidTargets.has(x.id) && x.id !== f.parentId);

  const items: (MenuItem | 'divider')[] = canEdit
    ? [
        { label: 'Add request', icon: <FilePlus2 />, onClick: () => { setOpen(true); props.onAddRequest(f.id); } },
        { label: 'Add folder', icon: <FolderPlus />, onClick: () => { setOpen(true); props.onAddFolder(f.id); } },
        {
          label: 'Rename',
          icon: <Pencil />,
          onClick: async () => {
            const name = await prompt({ title: 'Rename folder', initial: f.name });
            if (name) update.mutate({ id: f.id, collectionId: f.collectionId, name });
          },
        },
        ...(f.parentId ? [{ label: 'Move to root', icon: <FolderOpen />, onClick: () => move.mutate({ id: f.id, collectionId: f.collectionId, parentId: null }) }] : []),
        ...moveTargets.slice(0, 6).map((t) => ({ label: `Move to ${t.name}`, icon: <FolderIcon />, onClick: () => move.mutate({ id: f.id, collectionId: f.collectionId, parentId: t.id }) })),
        'divider',
        {
          label: 'Delete',
          icon: <Trash2 />,
          danger: true,
          onClick: async () => {
            if (await confirm({ title: `Delete folder “${f.name}”?`, message: 'All requests and sub-folders inside will be deleted.', confirmText: 'Delete', danger: true }))
              del.mutate({ id: f.id, collectionId: f.collectionId });
          },
        },
      ]
    : [];

  return (
    <div>
      <div
        draggable={canEdit}
        onDragStart={(e) => startDrag(e, { kind: 'folder', id: f.id, collectionId: f.collectionId })}
        onDragOver={dragOver}
        onDragLeave={onDragLeave}
        onDrop={drop}
        onClick={() => setOpen(!open)}
        {...activatable(() => setOpen(!open), `Folder ${f.name}`)}
        className={clsx('group flex h-7 cursor-pointer items-center gap-1 rounded-md pl-1 pr-1 text-[13px] text-muted hover:bg-panel-3 hover:text-fg', isOver && 'bg-accent-soft outline-1 outline-dashed outline-accent')}
      >
        <ChevronRight className={clsx('size-3 shrink-0 text-faint transition', expanded && 'rotate-90')} />
        {expanded ? <FolderOpen className="size-3.5 shrink-0 text-warning" /> : <FolderIcon className="size-3.5 shrink-0 text-warning" />}
        <span className="flex-1 truncate">{f.name}</span>
        {canEdit && (
          <Menu
            align="right"
            items={items}
            trigger={(openMenu) => (
              <button onClick={openMenu} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer" aria-label="Folder actions">
                <MoreHorizontal className="size-3.5" />
              </button>
            )}
          />
        )}
      </div>
      {expanded && (
        <div className="ml-3 border-l border-line pl-1">
          <TreeNodes {...props} nodes={node.children} depth={props.depth + 1} />
          {node.children.length === 0 && <p className="py-1 pl-5 text-xs text-faint">Empty folder</p>}
        </div>
      )}
    </div>
  );
}

function RequestNode({ node, detail }: { node: Extract<TreeNode, { type: 'request' }>; detail: CollectionDetail }) {
  const { wsId, canEdit } = useWs();
  const r = node.request;
  const { tabs, active } = useWsState(wsId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const closeTabsWhere = useWorkspaceStore((s) => s.closeTabsWhere);
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const draftMethod = useWorkspaceStore((s) => s.drafts[r.id]?.method);
  const del = useDeleteRequest(wsId);
  const dup = useDuplicateRequest(wsId);
  const move = useMoveRequest(wsId);
  const save = useSaveRequest(wsId);
  const isActive = active === `request:${r.id}`;
  const isOpen = tabs.some((t) => t.id === r.id);
  const open = () => openTab(wsId, { kind: 'request', id: r.id, collectionId: r.collectionId, title: r.name });
  const statusItems = useStatusMenuItems(r);

  const items: (MenuItem | 'divider')[] = [
    { label: 'Open', icon: <FilePlus2 />, onClick: open },
    ...(canEdit
      ? ([
          'divider',
          ...statusItems.flatMap((i) => (i === 'divider' ? [] : [{ ...i, label: i.checked === undefined ? i.label : `Status: ${i.label}` }])),
          'divider',
          {
            label: 'Rename',
            icon: <Pencil />,
            onClick: async () => {
              const name = await prompt({ title: 'Rename request', initial: r.name });
              if (name) save.mutate({ id: r.id, draft: { name } }, { onSuccess: () => renameTab(wsId, `request:${r.id}`, name) });
            },
          },
          { label: 'Duplicate', icon: <Copy />, onClick: () => dup.mutate({ id: r.id, collectionId: r.collectionId }) },
          ...(r.folderId ? [{ label: 'Move to root', icon: <FolderOpen />, onClick: () => move.mutate({ id: r.id, collectionId: r.collectionId, folderId: null }) }] : []),
          ...detail.folders
            .filter((f) => f.id !== r.folderId)
            .slice(0, 6)
            .map((f) => ({ label: `Move to ${f.name}`, icon: <FolderIcon />, onClick: () => move.mutate({ id: r.id, collectionId: r.collectionId, folderId: f.id }) })),
          'divider',
          {
            label: 'Delete',
            icon: <Trash2 />,
            danger: true,
            onClick: async () => {
              if (await confirm({ title: `Delete “${r.name}”?`, confirmText: 'Delete', danger: true }))
                del.mutate({ id: r.id, collectionId: r.collectionId }, { onSuccess: () => closeTabsWhere(wsId, (t) => t.id === r.id) });
            },
          },
        ] as (MenuItem | 'divider')[])
      : []),
  ];

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => startDrag(e, { kind: 'request', id: r.id, collectionId: r.collectionId })}
      onClick={open}
      {...activatable(open, `${r.method} ${r.name}`)}
      className={clsx(
        'group flex h-7 cursor-pointer items-center gap-2 rounded-md pl-5 pr-1 text-[13px] transition',
        isActive ? 'bg-accent-soft text-fg' : isOpen ? 'text-fg hover:bg-panel-3' : 'text-muted hover:bg-panel-3 hover:text-fg',
      )}
    >
      <MethodText method={draftMethod ?? r.method} className="w-8 shrink-0" />
      <span className="flex-1 truncate" title={r.name}>{r.name}</span>
      <StatusPicker request={r} canEdit={canEdit} variant="icon" />
      <Menu
        align="right"
        items={items}
        trigger={(openMenu) => (
          <button onClick={openMenu} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer" aria-label="Request actions">
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      />
    </div>
  );
}

function startDrag(e: React.DragEvent, item: DragItem) {
  e.stopPropagation();
  e.dataTransfer.setData(DND_TYPE, JSON.stringify(item));
  e.dataTransfer.effectAllowed = 'move';
}

/** Drop target for a collection root (folderId = null) or a folder. Moves within the same collection. */
function useDropTarget(collectionId: string, folderId: string | null, detail: CollectionDetail | undefined) {
  const { wsId, canEdit } = useWs();
  const [isOver, setIsOver] = useState(false);
  const moveRequest = useMoveRequest(wsId);
  const moveFolder = useMoveFolder(wsId);

  const dragOver = (e: React.DragEvent) => {
    if (!canEdit || !e.dataTransfer.types.includes(DND_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  };
  const onDragLeave = () => setIsOver(false);
  const drop = (e: React.DragEvent) => {
    setIsOver(false);
    const raw = e.dataTransfer.getData(DND_TYPE);
    if (!raw) return;
    e.preventDefault();
    e.stopPropagation();
    const item = JSON.parse(raw) as DragItem;
    if (item.collectionId !== collectionId) {
      toast.error('Items can only be moved within the same collection');
      return;
    }
    if (item.kind === 'request') {
      const current = detail?.requests.find((r) => r.id === item.id);
      if (current && current.folderId === folderId) return;
      moveRequest.mutate({ id: item.id, collectionId, folderId });
    } else {
      if (folderId && detail && descendantFolderIds(detail.folders, item.id).has(folderId)) return;
      const current = detail?.folders.find((f) => f.id === item.id);
      if (current && current.parentId === folderId) return;
      moveFolder.mutate({ id: item.id, collectionId, parentId: folderId });
    }
  };
  return { drop, dragOver, isOver, onDragLeave };
}
