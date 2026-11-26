import { FolderTree } from 'lucide-react';
import { useOrganizeFolderPaths } from '../../api/hooks';
import { Button } from '../../components/ui';
import { pathNamesInCollection, splitFolderPath } from '../../lib/interchange';
import { confirm } from '../../store/confirm';
import type { CollectionDetail } from '../../types';
import { useWs } from './context';

/** Asks before restructuring, then turns "Folder/Name" names into real folders. */
export function useOrganize(detail: CollectionDetail | undefined) {
  const { wsId } = useWs();
  const organize = useOrganizeFolderPaths(wsId);
  const names = detail ? pathNamesInCollection(detail) : [];
  const run = async () => {
    if (!detail) return;
    const example = names[0];
    const parts = example ? (splitFolderPath(example) ?? [example.replace(/\/+\s*$/, '')]) : [];
    const ok = await confirm({
      title: `Organize “${detail.collection.name}” into folders?`,
      message: example
        ? `${names.length} item${names.length === 1 ? '' : 's'} use “Folder/Name”. For example “${example}” becomes “${parts[parts.length - 1]}” inside “${parts.slice(0, -1).join(' → ') || parts[0]}”. Same-named folders are merged. Nothing is deleted, and requests keep their history and links.`
        : 'Turn names like “External/Get users” into real folders.',
      confirmText: 'Organize',
    });
    if (ok) organize.mutate(detail.collection.id);
  };
  return { names, run, pending: organize.isPending };
}

/** Banner shown on the collection page when names look like folder paths. */
export function OrganizeBanner({ detail }: Readonly<{ detail: CollectionDetail }>) {
  const { canEdit } = useWs();
  const { names, run, pending } = useOrganize(detail);
  if (!canEdit || names.length === 0) return null;
  return (
    <div role="status" className="mx-6 mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-info/25 bg-info-soft px-3 py-2.5 text-[13px] text-info">
      <FolderTree className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {names.length} {names.length === 1 ? 'item looks' : 'items look'} like folder paths, e.g. <strong className="font-semibold">“{names[0]}”</strong>.
      </span>
      <Button size="sm" variant="primary" icon={<FolderTree />} loading={pending} onClick={run}>
        Organize into folders
      </Button>
    </div>
  );
}
