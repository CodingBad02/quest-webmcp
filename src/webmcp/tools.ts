/**
 * Quest's adapter to @gatherlight/quest-tools. Every operation is a thin wrapper over
 * a shared function the UI also calls, via controller.run(). Agent does logistics. Human does the work.
 */
import { createDialogConfirm, createQuestTools, result, safeText } from '@gatherlight/quest-tools';
import type { QuestRef } from '../../worker/src/client.ts';
import { activeQuest, getState, mergeContribution, nextId, openQuest, setState, toast } from '../state/store';
import { store, SURVEY_URL } from '../state/storeClient';
import { broadcast } from '../channel/broadcast';
import { validate, validateCiteClaim } from '../validators';
import type { ClaimRef, ContributionPayload, Quest } from '../types';

// ---------- find ----------

export interface FindArgs { minutesAvailable?: number; skills?: string[]; languages?: string[]; remoteOnly?: boolean; type?: string }

const SKILL_ALIASES: Record<string, string> = {
  phone: 'phone', call: 'phone', calling: 'phone', talk: 'phone',
  photo: 'photo', photography: 'photo', camera: 'photo', visit: 'visit', walk: 'visit', walking: 'visit', outside: 'visit',
  research: 'research', read: 'research', cite: 'research', sources: 'research',
};

