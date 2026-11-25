import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

/**
 * The session itself lives in an HttpOnly cookie that scripts can't read. Only the (non-secret) profile is
 * kept here so the UI knows who is signed in; the server remains the source of truth.
 */
interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  /** Clears local state only. Use signOut() to also end the server session. */
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'magidoc-auth',
      version: 1,
      // v0 stored the bearer token in localStorage; drop it so no credential lingers in browser storage.
      migrate: (persisted) => ({ user: (persisted as { user?: User | null } | null)?.user ?? null }),
    },
  ),
);
