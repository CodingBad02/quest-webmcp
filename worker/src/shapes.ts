/** Wire shapes shared by the Worker and both sites. The store holds exactly two entities. */

export type StoredState = 'open' | 'submitted' | 'approved' | 'rejected' | 'stale' | 'landed';

export interface QuestRef {
  id: string;
  type: 'verify-hours' | 'access-photo';
  title: string;
  placeName: string;
  /** OSM element, e.g. "node/123". */
  osmRef?: string;
  /** OSM element version when the quest was opened. The conflict marker. */
  osmVersion?: number;
  lat?: number;
  lon?: number;
  license: string;
}

export interface StoredContribution {
  id: string;
  quest: QuestRef;
  /** Opaque browser session that owns the draft. Never shown. */
  ownerSession: string;
  volunteerName: string;
  payload: Record<string, unknown>;
  state: StoredState;
  /** Which origin the evidence was entered on. */
  via?: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerName?: string;
  reviewComment?: string;
  /** Note, changeset, or revision id once the source accepted the write (P1). */
  landedRef?: string;
}

export interface Handoff {
  /** SHA-256 of the token the agent carries. */
  hash: string;
  contributionId: string;
  targetOrigin: string;
  action: 'contribute';
  expiresAt: string;
  used: boolean;
}

export interface ExchangeResponse {
  contribution: StoredContribution;
  /** The right to act as the volunteer for this one contribution. */
  session: string;
  expiresAt: string;
}
