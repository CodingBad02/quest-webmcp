/**
 * Sky layout. Shared by the WebGL sky and the static SVG fallback so both draw the same truth.
 *
 * Stars are real places. Each quest with coordinates is projected equirectangularly around
 * central Bengaluru into a shared frame, so the two Bengaluru campaigns are recognisably the same
 * streets. Each campaign gets its own panel across the width of the sky; without panels the
 * `hours` and `access` stars for one OSM element would sit on the same pixel.
 */
import type { Campaign, Contribution, Quest, QuestType } from '../types';

export type SkyMode = 'hero' | 'band';

export const CENTER = { lat: 12.9716, lon: 77.5946 };
export const PANEL_GAP = 40;
const PANEL_PAD = 20;
/** Half-width of the depth band around the constellation plane, world px. The band is short, so it gets less. */
export const Z_SPREAD: Record<SkyMode, number> = { hero: 140, band: 60 };

export interface StarNode {
  questId: string;
  campaignId: string;
  placeName: string;
  gap: string;
  /** east, 0..1 within the panel */
  u: number;
  /** north, 0..1 within the panel */
  v: number;
  /** depth jitter, -1..1 (negative is farther). placeStars scales it to world px per mode; the SVG fallback ignores it. */
  z: number;
  /** true when the quest has real coordinates */
  placed: boolean;
  /** stable 0..1 per star, drives twinkle phase and size */
  seed: number;
}

export interface SkyPanel { campaignId: string; name: string; starIndices: number[] }

export interface SkyModel {
  stars: StarNode[];
  /** minimum spanning tree per campaign, pairs of star indices */
  edges: [number, number][];
  panels: SkyPanel[];
}

/** `z` here is world px around the constellation plane, already scaled by mode. */
export interface PlacedStar extends StarNode { x: number; y: number }

export interface PlacedLayout {
  stars: PlacedStar[];
  edges: [number, number][];
  /** panel x extents in px, index-aligned with model.panels */
  panels: { x0: number; x1: number }[];
}

export const GAP_TEXT: Record<QuestType, string> = {
  'access-photo': 'no wheelchair tag',
  'verify-hours': 'no opening hours',
  // cite-claim never reaches the geo sky (it has no coordinates); kept for Record exhaustiveness.
  'cite-claim': 'no source cited',
};

export function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Prim's minimum spanning tree over points, weighted for a wide panel so the tree is stable across resizes. */
function mst(pts: { u: number; v: number }[]): [number, number][] {
  const edges: [number, number][] = [];
  if (pts.length < 2) return edges;
  const inTree = new Set([0]);
  while (inTree.size < pts.length) {
    let best: [number, number, number] = [-1, -1, Infinity];
    for (const i of inTree) for (let j = 0; j < pts.length; j++) {
      if (inTree.has(j)) continue;
      const d = ((pts[i].u - pts[j].u) * 1.6) ** 2 + (pts[i].v - pts[j].v) ** 2;
      if (d < best[2]) best = [i, j, d];
    }
    edges.push([best[0], best[1]]); inTree.add(best[1]);
  }
  return edges;
}

export function buildSkyModel(campaigns: Campaign[], quests: Quest[]): SkyModel {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const stars: StarNode[] = [];
  const edges: [number, number][] = [];
  const panels: SkyPanel[] = [];

  // Shared geographic frame across every placed quest, equirectangular around the demo centre.
  const cosLat = Math.cos((CENTER.lat * Math.PI) / 180);
  const placed = campaigns.flatMap((c) => c.questIds.map((id) => byId.get(id))).filter((q): q is Quest => !!q && q.lat != null && q.lon != null);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const q of placed) {
    const x = (q.lon! - CENTER.lon) * cosLat, y = q.lat! - CENTER.lat;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);

  for (const c of campaigns) {
    const start = stars.length;
    const local: { u: number; v: number }[] = [];
    for (const id of c.questIds) {
      const q = byId.get(id);
      if (!q) continue;
      const r = rng(id);
      const seed = r();
      const hasPlace = q.lat != null && q.lon != null;
      // Every P0 adapter (OSM) returns real coordinates; a quest without one would have nowhere
      // honest to sit, so it renders at the panel's centre rather than a fabricated position.
      const u = hasPlace ? ((q.lon! - CENTER.lon) * cosLat - minX) / spanX : 0.5;
      const v = hasPlace ? (q.lat! - CENTER.lat - minY) / spanY : 0.5;
      const z = r() * 2 - 1;
      stars.push({ questId: id, campaignId: c.id, placeName: q.placeName, gap: GAP_TEXT[q.type], u, v, z, placed: hasPlace, seed });
      local.push({ u, v });
    }
    for (const [a, b] of mst(local)) edges.push([start + a, start + b]);
    panels.push({ campaignId: c.id, name: c.name, starIndices: local.map((_, i) => start + i) });
  }
  return { stars, edges, panels };
}

/** Horizontal page gutter, mirrors the CSS `max(24px, calc((100vw - 1200px) / 2))`. */
export function gutterFor(w: number) { return w <= 900 ? 16 : Math.max(24, (w - 1200) / 2); }

/** Vertical band the stars may occupy: the hero leaves the upper sky for the headline, both leave
 *  room for the legend — the hero reserves more since v2 stacks the state key above it (§4, §8). */
export function starBand(mode: SkyMode, h: number): { top: number; bottom: number } {
  if (mode === 'hero') return { top: Math.max(h * 0.46, 200), bottom: h - 96 };
  return { top: 16, bottom: h - 40 };
}

export function placeStars(model: SkyModel, w: number, h: number, mode: SkyMode): PlacedLayout {
  const n = Math.max(model.panels.length, 1);
  const gutter = gutterFor(w);
  const colW = (w - gutter * 2 - PANEL_GAP * (n - 1)) / n;
  const { top, bottom } = starBand(mode, h);
  const usableH = Math.max(bottom - top, 24);
  const pad = Math.min(PANEL_PAD, colW * 0.08);
  const panels = model.panels.map((_, i) => { const x0 = gutter + i * (colW + PANEL_GAP); return { x0, x1: x0 + colW }; });
  const panelIndex = new Map(model.panels.map((p, i) => [p.campaignId, i]));
  const zSpread = Z_SPREAD[mode];
  const stars = model.stars.map((s) => {
    const p = panels[panelIndex.get(s.campaignId) ?? 0];
    return { ...s, x: p.x0 + pad + s.u * (colW - pad * 2), y: top + (1 - s.v) * usableH, z: s.z * zSpread };
  });
  return { stars, edges: model.edges, panels };
}

/** DESIGN.md §8: three truths, not two. `approved` (reviewed, not yet landed) renders as an
 *  outlined ring; `landed` (the source accepted the write) renders filled with a halo. Nothing
 *  lands in P0 (write-back is P1), so every approval today renders at tier 1. */
export type StarTier = 1 | 2;

export function starTiers(contributions: Contribution[]): Map<string, { tier: StarTier; contribution: Contribution }> {
  const m = new Map<string, { tier: StarTier; contribution: Contribution }>();
  for (const c of contributions) {
    if (c.status === 'approved') m.set(c.questId, { tier: 1, contribution: c });
    else if (c.status === 'landed') m.set(c.questId, { tier: 2, contribution: c });
  }
  return m;
}
