import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './lib/api';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { FullPageSpinner } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { useAuth } from './store/auth';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TeamsPage = lazy(() => import('./pages/TeamsPage').then((m) => ({ default: m.TeamsPage })));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })));
const PublicDocsPage = lazy(() => import('./pages/PublicDocsPage').then((m) => ({ default: m.PublicDocsPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();

  // Validate the persisted session once per load (the cookie may have expired or been revoked).
  const setUser = useAuth((s) => s.setUser);
  useQuery({
    queryKey: ['me', user?.id],
    queryFn: () => api.get('/users/me').then((r) => { setUser(r.data); return r.data; }),
    enabled: !!user,
    staleTime: Infinity,
    retry: false,
  });

  // Drop cached data from a previous session when the user logs out.
  useEffect(() => {
    if (!user) qc.clear();
  }, [user, qc]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
      <Route path="/docs/:token" element={<PublicDocsPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/teams" element={<RequireAuth><TeamsPage /></RequireAuth>} />
      <Route path="/w/:workspaceId" element={<RequireAuth><WorkspacePage /></RequireAuth>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
