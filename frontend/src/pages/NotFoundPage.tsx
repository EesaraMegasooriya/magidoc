import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-bg p-6 text-center">
      <Logo size={32} />
      <div>
        <p className="font-mono text-sm font-medium text-accent-fg">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you’re looking for doesn’t exist or was moved.</p>
      </div>
      <Link to="/">
        <Button variant="primary">Back to workspaces</Button>
      </Link>
    </div>
  );
}
