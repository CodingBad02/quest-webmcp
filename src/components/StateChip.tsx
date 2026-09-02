/**
 * The lifecycle state chip (DESIGN.md §4). One component renders all ten envelope states from
 * `SPEC.md`, used in the quest list, the workspace, the reviewer queue, and the sky legend.
 * Color never carries meaning alone: each state pairs a color token with a glyph shape from one
 * of three families — circle (progress toward landed), triangle (needs a person's attention),
 * diamond (a conflict with the world). `approved` breaks the circle-fill pattern on purpose: an
 * outlined ring, never filled, because a reviewer's approval is not the same fact as a landed
 * public write.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ContributionStatus } from '../types';

export type ChipState = ContributionStatus;

type Family = 'circle' | 'triangle' | 'diamond';
type Fill = 'none' | 'partial' | 'full' | 'outline' | 'glow';
type Mark = 'check' | 'dot' | 'exclaim' | undefined;

interface GlyphSpec { family: Family; fill: Fill; mark?: Mark }

const LABEL: Record<ChipState, string> = {
  available: 'Available',
  open: 'Open',
  checked: 'Checked',
  submitted: 'Sent for review',
  approved: 'Approved',
  landed: 'Landed',
  invalid: 'Needs a fix',
  declined: 'Kept editing',
  rejected: 'Sent back',
  stale: 'Out of date',
};

const GLYPH: Record<ChipState, GlyphSpec> = {
  available: { family: 'circle', fill: 'none' },
  open: { family: 'circle', fill: 'partial' },
  checked: { family: 'circle', fill: 'full', mark: 'check' },
  submitted: { family: 'circle', fill: 'full', mark: 'dot' },
  approved: { family: 'circle', fill: 'outline' },
  landed: { family: 'circle', fill: 'glow' },
  invalid: { family: 'triangle', fill: 'full', mark: 'exclaim' },
  declined: { family: 'triangle', fill: 'outline', mark: 'exclaim' },
  rejected: { family: 'triangle', fill: 'full', mark: 'exclaim' },
  stale: { family: 'diamond', fill: 'full' },
};

/** Contrasts reliably against any of the chip's saturated fill colors — the same relationship
 *  DESIGN.md §13 already verifies in reverse (fill color on `--qt-color-surface`). */
const MARK_COLOR = 'var(--qt-color-surface, #fff)';

function Glyph({ family, fill, mark, glowId }: GlyphSpec & { glowId: string }) {
  if (family === 'diamond') {
    return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.2 14.8 8 8 14.8 1.2 8Z" fill="currentColor" /></svg>;
  }
  if (family === 'triangle') {
    const filled = fill !== 'outline';
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 2.3 14.2 13.3H1.8Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        {mark === 'exclaim' && (
          <>
            <rect x="7.3" y="6.6" width="1.4" height="3.4" rx=".7" fill={filled ? MARK_COLOR : 'currentColor'} />
            <rect x="7.3" y="10.8" width="1.4" height="1.4" rx=".7" fill={filled ? MARK_COLOR : 'currentColor'} />
          </>
        )}
      </svg>
    );
  }
  // circle
  if (fill === 'none') return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
  if (fill === 'outline') return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  if (fill === 'partial') return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
      <path d="M8 2a6 6 0 0 1 6 6H8Z" fill="currentColor" />
    </svg>
  );
  if (fill === 'glow') return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <defs><filter id={glowId}><feGaussianBlur stdDeviation="1.6" /></filter></defs>
      <circle cx="8" cy="8" r="6.5" fill="currentColor" filter={`url(#${glowId})`} opacity=".65" />
      <circle cx="8" cy="8" r="5" fill="currentColor" />
    </svg>
  );
  // full
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="currentColor" />
      {mark === 'check' && <path d="M5 8.3 7 10.3 11 5.7" fill="none" stroke={MARK_COLOR} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {mark === 'dot' && <circle cx="8" cy="3.6" r="1.1" fill={MARK_COLOR} />}
    </svg>
  );
}

/**
 * `pulse`: this chip is the signed-in volunteer's own latest contribution. When true, the chip
 * scales once (1 → 1.08 → 1, 400ms, ease-out) the first time `state` changes while mounted — never
 * on initial mount, and never more than once per change (DESIGN.md §4).
 */
export function StateChip({ state, pulse }: { state: ChipState; pulse?: boolean }) {
  const glowId = useId();
  const spec = GLYPH[state];
  const mounted = useRef(false);
  const prev = useRef(state);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prev.current = state;
      return;
    }
    if (pulse && state !== prev.current) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 400);
      prev.current = state;
      return () => clearTimeout(t);
    }
    prev.current = state;
  }, [state, pulse]);

  return (
    <span className={`state-chip${pulsing ? ' state-chip-pulse' : ''}`} data-state={state}>
      <span className="state-chip-glyph" aria-hidden="true"><Glyph family={spec.family} fill={spec.fill} mark={spec.mark} glowId={glowId} /></span>
      <span className="state-chip-label">{LABEL[state]}</span>
    </span>
  );
}
