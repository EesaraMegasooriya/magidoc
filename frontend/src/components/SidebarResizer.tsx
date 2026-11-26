import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../lib/cn';
import { clampSidebarWidth, maxSidebarWidth, SIDEBAR_DEFAULT, SIDEBAR_MIN } from '../lib/sidebarWidth';

const STORAGE_KEY = 'magidoc-sidebar-width';

function readWidth(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return clampSidebarWidth(saved || SIDEBAR_DEFAULT, window.innerWidth);
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

function persist(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    /* storage unavailable */
  }
}

/** Remembered sidebar width that re-clamps when the window gets smaller. */
export function useSidebarWidth() {
  const [width, setWidth] = useState(readWidth);
  useEffect(() => {
    const onResize = () => setWidth((w) => clampSidebarWidth(w, window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const set = (w: number, save = true) => {
    const next = clampSidebarWidth(w, window.innerWidth);
    setWidth(next);
    if (save) persist(next);
  };
  return [width, set] as const;
}

/**
 * Vertical drag handle on the sidebar's right edge (WAI-ARIA "window splitter").
 * Drag with mouse/touch/pen, use ←/→ (Shift for bigger steps) or Home/End, double-click to reset.
 */
export function SidebarResizer({ width, onChange }: { width: number; onChange: (width: number, save?: boolean) => void }) {
  const drag = useRef<{ startX: number; startWidth: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    // Keep the resize cursor and stop text selection everywhere while dragging.
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [dragging]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width, last: width };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = clampSidebarWidth(drag.current.startWidth + e.clientX - drag.current.startX, window.innerWidth);
    drag.current.last = next;
    onChange(next, false);
  };
  const finish = () => {
    if (!drag.current) return;
    onChange(drag.current.last, true);
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const map: Record<string, number> = {
      ArrowLeft: width - step,
      ArrowRight: width + step,
      Home: SIDEBAR_MIN,
      End: maxSidebarWidth(window.innerWidth),
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onChange(map[e.key]);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={maxSidebarWidth(typeof window === 'undefined' ? 1600 : window.innerWidth)}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={() => onChange(SIDEBAR_DEFAULT)}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -right-2.5 z-20 flex w-3 cursor-col-resize touch-none justify-start focus-visible:outline-none"
    >
      <span
        className={cn(
          'h-full w-0.5 transition-colors',
          dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent',
        )}
      />
    </div>
  );
}
