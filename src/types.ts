export type QuestType = 'verify-hours' | 'access-photo' | 'plain-rewrite';

export interface Profile {
  name: string;
  minutesAvailable: number;
  skills: string[];
  languages: string[];
  accessibilityNeeds: string[];
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
  sourceTags: Record<string, string>;
  estimatedMinutes: number;
  requiredSkills: string[];
  languages: string[];
  remote: boolean;
  campaignId: string;
  /** plain-rewrite only */
  sourceText?: string;
  sourceUrl?: string;
  sourceLicense?: string;
}

export type ContributionPayload =
  | { kind: 'verify-hours'; openingHours: string; verifiedBy: '' | 'phone' | 'visit' | 'website'; note: string }
  | { kind: 'access-photo'; imageDataUrl: string; wheelchair: '' | 'yes' | 'limited' | 'no'; note: string }
  | { kind: 'plain-rewrite'; rewrittenText: string };

export type ContributionStatus = 'draft' | 'checked' | 'submitted' | 'approved' | 'rejected';

export interface Contribution {
  id: string;
  questId: string;
  questTitle: string;
  volunteerName: string;
  payload: ContributionPayload;
  status: ContributionStatus;
  checkErrors: string[];
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

export interface AppState {
  profile: Profile;
  quests: Quest[];
  campaigns: Campaign[];
  contributions: Contribution[];
  activeQuestId: string | null;
  draft: ContributionPayload | null;
  workspace: WorkspaceState;
  role: 'volunteer' | 'reviewer';
  questSource: 'live' | 'cached' | 'fallback' | 'loading';
  checkErrors: string[];
  confirmOpen: boolean;
  toast: string | null;
}

export type QuestEvent =
  | { type: 'contribution:submitted'; contributionId: string; questId: string }
  | { type: 'contribution:approved'; contributionId: string; questId: string; reviewerName: string }
  | { type: 'contribution:rejected'; contributionId: string; questId: string; comment: string };
