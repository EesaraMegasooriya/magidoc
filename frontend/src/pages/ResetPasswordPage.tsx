import { ArrowLeft, Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/hooks';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';

/** Forgotten password → reset with a one-time recovery code (MagiDoc doesn't send emails). */
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch || password.length < 8) return;
    setError(null);
    setLoading(true);
    try {
      const { recoveryCodesRemaining } = await authApi.resetPassword(email.trim(), code, password);
      toast.success(
        recoveryCodesRemaining > 0
          ? `Password reset. ${recoveryCodesRemaining} recovery codes left.`
          : 'Password reset. That was your last recovery code — create new ones in Security.',
        { duration: 6000 },
      );
      navigate('/login', { replace: true, state: { email: email.trim() } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between p-4">
        <Link to="/login" aria-label="Back to sign in"><Logo size={24} /></Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[380px]">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1.5 text-sm text-muted">Use one of the recovery codes you saved. Each code works once, and resetting signs you out everywhere.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" required autoFocus={!email} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
            </Field>
            <Field label="Recovery code">
              <Input
                required
                autoFocus={!!email}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXXX-XXXXX"
                autoComplete="one-time-code"
                spellCheck={false}
                className="h-10 font-mono uppercase tracking-wider"
              />
            </Field>
            <Field label="New password">
              <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
            </Field>
            <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : null}>
              <Input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10" />
            </Field>
            <p className={`flex items-center gap-1.5 text-xs ${password.length >= 8 ? 'text-success' : 'text-faint'}`}>
              <Check className="size-3.5" /> At least 8 characters
            </p>
            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} disabled={mismatch || password.length < 8}>
              Reset password
            </Button>
          </form>
          <p className="mt-6 text-[13px] leading-relaxed text-faint">
            No recovery codes? A forgotten password can’t be reset without one. Ask a workspace admin to add your new account to their workspaces.
          </p>
        </div>
      </main>
    </div>
  );
}
