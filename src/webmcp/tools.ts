/**
 * Quest's adapter to @gatherlight/quest-tools. Every operation is a thin wrapper over
 * a shared function the UI also calls, via controller.run(). Agent does logistics. Human does the work.
 */
import { createDialogConfirm, createQuestTools, result, safeText } from '@gatherlight/quest-tools';
import { activeQuest, getState, nextId, openQuest, setState, toast, upsertContribution } from '../state/store';
import { broadcast } from '../channel/broadcast';
import { validate } from '../validators';
import type { Contribution, ContributionPayload, Quest } from '../types';

// ---------- find ----------

export interface FindArgs { minutesAvailable?: number; skills?: string[]; languages?: string[]; remoteOnly?: boolean; type?: string }

const SKILL_ALIASES: Record<string, string> = {
  phone: 'phone', call: 'phone', calling: 'phone', talk: 'phone',
  photo: 'photo', photography: 'photo', camera: 'photo', visit: 'visit', walk: 'visit', walking: 'visit', outside: 'visit',
};

export function findQuestsImpl(args: FindArgs): Quest[] {
  const s = getState();
  const minutes = args.minutesAvailable ?? s.profile.minutesAvailable;
  const skills = new Set((args.skills ?? s.profile.skills).map((x) => SKILL_ALIASES[x.toLowerCase()] ?? x.toLowerCase()));
  const done = new Set(s.contributions.filter((c) => c.status !== 'rejected').map((c) => c.questId));
  let pool = s.quests.filter((q) => !done.has(q.id) && q.estimatedMinutes <= minutes);
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
const WHEELCHAIR_LABEL: Record<string, string> = { yes: 'Yes', limited: 'Limited', no: 'No', '': 'Not stated' };

function summaryFields(payload: ContributionPayload): [string, string][] {
  if (payload.kind === 'verify-hours') {
    return [
      ['Opening hours', payload.openingHours || 'Not stated'],
      ['Checked by', CHECKED_BY_LABEL[payload.verifiedBy]],
    ];
  }
  const fields: [string, string][] = [['Wheelchair access', WHEELCHAIR_LABEL[payload.wheelchair]]];
  if (payload.note.trim()) fields.push(['Note', safeText(payload.note)]);
  return fields;
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

    open(input) {
      const id = String((input as { id?: string }).id ?? '');
      if (!openQuest(id)) return result('invalid', `No quest with id "${id}". Call find-quests to get current ids.`);
      const q = activeQuest()!;
      const how = q.type === 'verify-hours'
        ? 'The volunteer calls or visits the place and enters its opening hours in OSM syntax, e.g. "Mo-Sa 09:00-21:00".'
        : 'The volunteer photographs the entrance and marks wheelchair access yes, limited, or no.';
      return result('open', `Opened "${safeText(q.title)}". ${how} The volunteer does this part. When the form is filled, call check-contribution.`, { questId: id });
    },

    check() {
      const s = getState();
      const q = activeQuest();
      if (!q || !s.draft) return result('invalid', 'No quest is open. Open a quest first.');
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

    // The package owns check -> confirm -> check -> submit. This just writes the contribution.
    submit() {
      const q = activeQuest();
      const s = getState();
      if (!q || !s.draft) return result('invalid', 'Not submitted. No quest is open. Call open-quest first.');
      const existing = s.contributions.find((c) => c.questId === q.id && c.status === 'rejected');
      const contribution: Contribution = {
        id: existing?.id ?? nextId('c'),
        questId: q.id,
        questTitle: q.title,
        volunteerName: s.profile.name || 'A volunteer',
        payload: s.draft,
        status: 'submitted',
        checkErrors: [],
        submittedAt: new Date().toISOString(),
      };
      upsertContribution(contribution);
      setState({ workspace: 'submitted' });
      broadcast({ type: 'contribution:submitted', contributionId: contribution.id, questId: q.id });
      toast(`Sent to a reviewer: ${safeText(q.placeName)}.`);
      return result('submitted', `Submitted "${safeText(q.title)}" for review. A star lights when a reviewer approves it.`, { contributionId: contribution.id });
    },

    approve(input) {
      const { contributionId, comment } = input;
      const s = getState();
      const c = s.contributions.find((x) => x.id === contributionId);
      if (!c || c.status !== 'submitted') return result('invalid', 'No submitted contribution with that id. Refresh the review queue and try again.');
      const reviewerName = s.profile.name || 'Reviewer';
      upsertContribution({ ...c, status: 'approved', reviewedAt: new Date().toISOString(), reviewerName, reviewComment: comment?.slice(0, 200) });
      broadcast({ type: 'contribution:approved', contributionId, questId: c.questId, reviewerName });
      return result('approved', `Approved. A star lit for "${safeText(c.questTitle)}". The volunteer was told.`, { contributionId });
    },
  },

  available() {
    const s = getState();
    if (s.role === 'reviewer') return { approve: s.contributions.some((c) => c.status === 'submitted') };
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

export function rejectImpl(contributionId: string, comment: string) {
  const s = getState();
  const c = s.contributions.find((x) => x.id === contributionId);
  if (!c || c.status !== 'submitted') return;
  upsertContribution({ ...c, status: 'rejected', reviewedAt: new Date().toISOString(), reviewerName: s.profile.name || 'Reviewer', reviewComment: comment.slice(0, 200) });
  broadcast({ type: 'contribution:rejected', contributionId, questId: c.questId, comment });
}
