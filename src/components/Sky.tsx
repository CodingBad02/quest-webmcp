/**
 * The sky. Real places rendered as stars, one per quest: an outlined ring on approval, filled with
 * a halo once landed (DESIGN.md §8). WebGL when the browser has it and the person has not asked for
 * reduced motion; otherwise the static SVG constellation in the same container. Both set
 * data-approved / data-landed counts on the root.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../state/store';
import { ConstellationStatic } from './Constellation';
import { StateChip } from './StateChip';
import { buildSkyModel, placeStars, starTiers, type SkyMode, type StarTier } from './skyLayout';
import type { SkyHandle } from './skyScene';

type Path = 'webgl' | 'svg';

let detected: Path | null = null;
let announced = false;
function detectPath(): Path {
  if (detected) return detected;
  let path: Path = 'svg';
  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!reduced && gl) path = 'webgl';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { path = 'svg'; }
  detected = path;
  return path;
}
function announce(path: Path) {
  if (announced) return;
  announced = true;
  console.info(`sky: ${path}`);
}

interface Hover { index: number; x: number; y: number }

export function Sky({ size }: { size: SkyMode }) {
  const campaigns = useAppState((s) => s.campaigns);
  const quests = useAppState((s) => s.quests);
  const contributions = useAppState((s) => s.contributions);
  const place = useAppState((s) => s.profile.place);
  const model = useMemo(() => buildSkyModel(campaigns, quests, place), [campaigns, quests, place]);
  const tiers = useMemo(() => starTiers(contributions), [contributions]);
  const tierById = useMemo(() => {
    const m = new Map<string, StarTier>();
    for (const s of model.stars) { const t = tiers.get(s.questId); if (t) m.set(s.questId, t.tier); }
    return m;
  }, [model, tiers]);
  const approvedCount = useMemo(() => [...tierById.values()].filter((t) => t === 1).length, [tierById]);
  const landedCount = useMemo(() => [...tierById.values()].filter((t) => t === 2).length, [tierById]);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SkyHandle | null>(null);
  const [path, setPath] = useState<Path>(detectPath);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Hover | null>(null);
  const firstPaint = useRef(true);

  const layout = useMemo(() => (dims.w && dims.h ? placeStars(model, dims.w, dims.h, size) : null), [model, dims, size]);

  // Size.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setDims((d) => (Math.round(r.width) === d.w && Math.round(r.height) === d.h ? d : { w: Math.round(r.width), h: Math.round(r.height) }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // WebGL scene lifecycle.
  useEffect(() => {
    if (path !== 'webgl') { announce('svg'); return; }
    let cancelled = false;
    let handle: SkyHandle | null = null;
    import('./skyScene').then(({ createSkyScene }) => {
      if (cancelled || !canvasRef.current) return;
      handle = createSkyScene(canvasRef.current);
      if (!handle) { setPath('svg'); return; }
      handleRef.current = handle;
      announce('webgl');
      setReady(true);
    }).catch(() => { if (!cancelled) setPath('svg'); });
    const onVis = () => { if (document.hidden) handleRef.current?.pause(); else handleRef.current?.resume(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      handle?.destroy();
      handleRef.current = null;
      setReady(false);
    };
  }, [path]);

  // Layout into the scene.
  useEffect(() => {
    const h = handleRef.current;
    if (!ready || !h || !layout) return;
    h.setLayout(layout.stars, layout.edges, dims.w, dims.h, size);
    h.setLit(tierById, false);
  }, [ready, layout, dims, size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ignition: tiers changing while mounted animate; the first read does not.
  useEffect(() => {
    const h = handleRef.current;
    if (!ready || !h) return;
    h.setLit(tierById, !firstPaint.current);
    firstPaint.current = false;
  }, [ready, tierById]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const h = handleRef.current;
    if (!h || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    h.pointer(x, y);
    const i = h.pick(x, y);
    setHover((prev) => (i === -1 ? (prev ? null : prev) : { index: i, x, y }));
  };
  const onLeave = () => { handleRef.current?.pointer(null, null); setHover(null); };

  const hoverStar = hover && layout ? layout.stars[hover.index] : null;
  const hoverTier = hoverStar ? tiers.get(hoverStar.questId) : undefined;
  const tipX = hover && dims.w ? Math.min(Math.max(hover.x, 110), dims.w - 110) : 0;

  return (
    <div ref={rootRef} className={`sky-root sky-${size} sky-path-${path}`} data-approved={approvedCount} data-landed={landedCount} onPointerMove={path === 'webgl' ? onMove : undefined} onPointerLeave={path === 'webgl' ? onLeave : undefined}>
      {path === 'webgl' ? (
        <canvas ref={canvasRef} className="sky-canvas" aria-hidden="true" />
      ) : layout ? (
        <ConstellationStatic layout={layout} tiers={tiers} w={dims.w} h={dims.h} onHover={(index, x, y) => setHover(index === -1 ? null : { index, x, y })} />
      ) : null}

      {size === 'hero' && (
        <div className="sky-copy">
          <h1 className="sky-headline">Twenty minutes. One&nbsp;real&nbsp;fix.</h1>
          <p className="sky-lede">Your browser agent finds the gap. You make the call or take the photo.</p>
        </div>
      )}

      {model.panels.length > 0 && (
        <div className="sky-foot">
          <ul className="sky-key" aria-label="What a star means">
            <li><StateChip state="available" /></li>
            <li><StateChip state="approved" /></li>
            <li><StateChip state="landed" /></li>
          </ul>
          <ol className="sky-legend" aria-label="Campaigns" style={{ gridTemplateColumns: `repeat(${model.panels.length}, minmax(0, 1fr))` }}>
            {model.panels.map((p) => {
              const litHere = p.starIndices.filter((i) => tierById.has(model.stars[i].questId)).length;
              return (
                <li key={p.campaignId}>
                  <span className="sky-legend-name">{p.name}</span>
                  <span className="sky-legend-count">{litHere} / {p.starIndices.length}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {hoverStar && (
        <div className="sky-tip" role="tooltip" style={{ left: tipX, top: hover!.y }}>
          <strong>{hoverStar.placeName}</strong>
          {hoverTier ? <span>{hoverTier.tier === 2 ? 'Landed' : 'Approved'}. Reviewed by {hoverTier.contribution.reviewerName}.</span> : <span>{hoverStar.gap}</span>}
        </div>
      )}

      {path === 'webgl' && (
        <ul className="sr-only" aria-label="Stars">
          {model.stars.map((s) => {
            const t = tiers.get(s.questId);
            return <li key={s.questId}>{s.placeName}, {s.gap}. {t ? `${t.tier === 2 ? 'Landed' : 'Approved'}. Reviewed by ${t.contribution.reviewerName}.` : 'Not lit.'}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
