import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

interface ConfirmState {
  current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      get().current?.resolve(false);
      set({ current: { ...opts, resolve } });
    }),
  close: (ok) => {
    get().current?.resolve(ok);
    set({ current: null });
  },
}));

export const confirm = (opts: ConfirmOptions) => useConfirm.getState().ask(opts);

export interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmText?: string;
}

interface PromptState {
  current: (PromptOptions & { resolve: (v: string | null) => void }) | null;
  ask: (opts: PromptOptions) => Promise<string | null>;
  close: (v: string | null) => void;
}

export const usePrompt = create<PromptState>((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<string | null>((resolve) => {
      get().current?.resolve(null);
      set({ current: { ...opts, resolve } });
    }),
  close: (v) => {
    get().current?.resolve(v);
    set({ current: null });
  },
}));

/** Resolves with the trimmed value, or null when cancelled/empty. */
export const prompt = (opts: PromptOptions) => usePrompt.getState().ask(opts);
