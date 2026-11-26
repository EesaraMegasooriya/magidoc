import { describe, expect, it } from 'vitest';
import { clampSidebarWidth, maxSidebarWidth, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from './sidebarWidth';

describe('sidebar width', () => {
  it('keeps the width between the minimum and maximum', () => {
    expect(clampSidebarWidth(100, 1600)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(5000, 1600)).toBe(SIDEBAR_MAX);
    expect(clampSidebarWidth(333.6, 1600)).toBe(334);
  });

  it('leaves room for the main area on small screens', () => {
    expect(maxSidebarWidth(900)).toBe(900 - 60 - 420);
    expect(clampSidebarWidth(600, 900)).toBe(420);
    expect(maxSidebarWidth(500)).toBe(SIDEBAR_MIN); // never below the minimum
  });

  it('falls back to the default for garbage values', () => {
    expect(clampSidebarWidth(Number.NaN, 1600)).toBe(SIDEBAR_DEFAULT);
  });
});
