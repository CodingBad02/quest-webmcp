export type QuestType = 'verify-hours' | 'access-photo' | 'cite-claim';

export interface Profile {
  name: string;
  minutesAvailable: number;
  skills: string[];
  languages: string[];
  accessibilityNeeds: string[];
}

/** A Wikidata statement without a reference: the entity, the property, and the value it claims.
 *  `statementId` is the part after `/statement/` in the statement URI, the conflict marker for
 *  the cite-claim adapter (SPEC.md's "preserved claim identity"). */
export interface ClaimRef {
  entityId: string;
  property: string;
  propertyLabel: string;
  statementId: string;
  valueRaw: string;
  valueText: string;
}

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  placeName: string;
  amenity?: string;
  address?: string;
  lat?: number;
  lon?: number;
  osmLink?: string;
  /** OSM element, e.g. "node/123". Undefined for fallback-JSON quests, which carry no version to conflict-check. */
  osmRef?: string;
  osmVersion?: number;
  sourceTags: Record<string, string>;
  estimatedMinutes: number;
  requiredSkills: string[];
  languages: string[];
  remote: boolean;
  campaignId: string;
  /** cite-claim only: the Wikidata statement this quest asks a source for. */
  claim?: ClaimRef;
}

export type ContributionPayload =
  | { kind: 'verify-hours'; openingHours: string; verifiedBy: '' | 'phone' | 'visit' | 'website'; note: string }
  | { kind: 'access-photo'; imageDataUrl: string; wheelchair: '' | 'yes' | 'limited' | 'no'; note: string }
  | { kind: 'cite-claim'; sourceUrl: string; quote: string; confirmed: boolean };

/** SPEC.md's ten-state envelope. `open` is the pre-check draft state (v1's `draft`). */
export type ContributionStatus =
  | 'available' | 'open' | 'invalid' | 'checked' | 'declined' | 'submitted' | 'approved' | 'rejected' | 'stale' | 'landed';

export interface Contribution {
  id: string;
  questId: string;
  questTitle: string;
  volunteerName: string;
  payload: ContributionPayload;
  status: ContributionStatus;
  /** The origin the evidence was entered on. Quest's own origin when unset or equal to it. */
  via?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerName?: string;
  reviewComment?: string;
}

export interface Campaign {
  id: string;
  name: string;
  questIds: string[];
}

export interface Star {
  questId: string;
  lit: boolean;
  litBy?: string;
  reviewedBy?: string;
  litAt?: string;
}

export type WorkspaceState = 'browsing' | 'in-workspace' | 'checked' | 'submitted' | 'approved' | 'rejected';

export interface Handoff {
  url: string;
  expiresAt: string;
  questId: string;
}

export interface AppState {
  profile: Profile;
  quests: Quest[];
  campaigns: Campaign[];
  /** cite-claim's own bounded discovery set (DESIGN.md §8's knowledge graph), separate from
   *  `campaigns` so the Wikidata adapter never adds a panel to the geographic sky. */
  wdCampaigns: Campaign[];
  contributions: Contribution[];
  activeQuestId: string | null;
  draft: ContributionPayload | null;
  workspace: WorkspaceState;
  role: 'volunteer' | 'reviewer';
  questSource: 'live' | 'cached' | 'fallback' | 'loading';
  checkErrors: string[];
  /** cite-claim only: the fetched page title of the checked source, shown under the field. */
  checkTitle: string | null;
  toast: string | null;
  /** The open cross-site continuation for the active access-photo quest, if any. */
  handoff: Handoff | null;
}

export type QuestEvent =
  | { type: 'contribution:submitted'; contributionId: string; questId: string }
  | { type: 'contribution:approved'; contributionId: string; questId: string; reviewerName: string }
  | { type: 'contribution:rejected'; contributionId: string; questId: string; comment: string }
  | { type: 'contribution:stale'; contributionId: string; questId: string; comment: string };
