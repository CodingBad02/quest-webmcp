/** Browser client for the store. Used by Quest and Survey. Plain fetch, no framework. */
import type { ExchangeResponse, StoredContribution, StoredState } from './shapes.ts';

export type { ExchangeResponse, QuestRef, StoredContribution, StoredState } from './shapes.ts';

export class StoreError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** A random id that stays in this browser. Never shown, never ranked. */
export function localSession(key = 'quest.session'): string {
  try {
    let s = localStorage.getItem(key);
    if (!s) { s = crypto.randomUUID(); localStorage.setItem(key, s); }
    return s;
  } catch {
    return crypto.randomUUID();
  }
}

export function createStoreClient(baseUrl: string, session: string) {
  const base = baseUrl.replace(/\/$/, '');
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-session': session },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new StoreError(res.status, (data as { error?: string }).error ?? `Store returned ${res.status}.`);
    return data as T;
  }
  return {
    list: (state?: StoredState) => call<StoredContribution[]>('GET', `/contributions${state ? `?state=${state}` : ''}`),
    get: (id: string) => call<StoredContribution>('GET', `/contributions/${id}`),
    upsert: (id: string, patch: Partial<StoredContribution>) => call<StoredContribution>('PUT', `/contributions/${id}`, patch),
    review: (id: string, decision: 'approved' | 'rejected' | 'stale', reviewerName: string, comment?: string) =>
      call<StoredContribution>('POST', `/contributions/${id}/review`, { decision, reviewerName, comment }),
    issueHandoff: (contributionId: string, targetOrigin: string, ttlSeconds = 300, action: 'contribute' | 'stage' = 'contribute') =>
      call<{ handoff: string; expiresAt: string }>('POST', '/handoffs', { contributionId, targetOrigin, ttlSeconds, action }),
    exchange: (handoff: string) => call<ExchangeResponse>('POST', '/handoffs/exchange', { handoff }),
  };
}

export type StoreClient = ReturnType<typeof createStoreClient>;
