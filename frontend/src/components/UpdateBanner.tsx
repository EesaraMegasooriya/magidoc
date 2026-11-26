import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isNewVersionAvailable } from '../lib/version';
import { Button, IconButton } from './ui';

const CHECK_EVERY_MS = 5 * 60_000;

/** Tells people with an open tab that a newer MagiDoc was deployed, so they don't keep using an old build. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (!stopped && document.visibilityState === 'visible' && (await isNewVersionAvailable())) setAvailable(true);
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  if (!available || dismissed) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-line-strong bg-panel px-4 py-3 shadow-xl">
      <Sparkles className="size-4 shrink-0 text-accent-fg" />
      <p className="flex-1 text-[13px]">
        <strong className="font-semibold">A new version of MagiDoc is available.</strong>{' '}
        <span className="text-muted">Save your work, then reload.</span>
      </p>
      <Button size="sm" variant="primary" icon={<RefreshCw />} onClick={() => window.location.reload()}>
        Reload
      </Button>
      <IconButton size="sm" label="Dismiss" onClick={() => setDismissed(true)}>
        <X />
      </IconButton>
    </div>
  );
}