export function findQuestsImpl(args: FindArgs): Quest[] {
  const s = getState();
  const minutes = args.minutesAvailable ?? s.profile.minutesAvailable;
  const skills = new Set((args.skills ?? s.profile.skills).map((x) => SKILL_ALIASES[x.toLowerCase()] ?? x.toLowerCase()));
  const done = new Set(s.contributions.filter((c) => c.status !== 'rejected' && c.status !== 'stale').map((c) => c.questId));
  // Only quests placed in a bounded panel (buildCampaigns' or buildWikidataCampaigns' slice) have
  // a mark in a collective artifact (a star in the sky, an edge in the knowledge graph). A quest
  // the agent can find and open must also be one the volunteer can watch light up.
  const inSky = new Set([...s.campaigns, ...s.wdCampaigns].flatMap((c) => c.questIds));
  let pool = s.quests.filter((q) => inSky.has(q.id) && !done.has(q.id) && q.estimatedMinutes <= minutes);
  if (args.type) pool = pool.filter((q) => q.type === args.type);
  if (args.remoteOnly) pool = pool.filter((q) => q.remote);
  const score = (q: Quest) => {
    let n = 0;
    if (skills.size && q.requiredSkills.every((k) => skills.has(k))) n += 10;
    else if (skills.size && q.requiredSkills.some((k) => skills.has(k))) n += 4;
    if (q.remote) n += 1;
    n += Math.max(0, 5 - Math.abs(q.estimatedMinutes - minutes / 2) / 5);
    return n;
  };
  const seen = new Set<string>();
  return pool.sort((a, b) => score(b) - score(a)).filter((q) => { const k = `${q.type}:${q.placeName}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
}

const fmtQuest = (q: Quest, i: number) =>
  `${i + 1}. ${safeText(q.title)} (about ${q.estimatedMinutes} min, ${q.remote ? 'from home' : 'in person'}${q.address ? ', ' + safeText(q.address) : ''}) [${q.type}] id=${q.id}`;

// ---------- check: the confirmation summary the volunteer filled ----------

const CHECKED_BY_LABEL: Record<string, string> = { phone: 'Phone call', visit: 'In-person visit', website: 'Website', '': 'Not stated' };

/** Only verify-hours is checked here: access-photo is Survey's form now (DESIGN.md §7). */
function summaryFields(payload: Extract<ContributionPayload, { kind: 'verify-hours' }>): [string, string][] {
  return [
    ['Opening hours', payload.openingHours || 'Not stated'],
    ['Checked by', CHECKED_BY_LABEL[payload.verifiedBy]],
  ];
}

function summaryFieldsCiteClaim(q: Quest, payload: Extract<ContributionPayload, { kind: 'cite-claim' }>): [string, string][] {
  let sourceLabel = payload.sourceUrl;
  try { const u = new URL(payload.sourceUrl); sourceLabel = `${u.hostname}${u.pathname}`; } catch { /* keep raw string */ }
  return [
    ['Claim', `${q.placeName} · ${q.claim?.propertyLabel}: ${q.claim?.valueText}`],
    ['Source', safeText(sourceLabel, 60)],
    ['Where it says so', safeText(payload.quote, 120)],
  ];
}

function toQuestRef(q: Quest): QuestRef {
  return {
    id: q.id, type: q.type, title: q.title, placeName: q.placeName,
    osmRef: q.osmRef, osmVersion: q.osmVersion, lat: q.lat, lon: q.lon,
    license: q.type === 'cite-claim' ? 'CC0 (Wikidata)' : 'Open Database License (ODbL)',
    ...(q.claim ? { claim: { entityId: q.claim.entityId, property: q.claim.property, statementId: q.claim.statementId, valueRaw: q.claim.valueRaw } } : {}),
  };
}

// ---------- cite-claim: the two network checks shared by check-contribution and approve-contribution ----------

interface ClaimCheck { ok: boolean; reason?: string; unreachable?: boolean }

/** The statement URI (and `statementId`, its part after `/statement/`) spells the entity-guid
 *  join as a hyphen; the EntityData JSON's claim `id` spells the same join as `$`. Convert once,
 *  here, so `statementId` itself stays exactly what the URI says (SPEC.md's literal example). */
function apiClaimId(claim: ClaimRef): string {
  const prefix = `${claim.entityId}-`;
  return claim.statementId.startsWith(prefix) ? `${claim.entityId}$${claim.statementId.slice(prefix.length)}` : claim.statementId;
}

/** The wikibase JSON API and the SPARQL results service spell the same value differently: a
 *  time carries a leading `+` and zeroes the month/day below its precision (`+1994-00-00T…`),
 *  where SPARQL fills in a canonical `1994-01-01T…`; a quantity's amount also carries a leading
 *  `+`. Compare on the meaning (the year, or the day, depending on precision; the bare number),
 *  not the surface string, or a claim Wikidata never actually changed would read as stale. */
function currentValueMatches(dv: unknown, valueRaw: string): { matches: boolean; display: string } {
  if (dv && typeof dv === 'object' && 'time' in (dv as Record<string, unknown>)) {
    const t = dv as { time: string; precision?: number };
    const clean = (s: string) => s.replace(/^\+/, '');
    const current = clean(t.time);
    const raw = clean(valueRaw);
    // Year precision (9) or coarser: the wikibase JSON zeroes month/day, SPARQL fills 01-01. Compare years only.
    const matches = (t.precision ?? 11) <= 9 ? current.slice(0, 4) === raw.slice(0, 4) : current.slice(0, 10) === raw.slice(0, 10);
    return { matches, display: current };
  }
  if (dv && typeof dv === 'object' && 'amount' in (dv as Record<string, unknown>)) {
    const current = String((dv as { amount: string }).amount).replace(/^\+/, '');
    return { matches: current === valueRaw.replace(/^\+/, ''), display: current };
  }
  const display = JSON.stringify(dv);
  return { matches: display === valueRaw, display };
}

/** Fetches the entity's current claims and confirms the exact statement is still there, still
 *  says what it said, and still has no reference (SPEC.md's "preserved claim identity"). An
 *  unreachable Wikidata is not treated as a conflict: the check is skipped, not failed. */
async function checkClaimIdentity(claim: ClaimRef): Promise<ClaimCheck> {
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${claim.entityId}.json`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: true, unreachable: true };
    const data = (await res.json()) as {
      entities?: Record<string, { claims?: Record<string, { id: string; mainsnak?: { datavalue?: { value: unknown } }; references?: unknown[] }[]> }>;
    };
    const claims = data.entities?.[claim.entityId]?.claims?.[claim.property] ?? [];
    const targetId = apiClaimId(claim);
    const match = claims.find((c) => c.id === targetId);
    if (!match) return { ok: false, reason: 'The statement is gone from Wikidata. This quest is stale.' };
    const { matches, display } = currentValueMatches(match.mainsnak?.datavalue?.value, claim.valueRaw);
    if (!matches) return { ok: false, reason: `The statement changed on Wikidata (was ${claim.valueRaw}, now ${display}). This quest is stale.` };
    if ((match.references?.length ?? 0) > 0) return { ok: false, reason: 'Someone already added a source. This quest is done.' };
    return { ok: true };
  } catch {
    return { ok: true, unreachable: true };
  }
}

