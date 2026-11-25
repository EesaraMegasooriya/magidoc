import { FileQuestion } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePublicDocs } from '../api/hooks';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { EmptyState, FullPageSpinner } from '../components/ui';
import { DocsView } from '../features/docs/DocsView';

export function PublicDocsPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = usePublicDocs(token);

  useEffect(() => {
    if (data) document.title = `${data.detail.collection.name} · MagiDoc`;
    return () => {
      document.title = 'MagiDoc';
    };
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-4">
        <Link to="/">
          <Logo size={26} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-fg sm:inline">Public documentation</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <FullPageSpinner />
        ) : isError || !data ? (
          <EmptyState
            icon={<FileQuestion className="size-6" />}
            title="Documentation not available"
            description="This link may have expired or been disabled by its owner."
          />
        ) : (
          <DocsView detail={data.detail} workspaceName={data.workspaceName} />
        )}
      </div>
    </div>
  );
}
