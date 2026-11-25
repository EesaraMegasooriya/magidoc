import { Download, KeyRound, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGenerateRecoveryCodes, useRecoveryStatus, useSignOutEverywhere } from '../api/hooks';
import { confirm } from '../store/confirm';
import { useAuth } from '../store/auth';
import { CopyButton } from './CodeView';
import { Button, Field, Input, Modal, Skeleton } from './ui';

/** Account security: recovery codes (password reset without email) and session management. */
export function SecurityModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const { data: status, isLoading } = useRecoveryStatus();
  const generate = useGenerateRecoveryCodes();
  const signOutAll = useSignOutEverywhere();
  const clear = useAuth((s) => s.clear);
  const email = useAuth((s) => s.user?.email ?? '');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [asking, setAsking] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  const download = () => {
    const text = `MagiDoc recovery codes for ${email}\nGenerated ${new Date().toLocaleString()}\n\nEach code works once. Use one on the “Forgot password?” page.\n\n${codes!.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magidoc-recovery-codes.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  };

  // While fresh codes are on screen, closing requires confirming they were saved.
  const close = async () => {
    if (codes && !saved && !(await confirm({ title: 'Close without saving your codes?', message: 'They are shown only once. You can generate new ones later.', confirmText: 'Close anyway', danger: true }))) return;
    onClose();
  };

  if (codes) {
    return (
      <Modal
        open
        onClose={close}
        title="Save your recovery codes"
        description="Store them somewhere safe, like a password manager. Each code can reset your password once. They won’t be shown again."
        footer={
          <>
            <CopyButton text={codes.join('\n')} label="Copy all" className="mr-auto" />
            <Button icon={<Download />} onClick={download}>Download .txt</Button>
            <Button variant="primary" onClick={onClose} disabled={!saved} title={saved ? undefined : 'Copy or download first'}>Done</Button>
          </>
        }
      >
        <ol className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel-2 p-4 font-mono text-sm" onCopy={() => setSaved(true)}>
          {codes.map((c) => (
            <li key={c} className="select-all tracking-wider">{c}</li>
          ))}
        </ol>
        <label className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" className="accent-accent" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I’ve saved these codes somewhere safe
        </label>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Security" width="max-w-lg">
      <div className="space-y-6">
        <section>
          <div className="flex items-start gap-3">
            {isLoading ? (
              <Skeleton className="size-9 rounded-lg" />
            ) : status && status.remaining > 0 ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success"><ShieldCheck className="size-4" /></span>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"><ShieldAlert className="size-4" /></span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Recovery codes</h3>
              <p className="mt-0.5 text-[13px] text-muted">
                {isLoading
                  ? 'Checking…'
                  : status && status.remaining > 0
                    ? `${status.remaining} of ${status.total} unused${status.generatedAt ? ` · created ${new Date(status.generatedAt).toLocaleDateString()}` : ''}.`
                    : 'Not set up. Without them a forgotten password can’t be reset — MagiDoc doesn’t send emails.'}
              </p>
            </div>
          </div>
          {asking ? (
            <form
              className="mt-3 space-y-3 rounded-lg border border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                generate.mutate(password, { onSuccess: (r) => { setCodes(r.codes); setPassword(''); } });
              }}
            >
              <Field label="Confirm your current password" hint={status && status.total > 0 ? 'Generating new codes invalidates your existing ones.' : undefined}>
                <Input type="password" autoFocus required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={generate.isPending} disabled={!password}>Generate codes</Button>
              </div>
            </form>
          ) : (
            <Button className="mt-3" icon={<KeyRound />} variant={status && status.remaining > 0 ? 'secondary' : 'primary'} onClick={() => setAsking(true)}>
              {status && status.total > 0 ? 'Generate new codes' : 'Create recovery codes'}
            </Button>
          )}
        </section>

        <section className="border-t border-line pt-5">
          <h3 className="text-sm font-semibold">Sessions</h3>
          <p className="mt-0.5 text-[13px] text-muted">Lost a device or signed in somewhere public? Sign out everywhere, including here.</p>
          <Button
            className="mt-3"
            variant="danger"
            icon={<LogOut />}
            loading={signOutAll.isPending}
            onClick={async () => {
              if (await confirm({ title: 'Sign out of all devices?', message: 'Every session, including this one, ends immediately.', confirmText: 'Sign out everywhere', danger: true }))
                signOutAll.mutate(undefined, { onSuccess: () => { clear(); navigate('/login'); } });
            }}
          >
            Sign out of all devices
          </Button>
        </section>
      </div>
    </Modal>
  );
}
