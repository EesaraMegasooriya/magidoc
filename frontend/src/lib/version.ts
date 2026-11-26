/** Detects that a newer build was deployed while this tab was open. */

/** The hashed entry script a built index.html loads, e.g. "/assets/index-C6OOA-Wt.js" (null in dev). */
export function entryScript(html: string): string | null {
  const m = /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i.exec(html) ?? /src="([^"]*\/assets\/index-[^"]+\.js)"[^>]*type="module"/i.exec(html);
  return m ? new URL(m[1], 'http://x').pathname : null;
}

/** Entry script of the build running in this tab. */
export function runningEntryScript(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src).pathname : null;
}

/** True when the server now serves a different build than the one running here. */
export async function isNewVersionAvailable(): Promise<boolean> {
  const running = runningEntryScript();
  if (!running) return false; // dev server: nothing to compare
  try {
    const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
    if (!res.ok) return false;
    const latest = entryScript(await res.text());
    return !!latest && latest !== running;
  } catch {
    return false; // offline or server restarting: try again later
  }
}

const RELOAD_KEY = 'magidoc-chunk-reload';

/**
 * After a deploy, an old tab may request code chunks that no longer exist. Reload once to get the new build,
 * but never more than once a minute (avoids a reload loop if something else is wrong).
 */
export function installChunkErrorRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    } catch {
      /* storage unavailable */
    }
    if (Date.now() - last < 60_000) return; // already tried: let the error surface
    event.preventDefault();
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
    window.location.reload();
  });
}
