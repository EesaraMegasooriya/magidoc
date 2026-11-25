import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'magidoc-theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (p: ThemePreference): 'light' | 'dark' => (p === 'system' ? (media?.matches ? 'dark' : 'light') : p);

function apply(resolved: 'light' | 'dark', animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 200);
  }
  root.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0b0f' : '#f6f6f8');
}

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const initial = readPreference();

export const useTheme = create<ThemeState>((set, get) => ({
  preference: initial,
  resolved: resolve(initial),
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* storage unavailable: keep the choice for this session only */
    }
    const resolved = resolve(preference);
    apply(resolved, true);
    set({ preference, resolved });
  },
  toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark'),
}));

/** Call once at startup: applies the theme and follows OS changes while on "system". */
export function initTheme() {
  apply(useTheme.getState().resolved, false);
  media?.addEventListener('change', () => {
    const { preference } = useTheme.getState();
    if (preference !== 'system') return;
    const resolved = resolve('system');
    apply(resolved, true);
    useTheme.setState({ resolved });
  });
}
