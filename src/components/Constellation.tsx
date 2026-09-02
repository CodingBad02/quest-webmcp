import { useMemo, useState } from 'react';
import { useAppState } from '../state/store';
import type { Campaign, Contribution } from '../types';

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function layout(c: Campaign, w: number, h: number) {
  const r = rng(c.id);
  const pts = c.questIds.map((id) => ({ id, x: 16 + r() * (w - 32), y: 12 + r() * (h - 24) }));
  // minimum spanning tree, Prim
  const edges: [number, number][] = [];
  if (pts.length > 1) {
    const inTree = new Set([0]);
    while (inTree.size < pts.length) {
      let best: [number, number, number] = [-1, -1, Infinity];
      for (const i of inTree) for (let j = 0; j < pts.length; j++) {
        if (inTree.has(j)) continue;
        const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
        if (d < best[2]) best = [i, j, d];
      }
      edges.push([best[0], best[1]]); inTree.add(best[1]);
    }
  }
  return { pts, edges };
}

function Sky({ c, contributions, w, h, compact }: { c: Campaign; contributions: Contribution[]; w: number; h: number; compact?: boolean }) {
  const { pts, edges } = useMemo(() => layout(c, w, h), [c, w, h]);
  const [hover, setHover] = useState<string | null>(null);
  const lit = new Map(contributions.filter((x) => x.status === 'approved').map((x) => [x.questId, x]));
  const litCount = pts.filter((p) => lit.has(p.id)).length;
  const who = hover ? lit.get(hover) : undefined;
  return (
    <div className={`sky ${compact ? 'compact' : ''}`}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${c.name}: ${litCount} of ${pts.length} stars lit`}>
        <defs><filter id={`glow-${c.id}`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" /></filter></defs>
        {edges.map(([a, b], i) => <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} className="edge" />)}
        {edges.map(([a, b], i) => (lit.has(pts[a].id) && lit.has(pts[b].id))
          ? <line key={`on-${i}`} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} pathLength={1} className="edge on" />
          : null)}
        {pts.map((p) => {
          const c2 = lit.get(p.id);
          return (
            <g key={p.id} className={`star ${c2 ? 'lit' : ''}`} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)} tabIndex={0}>
              {c2 && <circle cx={p.x} cy={p.y} r={12} className="halo" filter={`url(#glow-${c.id})`} />}
              <circle cx={p.x} cy={p.y} r={c2 ? 5.5 : 3.5} className="core" />
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <div className="sky-cap">
        <span className="sky-name">{c.name}</span>
        <span className="sky-count">{litCount} / {pts.length}</span>
        {who && <span className="sky-who">Lit by {who.volunteerName}. Reviewed by {who.reviewerName}.</span>}
      </div>
    </div>
  );
}

export function ConstellationStrip() {
  const campaigns = useAppState((s) => s.campaigns);
  const contributions = useAppState((s) => s.contributions);
  if (!campaigns.length) return <div className="strip" />;
  return (
    <div className="strip" aria-label="Shared constellations">
      {campaigns.map((c) => <Sky key={c.id} c={c} contributions={contributions} w={400} h={80} compact />)}
    </div>
  );
}
