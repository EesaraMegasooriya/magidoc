import { create } from 'zustand';
import type { Snippet, SnippetKind } from '../types';

/** Unsaved edits of a text, kept in memory so switching tabs doesn't lose them. */
export interface SnippetDraft {
  title: string;
  kind: SnippetKind;
  language: string | null;
  content: string;
  /** Version the edit started from; sent with the save for conflict detection. */
  baseVersion: number;
}

export const draftFrom = (s: Snippet): SnippetDraft => ({
  title: s.title,
  kind: s.kind,
  language: s.language,
  content: s.content,
  baseVersion: s.version,
});

/** True when the draft's editable fields differ from the saved text. */
export const draftChanged = (d: SnippetDraft, s: Snippet) =>
  d.title !== s.title || d.kind !== s.kind || (d.kind === 'CODE' && d.language !== s.language) || d.content !== s.content;

interface SnippetStore {
  drafts: Record<string, SnippetDraft>;
  setDraft: (id: string, d: SnippetDraft) => void;
  clearDraft: (id: string) => void;
}

export const useSnippetStore = create<SnippetStore>((set) => ({
  drafts: {},
  setDraft: (id, d) => set((s) => ({ drafts: { ...s.drafts, [id]: d } })),
  clearDraft: (id) =>
    set((s) => {
      const drafts = { ...s.drafts };
      delete drafts[id];
      return { drafts };
    }),
}));

export const CODE_LANGUAGES: { id: string; label: string }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'json', label: 'JSON' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Shell / Bash' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'dockerfile', label: 'Dockerfile' },
];

export const languageLabel = (id: string | null) => CODE_LANGUAGES.find((l) => l.id === id)?.label ?? id ?? 'Code';
