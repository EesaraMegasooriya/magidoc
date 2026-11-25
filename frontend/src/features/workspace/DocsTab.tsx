import { useCollection } from '../../api/hooks';
import { EmptyState, FullPageSpinner } from '../../components/ui';
import { DocsView } from '../docs/DocsView';
import type { Tab } from '../../store/workspace';
import { useWs } from './context';

export function DocsTab({ tab }: { tab: Tab }) {
  const { workspace } = useWs();
  const { data, isLoading } = useCollection(tab.id);
  if (isLoading) return <FullPageSpinner />;
  if (!data) return <EmptyState title="Collection not found" />;
  return <DocsView detail={data} workspaceName={workspace.name} />;
}
