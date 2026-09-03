/**
 * The knowledge graph: Wikidata's second collective artifact (DESIGN.md §8), a sibling to the
 * sky. Plain SVG, no charting library. Nodes are entities that have at least one cite-claim
 * quest; edges are claims, one per quest, running from the entity to a small terminal mark
 * standing for its source. Layout is deterministic — entities in id order, alternated into two
 * rows so a card's worth of entities never bunches at one ring's ends — so the same data always
 * draws the same picture.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { safeText } from '@gatherlight/quest-tools';
import { useAppState } from '../state/store';
import type { Contribution, Quest } from '../types';

type ClaimState = 'none' | 'approved' | 'landed';

interface ClaimEdge { id: string; questId: string; state: ClaimState }
interface EntityNode { entityId: string; label: string; claims: ClaimEdge[] }

function buildGraph(quests: Quest[], contributions: Contribution[]): EntityNode[] {
  const byQuest = new Map(contributions.map((c) => [c.questId, c]));
  const nodes = new Map<string, EntityNode>();
  for (const q of quests) {
    if (q.type !== 'cite-claim' || !q.claim) continue;
    const c = byQuest.get(q.id);
    const state: ClaimState = c?.status === 'landed' ? 'landed' : c?.status === 'approved' ? 'approved' : 'none';
    const node = nodes.get(q.claim.entityId) ?? { entityId: q.claim.entityId, label: q.placeName, claims: [] };
    node.claims.push({ id: q.id, questId: q.id, state });
    nodes.set(q.claim.entityId, node);
  }
  return [...nodes.values()].sort((a, b) => a.entityId.localeCompare(b.entityId));
}

type Tier = 's' | 'm' | 'l';
const NODE_R: Record<Tier, number> = { s: 6, m: 9, l: 13 };
function tierFor(n: number): Tier { return n <= 1 ? 's' : n <= 3 ? 'm' : 'l'; }

// A wrapping grid: every entity visible at once, no horizontal scroll. Six columns at the workspace width;
// rows as needed. Edges rise from each node to its source marks; the label sits under the node.
const W = 760;
const COLS = 6;
const PAD_X = 40;
const PAD_TOP = 48;
const ROW_H = 92;
const EDGE_LEN = 30;
const LABEL_DOWN = 26;
const COL_W = (W - PAD_X * 2) / COLS;

interface Placed { node: EntityNode; x: number; y: number }

function layoutNodes(nodes: EntityNode[]): { placed: Placed[]; width: number; height: number } {
  const rows = Math.max(1, Math.ceil(nodes.length / COLS));
  const placed = nodes.map((node, i) => {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const inRow = r === rows - 1 ? nodes.length - r * COLS : COLS;
    const offset = ((COLS - inRow) * COL_W) / 2; // centre a short last row
    return { node, x: PAD_X + offset + COL_W * (c + 0.5), y: PAD_TOP + r * ROW_H };
  });
  return { placed, width: W, height: PAD_TOP + rows * ROW_H };
}

export function KnowledgeGraph() {
  const quests = useAppState((s) => s.quests);
  const contributions = useAppState((s) => s.contributions);
  const profile = useAppState((s) => s.profile);

  const nodes = useMemo(() => buildGraph(quests, contributions), [quests, contributions]);

  // The volunteer's own latest approved (or landed) claim: the one that pulses once.
  const mine = useMemo(
    () =>
      contributions
        .filter((c) => c.payload.kind === 'cite-claim' && (c.status === 'approved' || c.status === 'landed') && c.volunteerName === (profile.name || 'A volunteer'))
        .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))[0],
    [contributions, profile.name],
  );
  const pulseQuestId = mine?.questId;

  const mounted = useRef(false);
  const prevPulse = useRef<string | undefined>(undefined);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevPulse.current = pulseQuestId;
      return;
    }
    if (pulseQuestId && pulseQuestId !== prevPulse.current) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 500);
      prevPulse.current = pulseQuestId;
      return () => clearTimeout(t);
    }
    prevPulse.current = pulseQuestId;
  }, [pulseQuestId]);

  if (nodes.length === 0) return null;

  const { placed, width, height } = layoutNodes(nodes);
  const claimTotal = nodes.reduce((t, node) => t + node.claims.length, 0);
  const sourcedTotal = nodes.reduce((t, node) => t + node.claims.filter((c) => c.state !== 'none').length, 0);

  return (
    <div className="kg" data-sourced={sourcedTotal}>
      <div className="section-head">
        <h2>Sources, {profile.place.label}</h2>
        <p className="muted">Wikidata statements a volunteer found a reliable, independent source for.</p>
        <p className="kg-caption">{sourcedTotal} / {claimTotal} claims sourced.</p>
      </div>
      <ul className="kg-key" aria-hidden="true">
        <li><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" className="kg-key-swatch" data-state="none" /></svg>Not yet sourced</li>
        <li><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" className="kg-key-swatch" data-state="approved" /></svg>Approved</li>
        <li><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" className="kg-key-swatch" data-state="landed" /></svg>Landed</li>
      </ul>
        <svg
          className="kg-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Knowledge graph of Wikidata claims and their sources. ${sourcedTotal} of ${claimTotal} claims sourced.`}
        >
          {placed.map(({ node, x, y }) => {
            const tier = tierFor(node.claims.length);
            const r = NODE_R[tier];
            const k = node.claims.length;
            const labelY = y + LABEL_DOWN;
            return (
              <g key={node.entityId}>
                {node.claims.map((claim, i) => {
                  const tx = x + (i - (k - 1) / 2) * 14;
                  const ty = y - EDGE_LEN;
                  const isPulsing = pulsing && claim.questId === pulseQuestId;
                  return (
                    <g key={claim.id} className={`kg-claim${isPulsing ? ' kg-claim-pulse' : ''}`} data-state={claim.state}>
                      <line x1={x} y1={y} x2={tx} y2={ty} className="kg-edge" />
                      <rect x={tx - 4.5} y={ty - 4.5} width={9} height={9} className="kg-terminal" />
                    </g>
                  );
                })}
                <circle cx={x} cy={y} r={r} className="kg-node" data-tier={tier} />
                <text x={x} y={labelY} textAnchor="middle" className="kg-label">
                  {safeText(node.label, 16)}
                  <title>{node.label}</title>
                </text>
              </g>
            );
          })}
        </svg>
      <ul className="sr-only">
        {nodes.flatMap((node) =>
          node.claims.map((c) => (
            <li key={c.id}>
              {safeText(node.label, 40)}: {c.state === 'none' ? 'not yet sourced' : c.state === 'approved' ? 'sourced, approved' : 'sourced and landed'}.
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
