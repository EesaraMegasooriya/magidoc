/** Sidebar width limits (px). The upper bound also leaves room for the rail and a usable main area. */
export const SIDEBAR_DEFAULT = 280;
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 640;
const RAIL = 60;
const MIN_MAIN = 420;

export function maxSidebarWidth(viewportWidth: number): number {
  return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, viewportWidth - RAIL - MIN_MAIN));
}

export function clampSidebarWidth(width: number, viewportWidth: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT;
  return Math.round(Math.min(Math.max(width, SIDEBAR_MIN), maxSidebarWidth(viewportWidth)));
}