/** The shared check for a cite-claim draft: structural, then source reachability
 *  (`store.urlCheck`, the same helper the future Check button would call), then claim identity. */
async function checkCiteClaim(q: Quest, draft: Extract<ContributionPayload, { kind: 'cite-claim' }>) {
  const errors = validateCiteClaim(draft);
  if (errors.length) {
    setState({ checkErrors: errors, checkTitle: null, workspace: 'in-workspace' });
    return result('invalid', `Not ready. Fix these:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  }

  let sourceCheck;
  try {
    sourceCheck = await store.urlCheck(draft.sourceUrl.trim());
  } catch {
    const msg = 'Source: could not reach the source check. Try again.';
    setState({ checkErrors: [msg], checkTitle: null, workspace: 'in-workspace' });
    return result('invalid', `Not ready. Fix these:\n1. ${msg}`);
  }
  if (!sourceCheck.ok) {
    const msg = `Source: ${sourceCheck.reason ?? 'The source could not be verified.'}`;
    setState({ checkErrors: [msg], checkTitle: null, workspace: 'in-workspace' });
    return result('invalid', `Not ready. Fix these:\n1. ${msg}`);
  }
  const title = safeText(sourceCheck.title ?? '', 150);

  let wdNote = '';
  if (q.claim) {
    const claimCheck = await checkClaimIdentity(q.claim);
    if (!claimCheck.ok) {
      setState({ checkErrors: [claimCheck.reason!], checkTitle: title || null, workspace: 'in-workspace' });
      return result('stale', claimCheck.reason!);
    }
    if (claimCheck.unreachable) wdNote = ' Wikidata could not be reached; the claim was not re-checked.';
  }

  setState({ checkErrors: [], checkTitle: title || null, workspace: 'checked' });
  return {
    ...result('checked', `Ready. All checks passed.${wdNote} Ask the volunteer if they want to submit, then call submit-contribution.`),
    confirm: {
      summary: summaryFieldsCiteClaim(q, draft),
      destination: "Quest's review queue",
      visibility: 'Held for review. Not public yet.',
      license: 'CC0 (Wikidata)',
    },
  };
}

// ---------- the controller ----------

export const controller = createQuestTools({
  protocol: 'quest/1',
  operations: {
    find(input) {
      const list = findQuestsImpl(input as FindArgs);
      if (!list.length) return result('available', 'No quests fit. Try more minutes, or allow in-person quests.');
      return result('available', `Found ${list.length} quests:\n${list.map(fmtQuest).join('\n')}`);
    },

    async open(input) {
      const id = String((input as { id?: string }).id ?? '');
      const q = getState().quests.find((x) => x.id === id);
      if (!q) return result('invalid', `No quest with id "${id}". Call find-quests to get current ids.`);

      if (q.type === 'access-photo') {
        openQuest(id);
        const existing = getState().contributions.find((c) => c.questId === id && c.status !== 'rejected' && c.status !== 'stale');
        if (existing && existing.status !== 'open') {
          return result('open', `"${safeText(q.title)}" is already ${existing.status}. ${existing.status === 'submitted' ? 'Waiting for a reviewer.' : 'A star lit for it already.'}`, { questId: id, contributionId: existing.id });
        }
        const contributionId = existing?.id ?? nextId('c');
        try {
          if (!existing) {
            const volunteerName = getState().profile.name || 'A volunteer';
            const sc = await store.upsert(contributionId, { quest: toQuestRef(q), volunteerName, state: 'open' });
            mergeContribution(sc);
          }
          const { handoff, expiresAt } = await store.issueHandoff(contributionId, new URL(SURVEY_URL).origin, 300);
          setState({ handoff: { url: `${SURVEY_URL}?handoff=${handoff}`, expiresAt, questId: id } });
          const url = `${SURVEY_URL}?handoff=${handoff}`;
          return result('open', `Opened "${safeText(q.title)}". This quest continues on Survey. Navigate to ${url}; the volunteer fills the form there and you call check-contribution on that page.`, { questId: id, contributionId, next: { url, handoff } });
        } catch (e) {
          return result('invalid', `Not opened. ${(e as Error).message}`);
        }
      }

      if (!openQuest(id)) return result('invalid', `No quest with id "${id}". Call find-quests to get current ids.`);
      const opened = activeQuest()!;
      const guide = opened.type === 'cite-claim'
        ? `Opened "${safeText(opened.title)}". Find a reliable, independent source for this statement and read it. When the form is filled, call check-contribution.`
        : `Opened "${safeText(opened.title)}". The volunteer calls or visits the place and enters its opening hours in OSM syntax, e.g. "Mo-Sa 09:00-21:00". The volunteer does this part. When the form is filled, call check-contribution.`;
      return result('open', guide, { questId: id });
    },

    async check() {
      const s = getState();
      const q = activeQuest();
      if (!q || q.type === 'access-photo') return result('invalid', 'This quest continues on Survey.');
      if (!s.draft) return result('invalid', 'No quest is open. Open a quest first.');

      if (q.type === 'cite-claim') {
        if (s.draft.kind !== 'cite-claim') return result('invalid', 'No quest is open. Open a quest first.');
        return checkCiteClaim(q, s.draft);
      }

      if (s.draft.kind !== 'verify-hours') return result('invalid', 'No quest is open. Open a quest first.');
      const errors = validate(s.draft);
      setState({ checkErrors: errors, workspace: errors.length ? 'in-workspace' : 'checked' });
      if (errors.length) return result('invalid', `Not ready. Fix these:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
      return {
        ...result('checked', 'Ready. All checks passed. Ask the volunteer if they want to submit, then call submit-contribution.'),
        confirm: {
          summary: summaryFields(s.draft),
          destination: "Quest's review queue",
          visibility: 'Held for review. Not public yet.',
          license: 'Open Database License (ODbL)',
        },
      };
    },

    // The package owns check -> confirm -> check -> submit. This just writes the contribution to the store.
    async submit() {
      const q = activeQuest();
      const s = getState();
      if (!q || q.type === 'access-photo') return result('invalid', 'This quest continues on Survey.');
      if (!s.draft) return result('invalid', 'Not submitted. No quest is open. Call open-quest first.');
      const existing = s.contributions.find((c) => c.questId === q.id && c.status === 'rejected');
      const id = existing?.id ?? nextId('c');
      const volunteerName = s.profile.name || 'A volunteer';
      try {
        const sc = await store.upsert(id, { quest: toQuestRef(q), volunteerName, payload: { ...s.draft }, state: 'submitted', via: location.origin });
        mergeContribution(sc);
        setState({ workspace: 'submitted' });
        broadcast({ type: 'contribution:submitted', contributionId: sc.id, questId: q.id });
        toast(`Sent to a reviewer: ${safeText(q.placeName)}.`);
        const lights = q.type === 'cite-claim' ? 'Its line lights in the knowledge graph when a reviewer approves it.' : 'A star lights when a reviewer approves it.';
        return result('submitted', `Submitted "${safeText(q.title)}" for review. ${lights}`, { contributionId: sc.id });
      } catch (e) {
        return result('invalid', `Not submitted. ${(e as Error).message}`);
      }
    },

    async approve(input) {
      const { contributionId, comment } = input;
      const s = getState();
      const c = s.contributions.find((x) => x.id === contributionId);
      if (!c || c.status !== 'submitted') return result('invalid', 'No submitted contribution with that id. Refresh the review queue and try again.');
      const reviewerName = s.profile.name || 'Reviewer';
      const q = s.quests.find((x) => x.id === c.questId);

      let decision: 'approved' | 'stale' = 'approved';
      let staleDetail = '';
      if (q?.osmRef && q.osmVersion != null) {
        try {
          const res = await fetch(`https://api.openstreetmap.org/api/0.6/${q.osmRef}.json`);
          if (res.ok) {
            const data = (await res.json()) as { elements?: { version?: number }[] };
            const now = data.elements?.[0]?.version;
            if (now != null && now !== q.osmVersion) {
              decision = 'stale';
              staleDetail = `${safeText(c.questTitle)} changed on OpenStreetMap since this was opened (version ${q.osmVersion} → ${now}).`;
            }
          } else {
            return result('invalid', 'Not approved. OpenStreetMap did not answer, so the element version could not be checked. Try again in a moment.');
          }
        } catch {
          return result('invalid', 'Not approved. OpenStreetMap could not be reached, so the element version could not be checked. Try again in a moment.');
        }
      } else if (q?.type === 'cite-claim' && q.claim) {
        // Approval is the gate before anything public. Fail closed: no verified source identity, no approval.
        const claimCheck = await checkClaimIdentity(q.claim);
        if (claimCheck.unreachable) return result('invalid', 'Not approved. Wikidata could not be reached, so the claim could not be re-checked. Try again in a moment.');
        if (!claimCheck.ok) { decision = 'stale'; staleDetail = claimCheck.reason!; }
      }

      try {
        const sc = await store.review(contributionId, decision, reviewerName, comment?.slice(0, 200));
        mergeContribution(sc);
        broadcast(decision === 'stale'
          ? { type: 'contribution:stale', contributionId, questId: c.questId, comment: staleDetail || `${safeText(c.questTitle)} changed.` }
          : { type: 'contribution:approved', contributionId, questId: c.questId, reviewerName });
        if (decision === 'stale') {
          return result('stale', `${staleDetail} Marked stale. The volunteer can redo it.`, { contributionId });
        }
        const lit = q?.type === 'cite-claim' ? `A line lit in the knowledge graph for "${safeText(c.questTitle)}".` : `A star lit for "${safeText(c.questTitle)}".`;
        return result('approved', `Approved. ${lit} The volunteer was told.`, { contributionId });
      } catch (e) {
        return result('invalid', `Not approved. ${(e as Error).message}`);
      }
    },
  },

  available() {
    const s = getState();
    if (s.role === 'reviewer') return { approve: s.contributions.some((c) => c.status === 'submitted') };
    const q = activeQuest();
    if (q?.type === 'access-photo') {
      return { find: true, open: true, check: { locked: 'This quest continues on Survey.' }, submit: { locked: 'This quest continues on Survey.' } };
    }
    const open = s.workspace === 'in-workspace' || s.workspace === 'checked';
    return {
      find: true,
      open: true,
      check: open ? true : { locked: 'Unlocks when a quest is open.' },
      submit: s.workspace === 'checked' ? true : { locked: 'Unlocks after check-contribution passes.' },
    };
  },

  confirm: createDialogConfirm(),
});

// ---------- reject: a UI-only store action, not a tool (SPEC.md) ----------

export async function rejectImpl(contributionId: string, comment: string) {
  const s = getState();
  const c = s.contributions.find((x) => x.id === contributionId);
  if (!c || c.status !== 'submitted') return;
  const reviewerName = s.profile.name || 'Reviewer';
  try {
    const sc = await store.review(contributionId, 'rejected', reviewerName, comment.slice(0, 200));
    mergeContribution(sc);
    broadcast({ type: 'contribution:rejected', contributionId, questId: c.questId, comment });
  } catch (e) {
    toast(`Not sent back. ${(e as Error).message}`);
  }
}
