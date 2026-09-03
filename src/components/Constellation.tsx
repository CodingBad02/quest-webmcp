/**
 * Static SVG constellation. The fallback sky for browsers without WebGL and for people who asked
 * for reduced motion: same places, same tree, no animation. Rendered by Sky.tsx inside `.sky-root`.
 */
import type { Contribution } from '../types';
import type { PlacedLayout, StarTier } from './skyLayout';

interface Props {
  layout: PlacedLayout;
  tiers: Map<string, { tier: StarTier; contribution: Contribution }>;
  w: number;
  h: number;
  onHover: (index: number, x: number, y: number) => void;
}

export function ConstellationStatic({ layout, tiers, w, h, onHover }: Props) {
  const { stars, edges } = layout;
  const tierOf = (i: number): 0 | StarTier => tiers.get(stars[i].questId)?.tier ?? 0;
  return (
    <div className="sky-svg">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Shared sky of campaigns">
        <defs>
          <filter id="sky-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        {edges.map(([a, b], i) => <line key={i} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} className="edge" />)}
        {edges.map(([a, b], i) => (tierOf(a) >= 1 && tierOf(b) >= 1) ? <line key={`on-${i}`} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} className="edge on" /> : null)}
        {stars.map((s, i) => {
          const t = tierOf(i);
          return (
            <g key={s.questId} className={`star ${t === 2 ? 'landed' : t === 1 ? 'approved' : ''}`}>
              {t === 2 && <circle cx={s.x} cy={s.y} r={16} className="halo" filter="url(#sky-glow)" />}
              {t === 1 ? (
                <circle cx={s.x} cy={s.y} r={5} className="core ring" fill="none" />
              ) : (
                <circle cx={s.x} cy={s.y} r={t === 2 ? 4 : 1.6 + s.seed * 0.9} className="core" />
              )}
            </g>
          );
        })}
      </svg>
      {stars.map((s, i) => {
        const t = tierOf(i);
        const c = t > 0 ? tiers.get(s.questId)?.contribution : undefined;
        const label = t === 2 ? `${s.placeName}. Landed. Reviewed by ${c?.reviewerName}.` : t === 1 ? `${s.placeName}. Approved. Reviewed by ${c?.reviewerName}.` : `${s.placeName}, ${s.gap}. Not lit.`;
        return (
          <button
            key={`hit-${s.questId}`}
            type="button"
            className="star-hit"
            style={{ left: s.x, top: s.y }}
            aria-label={label}
            onMouseEnter={() => onHover(i, s.x, s.y)}
            onMouseLeave={() => onHover(-1, 0, 0)}
            onFocus={() => onHover(i, s.x, s.y)}
            onBlur={() => onHover(-1, 0, 0)}
          />
        );
      })}
    </div>
  );
}
