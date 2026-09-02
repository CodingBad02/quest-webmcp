import type { ModelContext } from '@mcp-b/webmcp-types';

export const PROTOCOL = 'quest/1' as const;

export const VERBS = ['find', 'open', 'check', 'submit', 'approve'] as const;
export type Verb = (typeof VERBS)[number];

/** The only five tool names the package ever registers. */
export const TOOL_NAMES: Readonly<Record<Verb, string>> = {
  find: 'find-quests',
  open: 'open-quest',
  check: 'check-contribution',
  submit: 'submit-contribution',
  approve: 'approve-contribution',
};

export type QuestState =
  | 'available' | 'open' | 'invalid' | 'checked' | 'declined'
  | 'submitted' | 'approved' | 'rejected' | 'stale' | 'landed';

export interface QuestToolResult {
  protocol: typeof PROTOCOL;
  ok: boolean;
  state: QuestState;
  message: string;
  questId?: string;
  contributionId?: string;
  /** Cross-site continuation: the agent navigates to `url`; the receiving origin exchanges `handoff`. */
  next?: { url: string; handoff: string };
}

/** What the confirmation dialog shows. Built by the site's `check` operation, shown by the package. */
export interface ConfirmContent {
  mode?: 'review' | 'public';
  summary: [label: string, value: string][];
  destination: string;
  visibility: string;
  license: string;
}

export type ConfirmOutcome = 'confirmed' | 'declined' | 'timeout' | 'cancelled';
export type ConfirmFn = (content: ConfirmContent, opts: { signal: AbortSignal; timeoutMs: number }) => Promise<ConfirmOutcome>;

export interface OpContext {
  signal: AbortSignal;
  /** True when a person clicked a UI button. False when an agent called the tool. */
  viaUi: boolean;
}

type MaybePromise<T> = T | Promise<T>;
export type CheckResult = QuestToolResult & { confirm?: ConfirmContent };

/** A site implements only the verbs it can perform. */
export interface Operations {
  find?(input: Record<string, unknown>, ctx: OpContext): MaybePromise<QuestToolResult>;
  open?(input: { id: string }, ctx: OpContext): MaybePromise<QuestToolResult>;
  /** When `ok`, return `confirm` so `submit` can show an exact preview. */
  check?(input: Record<string, unknown>, ctx: OpContext): MaybePromise<CheckResult>;
  submit?(input: Record<string, unknown>, ctx: OpContext): MaybePromise<QuestToolResult>;
  approve?(input: { contributionId: string; comment?: string }, ctx: OpContext): MaybePromise<QuestToolResult>;
}

/** `true` registers the tool. `{ locked }` shows it greyed with the reason. `false` or absent hides it. */
export type Availability = boolean | { locked: string };

export interface InputSchema { type: 'object'; properties?: Record<string, { type: string; description?: string; enum?: string[]; items?: unknown }>; required?: string[] }

export interface QuestToolsConfig {
  protocol: typeof PROTOCOL;
  operations: Operations;
  available(): Partial<Record<Verb, Availability>>;
  confirm: ConfirmFn;
  /** Agent-facing tool descriptions. Under 500 characters. */
  descriptions?: Partial<Record<Verb, string>>;
  /** Human-facing one-liners shown in the rack. */
  labels?: Partial<Record<Verb, string>>;
  inputSchemas?: Partial<Record<Verb, InputSchema>>;
  confirmTimeoutMs?: number;
  /** Defaults to `document.modelContext`. Pass `null` to run without a runtime (manual mode). */
  modelContext?: ModelContext | null;
}

export type RackStatus = 'available' | 'new' | 'executing' | 'removing' | 'locked';
/** `description` is the human label, not the agent description. */
export interface RackItem { name: string; description: string; status: RackStatus; reason?: string }

export interface QuestToolsController {
  run(verb: Verb, input?: Record<string, unknown>, opts?: { viaUi?: boolean; signal?: AbortSignal }): Promise<QuestToolResult>;
  /** Re-evaluate `available()` and make the registered set match. Call on every state change. */
  refresh(): void;
  getRack(): RackItem[];
  subscribe(listener: () => void): () => void;
  registeredNames(): string[];
  hasRuntime: boolean;
  runtime(): string;
  destroy(): void;
}
