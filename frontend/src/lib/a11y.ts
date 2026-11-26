import type { KeyboardEvent } from 'react';

/**
 * Props that make a clickable non-button element (e.g. a tree row that also contains its own buttons)
 * reachable and operable from the keyboard: Tab to focus, Enter/Space to activate.
 */
export function activatable(onActivate: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    // Explicit name so nested buttons' labels aren't read as part of the row.
    'aria-label': label,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return; // let inner buttons handle their own keys
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
