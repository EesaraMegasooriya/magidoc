import { Circle, CircleCheck, CircleDashed, CirclePlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSetIntegrationStatus } from '../../api/hooks';
import { cn } from '../../lib/cn';
import { countStatuses, INTEGRATION_DESCRIPTION, INTEGRATION_LABEL, INTEGRATION_STATUSES, integratedPercent, statusOf } from '../../lib/integration';
import type { ApiRequest, IntegrationStatus } from '../../types';
import { Menu, type MenuItem } from '../../components/ui';
import { useWs } from './context';

/** Colour + shape per status, so it reads even for colour-blind users (empty ring → dashed ring → check). */
export const STATUS_TEXT_CLASS: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'text-danger',
  IN_PROGRESS: 'text-warning',
  INTEGRATED: 'text-success',
};

export const STATUS_PILL_CLASS: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'border-danger/30 bg-danger-soft text-danger',
  IN_PROGRESS: 'border-warning/30 bg-warning-soft text-warning',
  INTEGRATED: 'border-success/30 bg-success-soft text-success',
};

export const STATUS_BAR_CLASS: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'bg-danger',
  IN_PROGRESS: 'bg-warning',
  INTEGRATED: 'bg-success',
};

export function StatusIcon({ status, className }: { status: IntegrationStatus; className?: string }) {
  const cls = cn('size-3.5 shrink-0', STATUS_TEXT_CLASS[status], className);
  if (status === 'INTEGRATED') return <CircleCheck className={cls} aria-hidden="true" />;
  if (status === 'IN_PROGRESS') return <CircleDashed className={cls} aria-hidden="true" />;
  return <Circle className={cls} aria-hidden="true" />;
}

/** Read-only pill: icon + label. */
export function StatusPill({ status, className }: { status: IntegrationStatus; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium', STATUS_PILL_CLASS[status], className)}>
      <StatusIcon status={status} className="size-3" />
      {INTEGRATION_LABEL[status]}
    </span>
  );
}

type StatusRequest = Pick<ApiRequest, 'id' | 'collectionId' | 'name' | 'integrationStatus'>;

/** "Set status" menu items, shared by the picker and the request's ⋯ menu. */
export function useStatusMenuItems(request: StatusRequest): (MenuItem | 'divider')[] {
  const set = useSetIntegrationStatus(useWs().wsId);
  const current = statusOf(request);
  const choose = (status: IntegrationStatus | null) => {
    if (status !== current) set.mutate({ id: request.id, collectionId: request.collectionId, status });
  };
  return [
    ...INTEGRATION_STATUSES.map((s) => ({
      label: INTEGRATION_LABEL[s],
      icon: <StatusIcon status={s} />,
      checked: current === s,
      onClick: () => choose(s),
    })),
    'divider',
    { label: 'Clear status', icon: <X />, disabled: current === null, onClick: () => choose(null) },
  ];
}

/**
 * Status control for a request. Editors get a button that opens the picker; viewers see the status only.
 * `variant="icon"` is the compact sidebar form; `variant="pill"` is the labelled form for headers.
 */
export function StatusPicker({
  request,
  canEdit,
  variant,
  className,
}: {
  request: StatusRequest;
  canEdit: boolean;
  variant: 'icon' | 'pill';
  className?: string;
}) {
  const items = useStatusMenuItems(request);
  const status = statusOf(request);
  const name = status ? INTEGRATION_LABEL[status] : 'Not marked';
  const tooltip = status ? `${name}: ${INTEGRATION_DESCRIPTION[status]}` : 'Integration status not marked';

  if (!canEdit) {
    if (!status) return variant === 'pill' ? <span className="text-xs text-faint">Not marked</span> : null;
    return variant === 'pill' ? (
      <span title={tooltip}><StatusPill status={status} /></span>
    ) : (
      <span title={tooltip} role="img" aria-label={`Integration status: ${name}`} className={cn('flex size-5 items-center justify-center', className)}>
        <StatusIcon status={status} />
      </span>
    );
  }

  let content: ReactNode;
  if (variant === 'pill') {
    content = status ? (
      <StatusPill status={status} className="cursor-pointer transition-[filter] hover:brightness-110" />
    ) : (
      <span className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2 text-xs font-medium text-muted transition-colors hover:border-faint hover:text-fg">
        <CirclePlus className="size-3" aria-hidden="true" />
        Set status
      </span>
    );
  } else {
    content = status ? (
      <StatusIcon status={status} />
    ) : (
      // Unmarked rows stay clean: the "add" affordance only appears on hover/focus.
      <CirclePlus className="size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden="true" />
    );
  }

  return (
    <Menu
      align="right"
      width={190}
      items={items}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          title={`${tooltip}. Click to change`}
          aria-label={`Integration status: ${name}. Change status`}
          aria-haspopup="menu"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            variant === 'icon' && 'size-5 hover:bg-panel-2',
            className,
          )}
        >
          {content}
        </button>
      )}
    />
  );
}

/** Collection-level progress: a stacked bar plus a legend with counts. */
export function IntegrationProgress({ requests }: { requests: Pick<ApiRequest, 'integrationStatus'>[] }) {
  const counts = countStatuses(requests);
  if (counts.total === 0) return null;
  const pct = integratedPercent(counts);
  const nothingMarked = counts.UNMARKED === counts.total;
  const summary = `${counts.INTEGRATED} of ${counts.total} requests integrated (${pct}%), ${counts.IN_PROGRESS} integrating, ${counts.NOT_STARTED} not yet, ${counts.UNMARKED} not marked`;

  return (
    <section className="mb-6 rounded-xl border border-line bg-panel p-4" aria-label="Integration progress">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Integration progress</h3>
        <p className="text-sm text-muted">
          <span className="font-semibold text-fg">{counts.INTEGRATED}</span> of {counts.total} integrated
          <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{pct}%</span>
        </p>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-panel-3" role="img" aria-label={summary}>
        {(['INTEGRATED', 'IN_PROGRESS', 'NOT_STARTED'] as IntegrationStatus[]).map((s) =>
          counts[s] > 0 ? <div key={s} className={cn('h-full', STATUS_BAR_CLASS[s])} style={{ width: `${(counts[s] / counts.total) * 100}%` }} /> : null,
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {INTEGRATION_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} className="size-3" />
            {INTEGRATION_LABEL[s]} <span className="font-semibold text-fg">{counts[s]}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-dashed border-line-strong" aria-hidden="true" />
          Not marked <span className="font-semibold text-fg">{counts.UNMARKED}</span>
        </li>
      </ul>
      {nothingMarked && (
        <p className="mt-3 text-xs text-faint">
          Mark each request as <b>Not yet</b>, <b>Integrating</b> or <b>Integrated</b> with the status icon beside it in the sidebar, or the status button at the top of an open request.
        </p>
      )}
    </section>
  );
}
