import { Boxes, ChevronRight, FolderGit2, KeyRound, Plus, ShieldAlert, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateWorkspace, useRecoveryStatus, useTeams, useWorkspaces } from '../api/hooks';
import { SecurityModal } from '../components/SecurityModal';
import { AppHeader } from '../components/AppHeader';
import { JoinWorkspaceModal } from '../components/JoinWorkspaceModal';
import { Button, EmptyState, Field, Input, Modal, PageHeader, RoleBadge, SearchInput, Skeleton, Textarea } from '../components/ui';
import { timeAgo } from '../lib/utils';
import { useAuth } from '../store/auth';

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const { data: workspaces, isLoading } = useWorkspaces();
  const { data: teams } = useTeams();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const { data: recovery } = useRecoveryStatus();
  const [filter, setFilter] = useState('');

  const list = (workspaces ?? [])
    .filter((w) => w.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const totalCollections = (workspaces ?? []).reduce((n, w) => n + w.collectionCount, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <PageHeader
            title={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'}`}
            description="Pick a workspace to design, test and document your APIs."
            actions={
              <>
                <Button variant="secondary" icon={<KeyRound />} onClick={() => setJoining(true)}>
                  Join workspace
                </Button>
                <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
                  New workspace
                </Button>
              </>
            }
          />

          {recovery && recovery.remaining === 0 && (
            <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
              <ShieldAlert className="size-5 shrink-0 text-warning" />
              <p className="min-w-60 flex-1 text-[13px] text-fg">
                <strong className="font-semibold">Protect your account.</strong>{' '}
                <span className="text-muted">Create recovery codes — they’re the only way to reset a forgotten password.</span>
              </p>
              <Button size="sm" variant="secondary" icon={<KeyRound />} onClick={() => setSecurityOpen(true)}>
                Create recovery codes
              </Button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat icon={<Boxes />} label="Workspaces" value={workspaces?.length} />
            <Stat icon={<FolderGit2 />} label="Collections" value={workspaces ? totalCollections : undefined} />
            <Stat icon={<Users />} label="Teams" value={teams?.length} to="/teams" />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">All workspaces</h2>
            <SearchInput className="w-full sm:w-64" placeholder="Search workspaces" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search workspaces" />
          </div>

          {isLoading ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-line bg-panel p-5">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="mt-4 h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-6 h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-line-strong bg-panel">
              <EmptyState
                icon={<Boxes />}
                title={filter ? 'No matching workspaces' : 'No workspaces yet'}
                description={filter ? 'Try a different search term.' : 'Workspaces hold your collections, environments and team members.'}
                action={
                  !filter && (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="secondary" icon={<KeyRound />} onClick={() => setJoining(true)}>Join with a code</Button>
                      <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>Create workspace</Button>
                    </div>
                  )
                }
              />
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/w/${w.id}`}
                    className="group flex h-full flex-col rounded-xl border border-line bg-panel p-5 shadow-xs transition hover:border-line-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-accent-fg">
                        {w.name[0]?.toUpperCase()}
                      </span>
                      <RoleBadge role={w.role} />
                    </div>
                    <h3 className="mt-4 truncate text-[15px] font-semibold">{w.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-[13px] text-muted">{w.description || 'No description'}</p>
                    <div className="mt-5 flex items-center gap-4 border-t border-line pt-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderGit2 className="size-3.5" /> {w.collectionCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" /> {w.memberCount}
                      </span>
                      <span className="ml-auto text-faint">Updated {timeAgo(w.updatedAt)}</span>
                      <ChevronRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
                    </div>
                  </Link>
                </li>
              ))}
              {!filter && (
                <li>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-[13px] font-medium text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <Plus className="size-5" />
                    New workspace
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </main>
      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
      {joining && <JoinWorkspaceModal onClose={() => setJoining(false)} />}
      {securityOpen && <SecurityModal onClose={() => setSecurityOpen(false)} />}
    </div>
  );
}

function Stat({ icon, label, value, to }: { icon: ReactNode; label: string; value?: number; to?: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4 shadow-xs transition hover:border-line-strong">
      <span className="flex size-9 items-center justify-center rounded-lg bg-panel-3 text-muted [&_svg]:size-4">{icon}</span>
      <div>
        <p className="text-[13px] text-muted">{label}</p>
        {value === undefined ? <Skeleton className="mt-1 h-5 w-8" /> : <p className="text-xl font-semibold tabular-nums">{value}</p>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
      {body}
    </Link>
  ) : (
    body
  );
}

function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateWorkspace();
  const navigate = useNavigate();
  const submit = () => create.mutate({ name: name.trim(), description }, { onSuccess: (ws) => navigate(`/w/${ws.id}`) });
  return (
    <Modal
      open
      onClose={onClose}
      title="Create workspace"
      description="A shared space for a product, team or project. You can invite people afterwards."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={!name.trim()} onClick={submit}>Create workspace</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) submit(); }}>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} placeholder="e.g. Payments Platform" />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="What lives in this workspace?" />
        </Field>
      </form>
    </Modal>
  );
}
