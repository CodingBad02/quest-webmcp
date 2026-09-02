/**
 * The knowledge graph: Wikidata's second collective artifact (DESIGN.md §8), a sibling to the
 * sky. Plain SVG, no charting library. Nodes are entities that have at least one cite-claim
 * quest; edges are claims, one per quest, running from the entity to a small terminal mark
 * standing for its source. Layout is deterministic — one ring, entities ordered by id — so the
 * same data always draws the same picture.
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

const W = 900, H = 320, CX = W / 2, CY = H / 2;
// The ring stays well inside the viewBox so a radial label (below) never clips at the edges.
const RX = 280, RY = 88;
const NODE_R: Record<'s' | 'm' | 'l', number> = { s: 7, m: 10, l: 13 };

function tierFor(n: number): 's' | 'm' | 'l' { return n <= 1 ? 's' : n <= 3 ? 'm' : 'l'; }

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

  const n = nodes.length;
  const positioned = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { node, x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle), angle };
  });

  const claimTotal = nodes.reduce((t, node) => t + node.claims.length, 0);
  const sourcedTotal = nodes.reduce((t, node) => t + node.claims.filter((c) => c.state !== 'none').length, 0);

  return (
    <div className="kg" data-sourced={sourcedTotal}>
      <div className="section-head">
        <h2>Sources, Bengaluru</h2>
        <p className="muted">Wikidata statements a volunteer found a reliable, independent source for.</p>
      </div>
      <svg
        className="kg-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Knowledge graph of Wikidata claims and their sources. ${sourcedTotal} of ${claimTotal} claims sourced.`}
      >
        {positioned.map(({ node, x, y, angle }) => {
          const r = NODE_R[tierFor(node.claims.length)];
          const spread = node.claims.length > 1 ? 0.28 : 0;
          // Labels radiate outward along the node's own ring angle, past the terminal marks,
          // rather than always sitting below — a fixed "below" offset stacks and overlaps where
          // the ring narrows (its left and right ends); radial placement keeps them apart.
          const cosA = Math.cos(angle);
          const labelDist = r + 38;
          const lx = x + cosA * labelDist;
          const ly = y + Math.sin(angle) * labelDist + 4;
          const anchor = cosA > 0.35 ? 'start' : cosA < -0.35 ? 'end' : 'middle';
          return (
            <g key={node.entityId}>
              {node.claims.map((claim, i) => {
                const a = angle + (i - (node.claims.length - 1) / 2) * spread;
                const tx = x + Math.cos(a) * 32;
                const ty = y + Math.sin(a) * 32;
                const isPulsing = pulsing && claim.questId === pulseQuestId;
                return (
                  <g key={claim.id} className={`kg-claim${isPulsing ? ' kg-claim-pulse' : ''}`} data-state={claim.state}>
                    <line x1={x} y1={y} x2={tx} y2={ty} className="kg-edge" />
                    <rect x={tx - 4} y={ty - 4} width={8} height={8} className="kg-terminal" />
                  </g>
                );
              })}
              <circle cx={x} cy={y} r={r} className="kg-node" />
              <text x={lx} y={ly} textAnchor={anchor} className="kg-label">{safeText(node.label, 16)}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small kg-caption">{sourcedTotal} / {claimTotal} claims sourced.</p>
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
