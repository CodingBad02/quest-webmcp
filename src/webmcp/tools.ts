/**
 * The four WebMCP tools. Each is a thin wrapper over an impl function the UI also calls.
 * Agent does logistics. Human does the work.
 */
import { activeQuest, getState, nextId, openQuest, setState, toast, upsertContribution } from '../state/store';
import { broadcast } from '../channel/broadcast';
import { validate } from '../validators';
import type { AppState, Contribution, Quest } from '../types';
import { syncTools, text, type ToolDef } from './registry';

// ---------- impl: find ----------

export interface FindArgs { minutesAvailable?: number; skills?: string[]; languages?: string[]; remoteOnly?: boolean; type?: string }

const SKILL_ALIASES: Record<string, string> = {
  phone: 'phone', call: 'phone', calling: 'phone', talk: 'phone',
  photo: 'photo', photography: 'photo', camera: 'photo', visit: 'visit', walk: 'visit', walking: 'visit', outside: 'visit',
  writing: 'writing', write: 'writing', editing: 'writing', english: 'writing', translation: 'writing',
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
  return pool.sort((a, b) => score(b) - score(a)).slice(0, 5);
}

// ---------- impl: check ----------

export function checkImpl(): { ok: boolean; errors: string[] } {
  const s = getState();
  const q = activeQuest();
  if (!q || !s.draft) return { ok: false, errors: ['No quest is open. Open a quest first.'] };
  const errors = validate(q, s.draft);
  setState({ checkErrors: errors, workspace: errors.length ? 'in-workspace' : 'checked' });
  return { ok: errors.length === 0, errors };
}

// ---------- impl: submit (awaits the human click) ----------

let pendingConfirm: ((ok: boolean) => void) | null = null;

export function resolveConfirm(ok: boolean) {
  setState({ confirmOpen: false });
  pendingConfirm?.(ok);
  pendingConfirm = null;
}

function requestConfirm(timeoutMs = 90_000): Promise<boolean> {
  if (pendingConfirm) pendingConfirm(false);
  setState({ confirmOpen: true });
  return new Promise((resolve) => {
    const t = setTimeout(() => { if (pendingConfirm === resolve) resolveConfirm(false); }, timeoutMs);
    pendingConfirm = (ok) => { clearTimeout(t); resolve(ok); };
  });
}

export type SubmitResult = { ok: true; contribution: Contribution } | { ok: false; reason: 'invalid' | 'declined' | 'timeout' | 'no-quest'; errors?: string[] };

export async function submitImpl(opts: { viaUi?: boolean } = {}): Promise<SubmitResult> {
  const q = activeQuest();
  const s = getState();
  if (!q || !s.draft) return { ok: false, reason: 'no-quest' };
  const errors = validate(q, s.draft);
  if (errors.length) { setState({ checkErrors: errors, workspace: 'in-workspace' }); return { ok: false, reason: 'invalid', errors }; }
  if (!opts.viaUi) {
    const confirmed = await requestConfirm();
    if (!confirmed) return { ok: false, reason: 'declined' };
  }
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
  toast(`Sent to a reviewer: ${q.placeName}.`);
  return { ok: true, contribution };
}

// ---------- impl: review ----------

export function approveImpl(contributionId: string, comment?: string): { ok: boolean; message: string } {
  const s = getState();
  const c = s.contributions.find((x) => x.id === contributionId);
  if (!c || c.status !== 'submitted') return { ok: false, message: 'No submitted contribution with that id. Refresh the review queue and try again.' };
  const reviewerName = s.profile.name || 'Reviewer';
  upsertContribution({ ...c, status: 'approved', reviewedAt: new Date().toISOString(), reviewerName, reviewComment: comment?.slice(0, 200) });
  broadcast({ type: 'contribution:approved', contributionId, questId: c.questId, reviewerName });
  return { ok: true, message: `Approved. A star lit for "${c.questTitle}". The volunteer was told.` };
}

export function rejectImpl(contributionId: string, comment: string) {
  const s = getState();
  const c = s.contributions.find((x) => x.id === contributionId);
  if (!c || c.status !== 'submitted') return;
  upsertContribution({ ...c, status: 'rejected', reviewedAt: new Date().toISOString(), reviewerName: s.profile.name || 'Reviewer', reviewComment: comment.slice(0, 200) });
  broadcast({ type: 'contribution:rejected', contributionId, questId: c.questId, comment });
}

// ---------- tool definitions ----------

const fmtQuest = (q: Quest, i: number) =>
  `${i + 1}. ${q.title} (about ${q.estimatedMinutes} min, ${q.remote ? 'from home' : 'in person'}${q.address ? ', ' + q.address : ''}) [${q.type}] id=${q.id}`;

