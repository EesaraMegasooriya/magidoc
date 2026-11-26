import type { ApiRequest, IntegrationStatus } from '../types';

/** Workflow order: what the team does first → last. */
export const INTEGRATION_STATUSES: IntegrationStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'INTEGRATED'];

export const INTEGRATION_LABEL: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'Not yet',
  IN_PROGRESS: 'Integrating',
  INTEGRATED: 'Integrated',
};

export const INTEGRATION_DESCRIPTION: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'Not wired into the app yet',
  IN_PROGRESS: 'Someone is integrating it now',
  INTEGRATED: 'Done and working in the app',
};

/** Sidebar filter: every request, one status, or requests nobody has marked yet. */
export type StatusFilter = 'ALL' | IntegrationStatus | 'UNMARKED';

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  ALL: 'All requests',
  ...INTEGRATION_LABEL,
  UNMARKED: 'Not marked',
};

export function statusOf(r: Pick<ApiRequest, 'integrationStatus'>): IntegrationStatus | null {
  const s = r.integrationStatus;
  return s && (INTEGRATION_STATUSES as string[]).includes(s) ? s : null;
}

export function matchesStatus(r: Pick<ApiRequest, 'integrationStatus'>, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  const s = statusOf(r);
  return filter === 'UNMARKED' ? s === null : s === filter;
}

export interface StatusCounts {
  NOT_STARTED: number;
  IN_PROGRESS: number;
  INTEGRATED: number;
  UNMARKED: number;
  total: number;
}

export function countStatuses(requests: Pick<ApiRequest, 'integrationStatus'>[]): StatusCounts {
  const counts: StatusCounts = { NOT_STARTED: 0, IN_PROGRESS: 0, INTEGRATED: 0, UNMARKED: 0, total: requests.length };
  for (const r of requests) counts[statusOf(r) ?? 'UNMARKED']++;
  return counts;
}

/** Whole-number percentage of requests that are integrated (0 for an empty collection). */
export function integratedPercent(c: StatusCounts): number {
  return c.total === 0 ? 0 : Math.round((c.INTEGRATED / c.total) * 100);
}
