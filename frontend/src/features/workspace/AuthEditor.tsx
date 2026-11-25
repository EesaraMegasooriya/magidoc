import { Info } from 'lucide-react';
import { Field, Input, Select } from '../../components/ui';
import type { AuthConfig, AuthType } from '../../types';

const LABELS: Record<AuthType, string> = {
  inherit: 'Inherit from collection',
  none: 'No auth',
  bearer: 'Bearer token',
  basic: 'Basic auth',
  apikey: 'API key',
};

export function AuthEditor({
  value,
  onChange,
  allowInherit = true,
  inherited,
  readOnly,
}: {
  value: AuthConfig;
  onChange: (v: AuthConfig) => void;
  allowInherit?: boolean;
  inherited?: AuthConfig;
  readOnly?: boolean;
}) {
  const types: AuthType[] = allowInherit ? ['inherit', 'none', 'bearer', 'basic', 'apikey'] : ['none', 'bearer', 'basic', 'apikey'];
  const set = (patch: Partial<AuthConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <Field label="Type">
          <Select value={value.type} disabled={readOnly} onChange={(e) => onChange({ type: e.target.value as AuthType })}>
            {types.map((t) => (
              <option key={t} value={t}>
                {LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs leading-relaxed text-faint">
          Values support <code className="text-accent-fg">{'{{variables}}'}</code>. Keep secrets in environment variables marked as secret.
        </p>
      </div>
      <div className="max-w-lg space-y-4">
        {value.type === 'inherit' && (
          <Note>
            This request uses the collection's auth: <strong>{LABELS[inherited?.type ?? 'none']}</strong>.
          </Note>
        )}
        {value.type === 'none' && <Note>This request does not use any authorization.</Note>}
        {value.type === 'bearer' && (
          <Field label="Token">
            <Input className="font-mono" readOnly={readOnly} value={value.token ?? ''} placeholder="{{accessToken}}" onChange={(e) => set({ token: e.target.value })} />
          </Field>
        )}
        {value.type === 'basic' && (
          <>
            <Field label="Username">
              <Input className="font-mono" readOnly={readOnly} value={value.username ?? ''} onChange={(e) => set({ username: e.target.value })} />
            </Field>
            <Field label="Password">
              <Input className="font-mono" type="password" readOnly={readOnly} value={value.password ?? ''} onChange={(e) => set({ password: e.target.value })} autoComplete="off" />
            </Field>
          </>
        )}
        {value.type === 'apikey' && (
          <>
            <Field label="Key">
              <Input className="font-mono" readOnly={readOnly} value={value.key ?? ''} placeholder="X-API-Key" onChange={(e) => set({ key: e.target.value })} />
            </Field>
            <Field label="Value">
              <Input className="font-mono" readOnly={readOnly} value={value.value ?? ''} placeholder="{{apiKey}}" onChange={(e) => set({ value: e.target.value })} />
            </Field>
            <Field label="Add to">
              <Select disabled={readOnly} value={value.in ?? 'header'} onChange={(e) => set({ in: e.target.value as 'header' | 'query' })}>
                <option value="header">Header</option>
                <option value="query">Query params</option>
              </Select>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-panel-2 px-3 py-2.5 text-sm text-muted border border-line">
      <Info className="mt-0.5 size-4 shrink-0 text-accent-fg" />
      <p>{children}</p>
    </div>
  );
}