export const findQuestsTool: ToolDef = {
  name: 'find-quests',
  description: 'Find real community micro-tasks near central Bengaluru that fit the time a volunteer has, their skills, and whether they can go out. Each quest fixes one missing fact in OpenStreetMap or rewrites one public help paragraph in plain words. Returns up to five quests with ids. Open one with open-quest.',
  inputSchema: {
    type: 'object',
    properties: {
      minutesAvailable: { type: 'number', description: 'Minutes the volunteer has free right now' },
      skills: { type: 'array', items: { type: 'string' }, description: 'What they can do: phone, photo, visit, writing' },
      remoteOnly: { type: 'boolean', description: 'True if the volunteer cannot go outside' },
      type: { type: 'string', enum: ['verify-hours', 'access-photo', 'plain-rewrite'], description: 'Limit to one quest type' },
    },
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    const list = findQuestsImpl(input as FindArgs);
    if (!list.length) return text('No quests fit. Try more minutes, or allow in-person quests.');
    return text(`Found ${list.length} quests:\n${list.map(fmtQuest).join('\n')}`);
  },
};

export const openQuestTool: ToolDef = {
  name: 'open-quest',
  description: 'Open one quest in the workspace so the volunteer can do the work. Pass the id from find-quests. After this, check-contribution becomes available.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Quest id from find-quests' } }, required: ['id'] },
  async execute(input) {
    const id = String((input as { id?: string }).id ?? '');
    if (!openQuest(id)) return text(`No quest with id "${id}". Call find-quests to get current ids.`);
    const q = activeQuest()!;
    const how = q.type === 'verify-hours' ? 'The volunteer calls or visits the place and enters its opening hours in OSM syntax, e.g. "Mo-Sa 09:00-21:00".'
      : q.type === 'access-photo' ? 'The volunteer photographs the entrance and marks wheelchair access yes, limited, or no.'
      : 'The volunteer rewrites the source paragraph in plain words. Keep every number and name.';
    return text(`Opened "${q.title}". ${how} The volunteer does this part. When the form is filled, call check-contribution.`);
  },
};

export const checkTool: ToolDef = {
  name: 'check-contribution',
  description: 'Check the open quest form for missing fields, wrong formats, and unclear language. Returns exactly what to fix, or confirms it is ready. When it passes, submit-contribution becomes available.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
  async execute() {
    const r = checkImpl();
    if (r.ok) return text('Ready. All checks passed. Ask the volunteer if they want to submit, then call submit-contribution.');
    return text(`Not ready. Fix these:\n${r.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  },
};

export const submitTool: ToolDef = {
  name: 'submit-contribution',
  description: 'Send the checked contribution to a human reviewer. This opens a confirm dialog in the app and waits up to 90 seconds for the volunteer to click Send. Nothing is sent without that click.',
  inputSchema: { type: 'object', properties: {} },
  async execute() {
    const r = await submitImpl();
    if (r.ok) return text(`Submitted "${r.contribution.questTitle}" for review. A star lights when a reviewer approves it.`);
    if (r.reason === 'invalid') return text(`Not submitted. The form changed. Fix: ${r.errors?.[0]}`);
    if (r.reason === 'declined') return text('Not submitted. The volunteer chose Keep editing, or did not click in time. Ask them, then call again.');
    return text('Not submitted. No quest is open. Call open-quest first.');
  },
};

export const approveTool: ToolDef = {
  name: 'approve-contribution',
  description: 'As the reviewer, approve one submitted contribution after reading it. Lights a star in the shared constellation and notifies the volunteer. Pass the id shown in the review queue.',
  inputSchema: {
    type: 'object',
    properties: { contributionId: { type: 'string', description: 'Id from the review queue' }, comment: { type: 'string', description: 'Optional short note to the volunteer' } },
    required: ['contributionId'],
  },
  async execute(input) {
    const { contributionId, comment } = input as { contributionId?: string; comment?: string };
    return text(approveImpl(String(contributionId ?? ''), comment).message);
  },
};

const ALL: ToolDef[] = [findQuestsTool, openQuestTool, checkTool, submitTool, approveTool];

/** Which tools exist right now. Called on every state change. */
export function syncToolsForState(s: AppState) {
  const names: string[] = [];
  if (s.role === 'reviewer') {
    if (s.contributions.some((c) => c.status === 'submitted')) names.push('approve-contribution');
  } else {
    names.push('find-quests', 'open-quest');
    if (s.workspace === 'in-workspace' || s.workspace === 'checked') names.push('check-contribution');
    if (s.workspace === 'checked') names.push('submit-contribution');
  }
  syncTools(ALL, names);
}
