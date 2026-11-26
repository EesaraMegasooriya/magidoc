import clsx from 'clsx';
import { Check, Download, Laptop, Loader2, RefreshCw, Server, Wand2 } from 'lucide-react';
import { CopyButton } from '../../components/CodeView';
import { Button, Modal } from '../../components/ui';
import { AGENT_FILE, AGENT_PORT, checkAgent, useRunner, type RunnerMode } from '../../lib/runner';

const MODES: { value: RunnerMode; title: string; text: string; icon: React.ReactNode }[] = [
  { value: 'auto', title: 'Automatic (recommended)', text: 'localhost & private-network URLs use your computer; everything else uses the MagiDoc server.', icon: <Wand2 /> },
  { value: 'server', title: 'Always MagiDoc server', text: 'Every request is sent by the server. localhost won’t work.', icon: <Server /> },
  { value: 'agent', title: 'Always my computer', text: 'Every request goes through the Local Agent (e.g. for VPN-only or local-DNS APIs).', icon: <Laptop /> },
];

/** Toolbar button showing the agent state; opens the setup dialog. */
export function AgentIndicator() {
  const { agent, openSetup } = useRunner();
  const dot = agent === 'online' ? 'bg-success' : agent === 'offline' ? 'bg-danger' : agent === 'checking' ? 'bg-warning animate-pulse' : 'bg-faint';
  const label = agent === 'online' ? 'Local agent connected' : agent === 'offline' ? 'Local agent not running' : 'Local agent';
  return (
    <button
      type="button"
      onClick={openSetup}
      className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition-colors hover:bg-panel-3 hover:text-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      title="Send requests to localhost from your computer"
      aria-label={label}
    >
      <span className="relative">
        <Laptop className="size-3.5" />
        <span className={clsx('absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-panel', dot)} />
      </span>
      <span className="hidden lg:inline">Local agent</span>
    </button>
  );
}

/** Setup guide + runner mode. Rendered once per workspace. */
export function AgentSetupModal() {
  const { setupOpen, closeSetup, mode, setMode, agent, agentVersion } = useRunner();
  if (!setupOpen) return null;
  const origin = window.location.origin;
  const command = `node magidoc-agent.mjs --origin ${origin}`;

  return (
    <Modal
      open
      onClose={closeSetup}
      title="Send requests to localhost"
      description="MagiDoc’s server can’t reach your computer. The Local Agent is a tiny program you run on your machine so MagiDoc can call APIs on localhost or your private network."
      width="max-w-2xl"
      footer={<Button variant="primary" onClick={closeSetup}>Done</Button>}
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold">Where requests are sent from</h3>
          <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Where requests are sent from">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  mode === m.value ? 'border-accent/50 bg-accent-soft' : 'border-line hover:border-line-strong',
                )}
              >
                <input type="radio" name="runner-mode" className="sr-only" checked={mode === m.value} onChange={() => setMode(m.value)} />
                <span className={clsx('mt-0.5 [&>svg]:size-4', mode === m.value ? 'text-accent-fg' : 'text-muted')}>{m.icon}</span>
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">{m.title}</span>
                  <span className="block text-xs text-muted">{m.text}</span>
                </span>
                {mode === m.value && <Check className="size-4 text-accent-fg" />}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Set up the Local Agent (once per computer)</h3>
          <ol className="mt-3 space-y-4 text-[13px]">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                Install <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="font-medium text-accent-fg hover:underline">Node.js</a> 18 or newer
                (check with <code className="rounded bg-panel-3 px-1 font-mono text-xs">node -v</code>).
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                <a href={AGENT_FILE} download="magidoc-agent.mjs" className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-panel px-2.5 py-1 text-xs font-medium shadow-xs hover:bg-panel-2">
                  <Download className="size-3.5" /> Download magidoc-agent.mjs
                </a>
                <span className="ml-2 text-xs text-muted">One file, no dependencies.</span>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div className="min-w-0 flex-1">
                In a terminal, in the folder where you saved it, run:
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-panel-2 py-1.5 pl-3 pr-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs" title={command}>{command}</code>
                  <CopyButton text={command} />
                </div>
                <p className="mt-1 text-xs text-muted">Keep that terminal open while you work. It only accepts requests from this MagiDoc ({origin}).</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={4} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" icon={agent === 'checking' ? <Loader2 className="animate-spin" /> : <RefreshCw />} onClick={() => void checkAgent(true)} disabled={agent === 'checking'}>
                    Check connection
                  </Button>
                  <span role="status" className={clsx('text-xs font-medium', agent === 'online' ? 'text-success' : agent === 'offline' ? 'text-danger' : 'text-muted')}>
                    {agent === 'online'
                      ? `Connected — agent ${agentVersion ?? ''} on port ${AGENT_PORT}`
                      : agent === 'offline'
                        ? 'Not connected'
                        : agent === 'checking'
                          ? 'Checking…'
                          : 'Not checked yet'}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  If your browser asks whether this site may <em>access other apps and services on this device</em>, choose <strong>Allow</strong>.
                  Use Chrome, Edge or Firefox; Safari blocks this.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
          Without the agent, MagiDoc still tries localhost directly from your browser, which works only if your API allows CORS from <code className="font-mono">{origin}</code>.
        </p>
      </div>
    </Modal>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-fg" aria-hidden="true">
      {n}
    </span>
  );
}
