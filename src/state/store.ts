import { useSyncExternalStore } from 'react';
import type { StoredContribution } from '../../worker/src/client.ts';
import { store } from './storeClient';
import type { AppState, Contribution, ContributionPayload, Quest, QuestType, WorkspaceState } from '../types';

const KEY = 'quest.state.v1';

const defaultState = (): AppState => ({
  profile: { name: '', minutesAvailable: 20, skills: [], languages: ['English'], accessibilityNeeds: [] },
  quests: [],
  campaigns: [],
  wdCampaigns: [],
  contributions: [],
  activeQuestId: null,
  draft: null,
  workspace: 'browsing',
  role: new URLSearchParams(location.search).get('role') === 'reviewer' ? 'reviewer' : 'volunteer',
  questSource: 'loading',
  checkErrors: [],
  checkTitle: null,
  toast: null,
  handoff: null,
});

/** Only the profile persists in this browser. Contributions come from the store (SPEC.md). */
function load(): AppState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...base, profile: saved.profile ?? base.profile };
  } catch {
    return base;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ profile: state.profile }));
  } catch { /* quota: ignore, memory state still works */ }
}

export function getState() { return state; }

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  if ('profile' in p) persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useAppState<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

// ---------- the shared store (SPEC.md's Coordinator) ----------

function toContribution(sc: StoredContribution): Contribution {
  return {
    id: sc.id,
    questId: sc.quest.id,
    questTitle: sc.quest.title,
    volunteerName: sc.volunteerName,
    payload: sc.payload as ContributionPayload,
    status: sc.state,
    via: sc.via,
    submittedAt: sc.submittedAt,
    reviewedAt: sc.reviewedAt,
    reviewerName: sc.reviewerName,
    reviewComment: sc.reviewComment,
  };
}

export function mergeContribution(sc: StoredContribution) {
  const c = toContribution(sc);
  setState({ contributions: [...state.contributions.filter((x) => x.id !== c.id), c] });
}

let storeWarned = false;
export async function loadContributionsFromStore() {
  try {
    const list = await store.list();
    setState({ contributions: list.map(toContribution) });
  } catch {
    if (!storeWarned) {
      storeWarned = true;
      toast('Store unreachable. Quests still load; submitting needs the store.');
    }
  }
}

export function emptyDraft(type: QuestType): ContributionPayload {
  if (type === 'cite-claim') return { kind: 'cite-claim', sourceUrl: '', quote: '', confirmed: false };
  return { kind: 'verify-hours', openingHours: '', verifiedBy: '', note: '' };
}

/** The local part of opening a quest: workspace navigation. The `open` tool operation
 *  (webmcp/tools.ts) also talks to the store for access-photo quests; this only sets local UI state. */
export function openQuest(questId: string) {
  const q = state.quests.find((x) => x.id === questId);
  if (!q) return false;
  if (q.type === 'access-photo') {
    setState({ activeQuestId: questId, draft: null, workspace: 'in-workspace', checkErrors: [], checkTitle: null, handoff: null });
    return true;
  }
  const existing = state.contributions.find((c) => c.questId === questId && c.status !== 'rejected' && c.status !== 'stale');
  const ws: WorkspaceState = existing ? (existing.status === 'submitted' ? 'submitted' : existing.status === 'approved' || existing.status === 'landed' ? 'approved' : 'in-workspace') : 'in-workspace';
  setState({ activeQuestId: questId, draft: existing?.payload ?? emptyDraft(q.type), workspace: ws, checkErrors: [], checkTitle: null, handoff: null });
  return true;
}

export function closeQuest() { setState({ activeQuestId: null, draft: null, workspace: 'browsing', checkErrors: [], checkTitle: null, handoff: null }); }

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), 4000);
}

export function updateDraft(payload: ContributionPayload) {
  setState({ draft: payload, workspace: state.workspace === 'checked' ? 'in-workspace' : state.workspace });
}

export function activeQuest(): Quest | null {
  return state.quests.find((q) => q.id === state.activeQuestId) ?? null;
}

export function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
