import { describe, expect, it } from 'vitest';
import { countStatuses, integratedPercent, matchesStatus, statusOf } from './integration';
import type { IntegrationStatus } from '../types';

const r = (integrationStatus?: IntegrationStatus | null | string) => ({ integrationStatus: integrationStatus as IntegrationStatus | null | undefined });

describe('integration status', () => {
  it('treats missing, null and unknown values as not marked', () => {
    expect(statusOf(r())).toBeNull();
    expect(statusOf(r(null))).toBeNull();
    expect(statusOf(r('DONE'))).toBeNull();
    expect(statusOf(r('INTEGRATED'))).toBe('INTEGRATED');
  });

  it('filters by status, including "not marked"', () => {
    expect(matchesStatus(r('IN_PROGRESS'), 'ALL')).toBe(true);
    expect(matchesStatus(r('IN_PROGRESS'), 'IN_PROGRESS')).toBe(true);
    expect(matchesStatus(r('IN_PROGRESS'), 'INTEGRATED')).toBe(false);
    expect(matchesStatus(r(null), 'UNMARKED')).toBe(true);
    expect(matchesStatus(r('NOT_STARTED'), 'UNMARKED')).toBe(false);
  });

  it('counts every status and the integrated percentage', () => {
    const c = countStatuses([r('INTEGRATED'), r('INTEGRATED'), r('IN_PROGRESS'), r('NOT_STARTED'), r(null), r()]);
    expect(c).toEqual({ NOT_STARTED: 1, IN_PROGRESS: 1, INTEGRATED: 2, UNMARKED: 2, total: 6 });
    expect(integratedPercent(c)).toBe(33);
    expect(integratedPercent(countStatuses([]))).toBe(0);
  });
});
