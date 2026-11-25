import clsx from 'clsx';
import { KeyRound, LayoutGrid, LogOut, Monitor, Moon, Shield, Sun, UserRound, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useChangePassword, useUpdateProfile } from '../api/hooks';
import { signOut } from '../lib/api';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';
import { Logo } from './Logo';
import { SecurityModal } from './SecurityModal';
import { ThemeToggle } from './ThemeToggle';
import { Avatar, Button, Field, Input, Menu, Modal } from './ui';

const COLORS = ['#7c5cff', '#ec4899', '#0891b2', '#059669', '#d97706', '#dc2626', '#2563eb', '#9333ea'];

/**
 * Global top bar. `left` renders after the logo (e.g. a workspace switcher); `right` before the user controls.
 */
export function AppHeader({ left, right, showNav = true }: { left?: ReactNode; right?: ReactNode; showNav?: boolean }) {
  const user = useAuth((s) => s.user);
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const nav = (to: string, label: string, icon: ReactNode) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          'inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
          isActive ? 'bg-panel-3 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg',
        )
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:px-4">
      <Link to="/" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" aria-label="MagiDoc home">
        <Logo size={24} />
      </Link>
      {showNav && (
        <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Main">
          {nav('/', 'Workspaces', <LayoutGrid />)}
          {nav('/teams', 'Teams', <Users />)}
        </nav>
      )}
      {left && (
        <>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          {left}
        </>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{right}</div>
      <ThemeToggle />
      {user && (
        <Menu
          align="right"
          width={230}
          items={[
            { label: user.email, icon: <UserRound />, onClick: () => setProfileOpen(true), disabled: true },
            'divider',
            { label: 'Edit profile', icon: <UserRound />, onClick: () => setProfileOpen(true) },
            { label: 'Change password', icon: <KeyRound />, onClick: () => setPasswordOpen(true) },
            { label: 'Security & recovery', icon: <Shield />, onClick: () => setSecurityOpen(true) },
            { label: 'Workspaces', icon: <LayoutGrid />, onClick: () => navigate('/') },
            { label: 'Teams', icon: <Users />, onClick: () => navigate('/teams') },
            'divider',
            { label: 'Light theme', icon: <Sun />, onClick: () => setPreference('light'), hint: preference === 'light' ? '✓' : undefined },
            { label: 'Dark theme', icon: <Moon />, onClick: () => setPreference('dark'), hint: preference === 'dark' ? '✓' : undefined },
            { label: 'System theme', icon: <Monitor />, onClick: () => setPreference('system'), hint: preference === 'system' ? '✓' : undefined },
            'divider',
            {
              label: 'Sign out',
              icon: <LogOut />,
              danger: true,
              onClick: () => {
                void signOut().finally(() => navigate('/login'));
              },
            },
          ]}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="ml-0.5 flex items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
              aria-label="Account menu"
            >
              <Avatar name={user.name} color={user.avatarColor} size={28} />
            </button>
          )}
        />
      )}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
      {securityOpen && <SecurityModal onClose={() => setSecurityOpen(false)} />}
    </header>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.avatarColor ?? COLORS[0]);
  const update = useUpdateProfile();
  const save = () => update.mutate({ name: name.trim(), avatarColor: color }, { onSuccess: (u) => { setUser(u); onClose(); } });
  return (
    <Modal
      open
      onClose={onClose}
      title="Profile"
      description="How you appear to teammates across MagiDoc."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} disabled={!name.trim()} onClick={save}>Save changes</Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
        <div className="flex items-center gap-4 rounded-lg border border-line bg-panel-2 p-3">
          <Avatar name={name || user.name} color={color} size={44} />
          <div className="min-w-0">
            <p className="truncate font-medium">{name || user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
          </div>
        </div>
        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Avatar colour">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                onClick={() => setColor(c)}
                className={clsx('size-7 rounded-full transition cursor-pointer focus-visible:outline-none', color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : 'hover:scale-110')}
                style={{ background: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const change = useChangePassword();
  const mismatch = confirmNext.length > 0 && confirmNext !== next;
  const valid = current && next.length >= 8 && next === confirmNext;
  const save = () => change.mutate({ currentPassword: current, newPassword: next }, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={change.isPending} disabled={!valid} onClick={save}>Update password</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
        <Field label="Current password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : null}>
          <Input type="password" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} autoComplete="new-password" />
        </Field>
      </form>
    </Modal>
  );
}
