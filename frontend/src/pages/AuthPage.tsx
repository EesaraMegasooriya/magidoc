import { BookOpen, Check, Eye, EyeOff, FlaskConical, Share2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/hooks';
import { Logo } from '../components/Logo';
import { MethodPill } from '../components/MethodBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../store/auth';

const FEATURES = [
  { icon: FlaskConical, title: 'Test any API', text: 'Environments, variables and auth — sent server-side, no CORS issues.' },
  { icon: BookOpen, title: 'Docs from your requests', text: 'Markdown docs, saved examples and code samples per endpoint.' },
  { icon: Users, title: 'Built for teams', text: 'Workspaces, teams and role-based access control.' },
  { icon: Share2, title: 'Publish in one click', text: 'Share read-only docs with a secure, revocable link.' },
];

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const location = useLocation();
  const navState = location.state as { from?: string; email?: string } | null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState(navState?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const from = navState?.from ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = isLogin ? await authApi.login(email, password) : await authApi.register(name, email, password);
      setUser(res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full bg-bg">
      {/* Product panel */}
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden border-r border-line bg-panel p-10 lg:flex">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <Logo size={28} className="relative" />
        <div className="relative">
          <h1 className="max-w-md text-[34px] font-semibold leading-[1.15] tracking-tight text-fg">
            The workspace where APIs get <span className="brand-text">designed, tested & documented</span>.
          </h1>
          <ul className="mt-8 grid max-w-lg gap-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-accent-fg">
                  <f.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">{f.title}</p>
                  <p className="text-[13px] text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* Product preview */}
          <div className="mt-10 max-w-lg overflow-hidden rounded-xl border border-line bg-bg shadow-sm" aria-hidden="true">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <MethodPill method="GET" />
              <code className="truncate font-mono text-xs text-muted">{'{{baseUrl}}'}/v1/users/42</code>
              <span className="ml-auto rounded-md bg-success-soft px-1.5 py-0.5 font-mono text-[11px] font-medium text-success">200 OK · 84 ms</span>
            </div>
            <pre className="code-area px-4 py-3 text-[12px]">
              {'{\n  '}
              <span className="j-key">"id"</span>: <span className="j-num">42</span>
              {',\n  '}
              <span className="j-key">"name"</span>: <span className="j-str">"Ada Lovelace"</span>
              {',\n  '}
              <span className="j-key">"role"</span>: <span className="j-str">"admin"</span>
              {'\n}'}
            </pre>
          </div>
        </div>
        <p className="relative text-xs text-faint">© {new Date().getFullYear()} MagiDoc</p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo size={24} className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[380px]">
            <h2 className="text-2xl font-semibold tracking-tight">{isLogin ? 'Sign in to MagiDoc' : 'Create your account'}</h2>
            <p className="mt-1.5 text-sm text-muted">
              {isLogin ? 'Welcome back! Enter your details to continue.' : 'Free forever for personal workspaces. No card needed.'}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4" noValidate={false}>
              {!isLogin && (
                <Field label="Full name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus autoComplete="name" placeholder="Ada Lovelace" className="h-10" />
                </Field>
              )}
              <Field label="Work email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={isLogin} placeholder="you@company.com" autoComplete="email" className="h-10" />
              </Field>
              <Field
                label="Password"
                htmlFor="password"
                hint={
                  isLogin ? (
                    <Link to="/reset-password" state={{ email }} className="font-medium text-accent-fg hover:underline">
                      Forgot password?
                    </Link>
                  ) : undefined
                }
              >
                <div className="relative">
                  <Input
                    id="password"
                    aria-describedby={isLogin ? 'password-desc' : undefined}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLogin ? undefined : 8}
                    placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:text-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              {!isLogin && (
                <p className={`flex items-center gap-1.5 text-xs ${password.length >= 8 ? 'text-success' : 'text-faint'}`}>
                  <Check className="size-3.5" /> At least 8 characters
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                {isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-muted">
              {isLogin ? 'New to MagiDoc? ' : 'Already have an account? '}
              <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-medium text-accent-fg hover:underline">
                {isLogin ? 'Create an account' : 'Sign in'}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
