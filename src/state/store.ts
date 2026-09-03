import { useSyncExternalStore } from 'react';
import type { StoredContribution } from '../../worker/src/client.ts';
import { store } from './storeClient';
import { buildCampaigns, clearOverpassCache, loadQuests } from '../data/overpass';
import { buildWikidataCampaigns, clearWikidataCache, loadWikidataQuests } from '../data/wikidata';
import { DEFAULT_PLACE, type AppState, type Contribution, type ContributionPayload, type Place, type Quest, type QuestType, type WorkspaceState } from '../types';

const KEY = 'quest.state.v1';

const defaultState = (): AppState => ({
  profile: { name: '', minutesAvailable: 20, skills: [], languages: ['English'], accessibilityNeeds: [], place: DEFAULT_PLACE },
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
    return { ...base, profile: { ...base.profile, ...saved.profile } };
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

// ---------- quest loading: follows the profile's place ----------

/** Loads both adapters for the current place. Callers (App.tsx on boot, setPlace below) call
 *  `controller.refresh()` themselves after awaiting this — store.ts stays free of a webmcp import. */
export async function reloadQuests() {
  setState({ questSource: 'loading' });
  const place = state.profile.place;
  const [osm, wd] = await Promise.all([loadQuests(place), loadWikidataQuests(place)]);
  setState({ quests: [...osm.quests, ...wd.quests], questSource: osm.source, ...campaignsFor([...osm.quests, ...wd.quests], place, state.contributions) });
}

/** Panels are rebuilt whenever quests or contributions change: worked places keep their star, open ones fill the rest. */
function campaignsFor(quests: Quest[], place: Place, contributions: Contribution[]) {
  const worked = new Set(contributions.filter((c) => c.status !== 'rejected').map((c) => c.questId));
  return {
    campaigns: buildCampaigns(quests.filter((q) => q.type !== 'cite-claim'), place, worked),
    wdCampaigns: buildWikidataCampaigns(quests.filter((q) => q.type === 'cite-claim'), place, worked),
  };
}

/** Changing the place drops the volunteer back to browsing, frees the old place's caches, and
 *  reloads quests around the new one. */
export async function setPlace(place: Place) {
  const old = state.profile.place;
  setState({
    profile: { ...state.profile, place },
    activeQuestId: null, draft: null, workspace: 'browsing', checkErrors: [], checkTitle: null, handoff: null,
  });
  clearOverpassCache(old);
  clearWikidataCache(old);
  await reloadQuests();
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
  const contributions = [...state.contributions.filter((x) => x.id !== c.id), c];
  setState({ contributions, ...campaignsFor(state.quests, state.profile.place, contributions) });
}

let storeWarned = false;
export async function loadContributionsFromStore() {
  try {
    const list = await store.list();
    const contributions = list.map(toContribution);
    setState({ contributions, ...campaignsFor(state.quests, state.profile.place, contributions) });
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
