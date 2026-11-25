import clsx from 'clsx';
import { Activity as ActivityIcon, Ban, KeyRound, LogOut, RotateCw, Settings2, Trash2, UserPlus, Users } from 'lucide-react';
import { CopyButton } from '../../components/CodeView';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useActivity,
  useAddMember,
  useAddWorkspaceTeam,
  useDeleteWorkspace,
  useDisableJoinCode,
  useGenerateJoinCode,
  useLeaveWorkspace,
  useMembers,
  useRemoveMember,
  useRemoveWorkspaceTeam,
  useTeams,
  useUpdateJoinCodeRole,
  useUpdateMemberRole,
  useUpdateWorkspace,
  useUpdateWorkspaceTeam,
} from '../../api/hooks';
import { Avatar, Button, Field, IconButton, Input, RoleBadge, Select, Spinner, Textarea } from '../../components/ui';
import { timeAgo } from '../../lib/utils';
import { useAuth } from '../../store/auth';
import { confirm } from '../../store/confirm';
import type { JoinCode, Role } from '../../types';
import { useWs } from './context';

type Section = 'general' | 'members' | 'activity';

const ROLE_HELP: Record<Exclude<Role, 'OWNER'>, string> = {
  VIEWER: 'Viewer · read only',
  EDITOR: 'Editor · can edit',
  ADMIN: 'Admin · manages access',
};

export function SettingsView() {
  const [section, setSection] = useState<Section>('members');
  const items: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="size-4" /> },
    { id: 'members', label: 'Members & teams', icon: <Users className="size-4" /> },
    { id: 'activity', label: 'Activity', icon: <ActivityIcon className="size-4" /> },
  ];
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          <h2 className="mb-3 px-2 text-lg font-bold">Settings</h2>
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => setSection(i.id)}
              className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition cursor-pointer', section === i.id ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg')}
            >
              {i.icon} {i.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {section === 'general' && <GeneralSection />}
          {section === 'members' && <MembersSection />}
          {section === 'activity' && <ActivitySection />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-panel p-5 border border-line">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function GeneralSection() {
  const { wsId, workspace, canAdmin, role } = useWs();
  const update = useUpdateWorkspace(wsId);
  const del = useDeleteWorkspace();
  const leave = useLeaveWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description ?? '');
  }, [workspace]);

  return (
    <div className="space-y-6">
      <Card title="Workspace details">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} readOnly={!canAdmin} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={description} readOnly={!canAdmin} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </Field>
          {canAdmin && (
            <Button variant="primary" loading={update.isPending} disabled={!name.trim()} onClick={() => update.mutate({ name: name.trim(), description })}>
              Save
            </Button>
          )}
        </div>
      </Card>
      <section className="rounded-xl border border-danger/30 bg-panel p-5 shadow-xs">
        <h3 className="font-semibold text-danger">Danger zone</h3>
        {role === 'OWNER' ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Permanently delete this workspace, its collections, environments and history.</p>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: `Delete “${workspace.name}”?`, message: 'This cannot be undone. Everything inside will be permanently removed for all members.', confirmText: 'Delete workspace', danger: true }))
                  del.mutate(wsId, { onSuccess: () => navigate('/') });
              }}
            >
              Delete workspace
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Remove yourself from this workspace.</p>
            <Button
              variant="danger"
              icon={<LogOut className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Leave this workspace?', confirmText: 'Leave', danger: true })) leave.mutate(wsId, { onSuccess: () => navigate('/') });
              }}
            >
              Leave workspace
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function RoleSelect({ value, onChange, canGrantAdmin, disabled }: { value: Role; onChange: (r: Role) => void; canGrantAdmin: boolean; disabled?: boolean }) {
  return (
    <Select className="h-8 w-28 text-xs" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role)}>
      <option value="VIEWER">Viewer</option>
      <option value="EDITOR">Editor</option>
      {(canGrantAdmin || value === 'ADMIN') && <option value="ADMIN">Admin</option>}
    </Select>
  );
}

/** Shareable code that lets anyone with a MagiDoc account join this workspace. */
function JoinCodeCard({ joinCode }: { joinCode: JoinCode }) {
  const { wsId } = useWs();
  const generate = useGenerateJoinCode(wsId);
  const updateRole = useUpdateJoinCodeRole(wsId);
  const disable = useDisableJoinCode(wsId);
  const [newRole, setNewRole] = useState<Role>(joinCode.role);

  if (!joinCode.enabled || !joinCode.code) {
    return (
      <Card title="Join code" description="Create a code your teammates can enter to join this workspace — no email needed.">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-48" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} aria-label="Role for people who join">
            <option value="VIEWER">{ROLE_HELP.VIEWER}</option>
            <option value="EDITOR">{ROLE_HELP.EDITOR}</option>
          </Select>
          <Button variant="primary" icon={<KeyRound className="size-4" />} loading={generate.isPending} onClick={() => generate.mutate(newRole)}>
            Create join code
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Join code" description="Share this code. Anyone signed in to MagiDoc can join from their dashboard with “Join workspace”.">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-panel-2 py-1 pl-4 pr-1">
          <span className="select-all font-mono text-xl font-semibold tracking-[0.18em] text-fg" aria-label="Join code">{joinCode.code}</span>
          <CopyButton text={joinCode.code} label="Copy" className="ml-2" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Joins as
          <Select
            className="h-8 w-32 text-xs"
            value={joinCode.role}
            disabled={updateRole.isPending}
            onChange={(e) => updateRole.mutate(e.target.value as Role)}
            aria-label="Role for people who join"
          >
            <option value="VIEWER">Viewer</option>
            <option value="EDITOR">Editor</option>
          </Select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button
          size="sm"
          icon={<RotateCw />}
          loading={generate.isPending}
          onClick={async () => {
            if (await confirm({ title: 'Generate a new code?', message: 'The current code will stop working immediately. People who already joined keep their access.', confirmText: 'Generate new code' }))
              generate.mutate(joinCode.role);
          }}
        >
          New code
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Ban />}
          loading={disable.isPending}
          onClick={async () => {
            if (await confirm({ title: 'Turn off joining by code?', message: 'The code stops working. You can create a new one at any time.', confirmText: 'Turn off', danger: true }))
              disable.mutate(undefined);
          }}
        >
          Turn off
        </Button>
      </div>
    </Card>
  );
}

