/**
 * Static SVG constellation. The fallback sky for browsers without WebGL and for people who asked
 * for reduced motion: same places, same tree, no animation. Rendered by Sky.tsx inside `.sky-root`.
 */
import type { Contribution } from '../types';
import type { PlacedLayout } from './skyLayout';

interface Props {
  layout: PlacedLayout;
  lit: Map<string, Contribution>;
  w: number;
  h: number;
  onHover: (index: number, x: number, y: number) => void;
}

export function ConstellationStatic({ layout, lit, w, h, onHover }: Props) {
  const { stars, edges } = layout;
  const isLit = (i: number) => lit.has(stars[i].questId);
  return (
    <div className="sky-svg">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Shared sky of campaigns">
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070912" />
            <stop offset="1" stopColor="#0e1326" />
          </linearGradient>
          <filter id="sky-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <rect width={w} height={h} fill="url(#sky-grad)" />
        {edges.map(([a, b], i) => <line key={i} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} className="edge" />)}
        {edges.map(([a, b], i) => (isLit(a) && isLit(b)) ? <line key={`on-${i}`} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} className="edge on" /> : null)}
        {stars.map((s, i) => {
          const on = isLit(i);
          return (
            <g key={s.questId} className={`star ${on ? 'lit' : ''}`}>
              {on && <circle cx={s.x} cy={s.y} r={16} className="halo" filter="url(#sky-glow)" />}
              <circle cx={s.x} cy={s.y} r={on ? 4 : 1.6 + s.seed * 0.9} className="core" />
            </g>
          );
        })}
      </svg>
      {stars.map((s, i) => {
        const c = lit.get(s.questId);
        return (
          <button
            key={`hit-${s.questId}`}
            type="button"
            className="star-hit"
            style={{ left: s.x, top: s.y }}
            aria-label={c ? `${s.placeName}. Lit by ${c.volunteerName}. Reviewed by ${c.reviewerName}.` : `${s.placeName}, ${s.gap}. Not lit.`}
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
