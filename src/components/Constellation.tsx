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
  const pts = c.questIds.map((id) => ({ id, x: 12 + r() * (w - 24), y: 8 + r() * (h - 16) }));
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
  return (
    <div className={`sky ${compact ? 'compact' : ''}`}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${c.name}: ${litCount} of ${pts.length} stars lit`}>
        <defs><filter id={`glow-${c.id}`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" /></filter></defs>
        {edges.map(([a, b], i) => {
          const on = lit.has(pts[a].id) && lit.has(pts[b].id);
          return <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} className={`edge ${on ? 'on' : ''}`} />;
        })}
        {pts.map((p) => {
          const c2 = lit.get(p.id);
          return (
            <g key={p.id} className={`star ${c2 ? 'lit' : ''}`} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)} tabIndex={0}>
              {c2 && <circle cx={p.x} cy={p.y} r={7} className="halo" filter={`url(#glow-${c.id})`} />}
              <circle cx={p.x} cy={p.y} r={c2 ? 3.6 : 2.6} className="core" />
              <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <div className="sky-cap">
        <span className="sky-name">{c.name}</span>
        <span className="sky-count">{litCount} / {pts.length}</span>
        {hover && lit.get(hover) && <span className="sky-who">Lit by {lit.get(hover)!.volunteerName}. Reviewed by {lit.get(hover)!.reviewerName}.</span>}
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
      {campaigns.map((c) => <Sky key={c.id} c={c} contributions={contributions} w={260} h={64} compact />)}
    </div>
  );
}