function MembersSection() {
  const { wsId, canAdmin, role: myRole } = useWs();
  const me = useAuth((s) => s.user);
  const { data, isLoading } = useMembers(wsId);
  const { data: myTeams } = useTeams();
  const addMember = useAddMember(wsId);
  const updateRole = useUpdateMemberRole(wsId);
  const remove = useRemoveMember(wsId);
  const addTeam = useAddWorkspaceTeam(wsId);
  const updateTeam = useUpdateWorkspaceTeam(wsId);
  const removeTeam = useRemoveWorkspaceTeam(wsId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EDITOR');
  const [teamId, setTeamId] = useState('');
  const [teamRole, setTeamRole] = useState<Role>('EDITOR');
  const isOwner = myRole === 'OWNER';

  if (isLoading || !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  const availableTeams = (myTeams ?? []).filter((t) => !data.teams.some((wt) => wt.teamId === t.id));
  const manageable = (r: Role) => canAdmin && r !== 'OWNER' && (r !== 'ADMIN' || isOwner);

  return (
    <div className="space-y-6">
      {canAdmin && data.joinCode && <JoinCodeCard joinCode={data.joinCode} />}

      {canAdmin && (
        <Card title="Add an existing user" description="Already on MagiDoc? Add them directly by email — they get access right away.">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMember.mutate({ email: email.trim(), role }, { onSuccess: () => setEmail('') });
            }}
          >
            <Input className="min-w-56 flex-1" type="email" required placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email of an existing user" />
            <Select className="w-48" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
              {(['VIEWER', 'EDITOR', ...(isOwner ? (['ADMIN'] as const) : [])] as Exclude<Role, 'OWNER'>[]).map((r) => (
                <option key={r} value={r}>{ROLE_HELP[r]}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" icon={<UserPlus className="size-4" />} loading={addMember.isPending}>Add</Button>
          </form>
        </Card>
      )}

      <Card title={`Members · ${data.members.length}`}>
        <ul className="divide-y divide-line">
          {data.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar name={m.name} color={m.avatarColor} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name} {m.userId === me?.id && <span className="text-faint">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              {manageable(m.role) && m.userId !== me?.id ? (
                <>
                  <RoleSelect value={m.role} canGrantAdmin={isOwner} onChange={(r) => updateRole.mutate({ memberId: m.id, role: r })} />
                  <IconButton
                    label="Remove member"
                    onClick={async () => {
                      if (await confirm({ title: `Remove ${m.name}?`, message: 'They will lose direct access to this workspace.', confirmText: 'Remove', danger: true })) remove.mutate(m.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Teams · ${data.teams.length}`} description="Every member of a team gets the team’s role here. The highest role a person holds wins.">
        {canAdmin && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Select className="min-w-48 flex-1" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{availableTeams.length ? 'Select one of your teams…' : 'No teams available — create one on the Teams page'}</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.memberCount})</option>
              ))}
            </Select>
            <RoleSelect value={teamRole} onChange={setTeamRole} canGrantAdmin={isOwner} />
            <Button
              variant="primary"
              icon={<Users className="size-4" />}
              disabled={!teamId}
              loading={addTeam.isPending}
              onClick={() => addTeam.mutate({ teamId, role: teamRole }, { onSuccess: () => setTeamId('') })}
            >
              Share
            </Button>
          </div>
        )}
        {data.teams.length === 0 ? (
          <p className="text-sm text-faint">No teams have access yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.teams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className="flex size-[34px] items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-fg">{t.teamName[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.teamName}</p>
                  <p className="text-xs text-muted">{t.memberCount} members</p>
                </div>
                {manageable(t.role) ? (
                  <>
                    <RoleSelect value={t.role} canGrantAdmin={isOwner} onChange={(r) => updateTeam.mutate({ id: t.id, role: r })} />
                    <IconButton
                      label="Remove team"
                      onClick={async () => {
                        if (await confirm({ title: `Remove ${t.teamName}?`, message: 'Team members lose access granted through this team.', confirmText: 'Remove', danger: true })) removeTeam.mutate(t.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </>
                ) : (
                  <RoleBadge role={t.role} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  );
}

function ActivitySection() {
  const { wsId } = useWs();
  const { data, isLoading } = useActivity(wsId);
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  return (
    <Card title="Recent activity">
      {!data?.length ? (
        <p className="text-sm text-faint">Nothing has happened yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-6">
          {data.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[37px] top-0">
                <Avatar name={a.userName} color={a.userColor} size={24} />
              </span>
              <p className="text-sm">
                <span className="font-medium">{a.userName}</span> <span className="text-muted">{a.action} {a.targetType}</span>{' '}
                {a.targetName && <span className="font-medium text-accent-fg">{a.targetName}</span>}
              </p>
              <p className="text-xs text-faint">{timeAgo(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
