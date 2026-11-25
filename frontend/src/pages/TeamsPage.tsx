import clsx from 'clsx';
import { Boxes, LogOut, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAddTeamMember,
  useCreateTeam,
  useDeleteTeam,
  useRemoveTeamMember,
  useTeam,
  useTeams,
  useUpdateTeam,
  useUpdateTeamMember,
} from '../api/hooks';
import { AppHeader } from '../components/AppHeader';
import { Avatar, Button, EmptyState, Field, IconButton, Input, Modal, RoleBadge, Select, Spinner, Textarea } from '../components/ui';
import { confirm } from '../store/confirm';
import { useAuth } from '../store/auth';
import type { TeamRole } from '../types';

export function TeamsPage() {
  const { data: teams, isLoading } = useTeams();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (teams && (!selected || !teams.some((t) => t.id === selected))) setSelected(teams[0]?.id ?? null);
  }, [teams, selected]);

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <main className="bg-bg flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
              <p className="mt-1.5 text-muted">Group people once, then share any workspace with the whole team.</p>
            </div>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New team
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner /></div>
          ) : !teams?.length ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No teams yet"
              description="Create a team, add people by email and share workspaces with everyone in one go."
              action={<Button variant="primary" onClick={() => setCreating(true)}>Create a team</Button>}
            />
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-1.5">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                      selected === t.id ? 'border-accent/50 bg-accent-soft' : 'border-line bg-panel hover:border-line-strong',
                    )}
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent-fg">{t.name[0]?.toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-faint">{t.memberCount} members</p>
                    </div>
                    <RoleBadge role={t.myRole} />
                  </button>
                ))}
              </div>
              {selected && <TeamDetailPanel teamId={selected} />}
            </div>
          )}
        </div>
      </main>
      {creating && <CreateTeamModal onClose={() => setCreating(false)} onCreated={setSelected} />}
    </div>
  );
}

function TeamDetailPanel({ teamId }: { teamId: string }) {
  const me = useAuth((s) => s.user);
  const { data, isLoading } = useTeam(teamId);
  const update = useUpdateTeam(teamId);
  const del = useDeleteTeam();
  const addMember = useAddTeamMember(teamId);
  const updateMember = useUpdateTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('MEMBER');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (data) {
      setName(data.team.name);
      setDescription(data.team.description ?? '');
    }
  }, [data]);

  if (isLoading || !data) return <div className="flex justify-center py-20"><Spinner /></div>;
  const myRole = data.team.myRole;
  const canManage = myRole === 'ADMIN' || myRole === 'OWNER';
  const myMembership = data.members.find((m) => m.userId === me?.id);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-panel p-5 border border-line">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            {canManage ? (
              <>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-lg font-semibold" maxLength={120} />
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team work on?" />
                <Button size="sm" variant="primary" loading={update.isPending} disabled={!name.trim()} onClick={() => update.mutate({ name, description })}>
                  Save details
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{data.team.name}</h2>
                <p className="text-sm text-muted">{data.team.description || 'No description'}</p>
              </>
            )}
          </div>
          {myRole === 'OWNER' ? (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-3.5" />}
              onClick={async () => {
                if (await confirm({ title: `Delete ${data.team.name}?`, message: 'Members lose any workspace access granted through this team.', confirmText: 'Delete team', danger: true }))
                  del.mutate(teamId);
              }}
            >
              Delete team
            </Button>
          ) : (
            myMembership && (
              <Button
                variant="ghost"
                size="sm"
                icon={<LogOut className="size-3.5" />}
                onClick={async () => {
                  if (await confirm({ title: 'Leave this team?', confirmText: 'Leave', danger: true })) removeMember.mutate(myMembership.id);
                }}
              >
                Leave
              </Button>
            )
          )}
        </div>
      </section>

      <section className="rounded-xl bg-panel p-5 border border-line">
        <h3 className="font-semibold">Members</h3>
        {canManage && (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMember.mutate({ email, role }, { onSuccess: () => setEmail('') });
            }}
          >
            <Input className="min-w-56 flex-1" type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select className="w-32" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
              <option value="MEMBER">Member</option>
              {myRole === 'OWNER' && <option value="ADMIN">Admin</option>}
            </Select>
            <Button type="submit" variant="primary" icon={<UserPlus className="size-4" />} loading={addMember.isPending}>
              Add
            </Button>
          </form>
        )}
        <ul className="mt-4 divide-y divide-line">
          {data.members.map((m) => {
            const editable = canManage && m.role !== 'OWNER' && (m.role !== 'ADMIN' || myRole === 'OWNER') && m.userId !== me?.id;
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.name} color={m.avatarColor} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name} {m.userId === me?.id && <span className="text-faint">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                {editable && myRole === 'OWNER' ? (
                  <Select className="h-8 w-28 text-xs" value={m.role} onChange={(e) => updateMember.mutate({ memberId: m.id, role: e.target.value as TeamRole })}>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {editable && (
                  <IconButton
                    label="Remove member"
                    onClick={async () => {
                      if (await confirm({ title: `Remove ${m.name}?`, confirmText: 'Remove', danger: true })) removeMember.mutate(m.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl bg-panel p-5 border border-line">
        <h3 className="font-semibold">Workspace access</h3>
        <p className="mt-1 text-sm text-muted">Share a workspace with this team from the workspace’s Settings → Members tab.</p>
        {data.workspaces.length === 0 ? (
          <p className="mt-4 text-sm text-faint">Not shared with any workspace yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.workspaces.map((w) => (
              <li key={w.workspaceId}>
                <Link to={`/w/${w.workspaceId}`} className="flex items-center gap-3 rounded-xl bg-panel-2 p-3 border border-line transition hover:ring-accent/40">
                  <Boxes className="size-4 text-accent-fg" />
                  <span className="flex-1 truncate text-sm">{w.workspaceName}</span>
                  <RoleBadge role={w.role} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateTeam();
  const submit = () => create.mutate({ name: name.trim(), description }, { onSuccess: (t) => { onCreated(t.id); onClose(); } });
  return (
    <Modal
      open
      onClose={onClose}
      title="Create a team"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={!name.trim()} onClick={submit}>Create team</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) submit(); }}>
        <Field label="Team name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Backend Squad" />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
