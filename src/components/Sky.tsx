/**
 * The sky. Real places rendered as stars, one per quest: an outlined ring on approval, filled with
 * a halo once landed. A slow spiral galaxy sits far behind them on the landing. WebGL when the
 * browser has it and the person has not asked for reduced motion; otherwise the static SVG
 * constellation in the same container. Both set data-approved / data-landed counts on the root.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { setState, useAppState } from '../state/store';
import { ConstellationStatic } from './Constellation';
import { IntentBar } from './IntentBar';
import { StateChip } from './StateChip';
import { buildSkyModel, placeStars, starTiers, type SkyMode, type StarTier } from './skyLayout';
import type { SkyHandle } from './skyScene';
import './sky.css';

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

const STEPS: [string, string][] = [
  ['Find', 'Your agent finds a gap that fits your time.'],
  ['Do', 'You call, visit, or read. Then check the form.'],
  ['Star', 'A neighbour approves it. Your star lights.'],
];

export function Sky({ size }: { size: SkyMode }) {
  const campaigns = useAppState((s) => s.campaigns);
  const quests = useAppState((s) => s.quests);
  const contributions = useAppState((s) => s.contributions);
  const place = useAppState((s) => s.profile.place);
  const spotlight = useAppState((s) => s.spotlightQuestId);
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

  // "See your star": re-run one star's ignition after the hero re-expands, then forget the request.
  useEffect(() => {
    const h = handleRef.current;
    if (!spotlight || !ready || !h || size !== 'hero' || !layout) return;
    const dimmed = new Map(tierById);
    dimmed.delete(spotlight);
    h.setLit(dimmed, false);
    const t = setTimeout(() => h.setLit(tierById, true), 350);
    setState({ spotlightQuestId: null });
    return () => clearTimeout(t);
  }, [spotlight, ready, size, layout, tierById]);

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
  const hero = size === 'hero';

  return (
    <div ref={rootRef} className={`sky-root sky-${size} sky-path-${path}`} data-approved={approvedCount} data-landed={landedCount} onPointerMove={path === 'webgl' ? onMove : undefined} onPointerLeave={path === 'webgl' ? onLeave : undefined}>
      {path === 'webgl' ? (
        <canvas ref={canvasRef} className="sky-canvas" aria-hidden="true" />
      ) : layout ? (
        <ConstellationStatic layout={layout} tiers={tiers} w={dims.w} h={dims.h} onHover={(index, x, y) => setHover(index === -1 ? null : { index, x, y })} />
      ) : null}

      {hero && (
        <div className="sky-copy pointer-events-none absolute inset-x-0 top-0 flex min-h-[100svh] flex-col justify-center gap-7 px-(--gutter) pt-24 pb-44 max-md:pb-52">
          <div className="grid gap-4">
            <h1 className="hero-in font-display text-balance text-[clamp(44px,5.4vw,84px)] leading-[1.0] font-light tracking-[-.025em] text-sky-ink [font-variation-settings:'opsz'_144] [text-shadow:0_2px_28px_rgba(7,9,18,.7)]" style={{ '--d': '0ms' } as React.CSSProperties}>
              Twenty minutes.<br />One more star.
            </h1>
            <p className="hero-in max-w-[52ch] text-[17px] leading-[1.55] text-sky-muted [text-shadow:0_1px_18px_rgba(7,9,18,.8)] max-md:text-[15px]" style={{ '--d': '90ms' } as React.CSSProperties}>
              Pick a small gap near you. Your browser agent lines up the steps. You do the work. A neighbour checks it. Your city's map gets one more star.
            </p>
          </div>
          <div className="hero-in" style={{ '--d': '180ms' } as React.CSSProperties}><IntentBar /></div>
        </div>
      )}

      <div className="sky-foot pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-10 gap-y-4 px-(--gutter) pb-6 max-md:pb-4">
        {hero ? (
          <ol className="hero-in flex flex-wrap gap-x-9 gap-y-3 text-[13px] leading-[18px] text-sky-muted" style={{ '--d': '300ms' } as React.CSSProperties} aria-label="How it works">
            {STEPS.map(([name, body], i) => (
              <li key={name} className="flex max-w-[24ch] gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-gold/80 pt-px">0{i + 1}</span>
                <span><strong className="font-medium text-sky-ink">{name}</strong><span className="max-md:hidden"> · {body}</span></span>
              </li>
            ))}
          </ol>
        ) : <span />}
        {model.panels.length > 0 && (
          <ul className="sky-legend m-0 flex flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[13px] leading-[18px]" aria-label="What a star means">
            <li className="flex gap-4 [&_.state-chip]:text-sky-muted [&_.state-chip-glyph]:text-gold [&_.state-chip-label]:text-[12px]">
              <StateChip state="available" /><StateChip state="approved" /><StateChip state="landed" />
            </li>
            <li aria-hidden="true" className="hidden h-3 w-px bg-sky-line sm:block" />
            {model.panels.map((p) => {
              const litHere = p.starIndices.filter((i) => tierById.has(model.stars[i].questId)).length;
              return (
                <li key={p.campaignId} className="flex items-baseline gap-2">
                  <span className="sky-legend-name font-medium text-sky-ink">{p.name}</span>
                  <span className="sky-legend-count font-mono text-[12px] tabular-nums text-sky-muted">{litHere} / {p.starIndices.length}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
