import { useSyncExternalStore } from 'react';
import type { AppState, Contribution, ContributionPayload, Quest, QuestType, WorkspaceState } from '../types';

const KEY = 'quest.state.v1';
const SHARED_KEYS: (keyof AppState)[] = ['contributions'];

const defaultState = (): AppState => ({
  profile: { name: '', minutesAvailable: 20, skills: [], languages: ['English'], accessibilityNeeds: [] },
  quests: [],
  campaigns: [],
  contributions: [],
  activeQuestId: null,
  draft: null,
  workspace: 'browsing',
  role: new URLSearchParams(location.search).get('role') === 'reviewer' ? 'reviewer' : 'volunteer',
  questSource: 'loading',
  checkErrors: [],
  toast: null,
});

function load(): AppState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...base, profile: saved.profile ?? base.profile, contributions: saved.contributions ?? [] };
  } catch {
    return base;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ profile: state.profile, contributions: state.contributions }));
  } catch { /* quota: ignore, memory state still works */ }
}

export function getState() { return state; }

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  if (Object.keys(p).some((k) => SHARED_KEYS.includes(k as keyof AppState) || k === 'profile')) persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useAppState<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

/** Re-read shared data written by another tab. */
export function reloadShared() {
  const fresh = load();
  setState({ contributions: fresh.contributions });
}

export function emptyDraft(type: QuestType): ContributionPayload {
  if (type === 'verify-hours') return { kind: 'verify-hours', openingHours: '', verifiedBy: '', note: '' };
  return { kind: 'access-photo', imageDataUrl: '', wheelchair: '', note: '' };
}

export function openQuest(questId: string) {
  const q = state.quests.find((x) => x.id === questId);
  if (!q) return false;
  const existing = state.contributions.find((c) => c.questId === questId && c.status !== 'rejected');
  const ws: WorkspaceState = existing ? (existing.status === 'submitted' ? 'submitted' : existing.status === 'approved' ? 'approved' : 'in-workspace') : 'in-workspace';
  setState({ activeQuestId: questId, draft: existing?.payload ?? emptyDraft(q.type), workspace: ws, checkErrors: [] });
  return true;
}

export function closeQuest() { setState({ activeQuestId: null, draft: null, workspace: 'browsing', checkErrors: [] }); }

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

export function upsertContribution(c: Contribution) {
  const others = state.contributions.filter((x) => x.id !== c.id);
  setState({ contributions: [...others, c] });
}

export function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
