/** Wire shapes shared by the Worker and both sites. The store holds exactly two entities. */

export type StoredState = 'open' | 'submitted' | 'approved' | 'rejected' | 'stale' | 'landed';

export interface QuestRef {
  id: string;
  type: 'verify-hours' | 'access-photo' | 'cite-claim';
  title: string;
  placeName: string;
  /** OSM element, e.g. "node/123". */
  osmRef?: string;
  /** OSM element version when the quest was opened. The conflict marker. */
  osmVersion?: number;
  lat?: number;
  lon?: number;
  license: string;
  /** cite-claim only: the Wikidata statement the review's conflict check re-fetches. */
  claim?: { entityId: string; property: string; statementId: string; valueRaw: string };
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
  /** contribute: act as the volunteer on a partner site. stage: load an approved edit into an editor, no write. */
  action: 'contribute' | 'stage';
  expiresAt: string;
  used: boolean;
}

/** A scoped capability minted on exchange: writes to one contribution, until the handoff's expiry. */
export interface Grant {
  contributionId: string;
  expiresAt: string;
}

export interface ExchangeResponse {
  /** Public view: never carries `ownerSession`. */
  contribution: Omit<StoredContribution, 'ownerSession'>;
  action: 'contribute' | 'stage';
  /** contribute only: send as `x-session` to write this one contribution until `expiresAt`. */
  grant?: string;
  expiresAt: string;
}
