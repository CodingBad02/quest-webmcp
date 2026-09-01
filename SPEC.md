# Quest — Build Specification

Version 1. Written 2026-09-02. Target: The WebMCP Challenge, submission due 2026-09-03 13:00 PDT (2026-09-04 01:30 IST).

This document covers what we build. The demo video and submission text live in a separate document.

---

# Part A — Product

## A1. One sentence

Quest turns "I have twenty minutes and want to help" into one real, checkable community contribution, with a browser agent doing the logistics and a person doing the work.

## A2. The principle

**The agent does logistics. The human does the work.**

The agent finds a quest that fits the volunteer's time, skills, language, and accessibility needs. It opens the workspace. It checks the submission's structure. It submits after the person clicks confirm. It routes the result to a reviewer.

The person supplies what an agent cannot: a phone call to confirm opening hours, a photo of a real entrance, a rewrite from lived experience.

## A3. Why this shape

- WebMCP is load-bearing. Tools appear and disappear with page state. Submit exists only after a check passes. The agent runs inside the volunteer's logged-in session. A chatbot cannot do any of this.
- Quests come from real data gaps in OpenStreetMap. No seeded nonprofit. Anyone can verify a quest against the real world.
- Impact is shown, not told. A reviewer approves on camera. A star lights in a shared constellation.
- Cooperative, not competitive. No leaderboards, no points. This is an ethical choice, not a claim that it drives more output. The research says competition often does.

## A4. Scope

In scope for version 1:

| Item | Detail |
|---|---|
| Three quest types | `verify-hours`, `access-photo`, `plain-rewrite` |
| Four WebMCP tools | `find-quests`, `check-contribution`, `submit-contribution`, `approve-contribution` |
| Capability rack | Visible panel of tools available now. Animates on change. |
| Human confirmation | Submit needs a click in the UI. |
| Reviewer tab | Second tab. Approve or send back. Cross-tab live update. |
| Constellation | One SVG per campaign. One star per quest. Lights on approval. |
| Real quest source | Overpass API over OpenStreetMap, with cached fallback |
| Static deploy | Netlify or Vercel. No backend. localStorage plus BroadcastChannel. |
| Open source | MIT license at repo root. Public repository. |

Out of scope for version 1: accounts, multiple organizations, peer review queues with thresholds, skill paths, chapters, writing to OpenStreetMap automatically, mobile-first layout, Firefox or Safari.

## A5. Decisions that override the parts below

The three parts below were drafted separately. Where they disagree, these decisions win.

1. **Reviewer uses a tool.** The reviewer tab registers `approve-contribution`. The human reviewer reads the submission, then tells the agent to approve, or clicks Approve. Both paths call the same function. Part C's table says the reviewer has no tool. Ignore that row.
2. **One tool call waits for the click.** `submit-contribution` opens the confirmation modal and awaits the click inside `execute`, with a 90 second timeout. On timeout it returns "The volunteer did not confirm. Ask them, then call again." If the hour-one test shows the runtime cuts long tool calls short, fall back to Part B's two-call flag flow. Modal copy comes from Part C section 6.
3. **Overpass queries come from Part D section 3.** They use `nwr`, an amenity allow-list, and were run live with results counted. Part B section 9 queries are superseded.
4. **Opening hours validation uses the `opening_hours` npm package.** Part B's regex is the fallback only if the package fails to bundle.
5. **Plain-language checks come from Part D section 7.** Average sentence length, passive voice heuristic, Flesch-Kincaid grade 8 or lower, jargon list, numbers and names preserved. Part B's 25-word check is superseded.
6. **Photos are downscaled before storage.** Resize to 1280 px on the long edge with a canvas, JPEG quality 0.8. This keeps data URLs under 2 MB and localStorage safe. Part D's 5 MB is the upload limit before resize.
7. **Canonical field names are the TypeScript types in Part B section 3.** Part D's JSON examples use snake_case. Map them.
8. **Constellation state is per campaign.** Extend Part B's types with:

```ts
export interface Campaign {
  id: string;            // seed for star positions
  name: string;          // "Missing wheelchair tags, central Bengaluru"
  questIds: string[];    // 6 to 14
}
export interface Star {
  questId: string;
  lit: boolean;
  litBy?: string;        // volunteer first name
  reviewedBy?: string;   // reviewer first name
  litAt?: string;
}
```

9. **`find-quests` registers on load.** The profile is optional. Tool arguments override profile values. A person with no profile can still ask the agent for a quest.
10. **Rejection is a UI button, not a tool.** Keeps four tools. Each tool does one job.
11. **`open-quest` is the fifth tool.** Without it the agent cannot move the volunteer into a workspace. Verified in build: the agent-driven flow needs it. The four-tool count elsewhere in this document is superseded.
12. **Demo city is central Bengaluru.** Center 12.9716, 77.5946. About 100 candidate places within 1 km. Ship the pre-fetched JSON as fallback.

## A6. What the agent can do on each screen

| Screen | Agent tools available |
|---|---|
| Home and profile | `find-quests` |
| Quest list | `find-quests` |
| Quest workspace | `find-quests`, `check-contribution`, then `submit-contribution` after a pass |
| Review queue (second tab) | `approve-contribution` when the queue is not empty |
| Constellation | none. Read only. |

## A7. Success criteria for version 1

1. An agent in ChatGPT desktop browser or Chrome 149+ lists and calls all four tools.
2. `submit-contribution` is absent until `check-contribution` passes. The capability rack shows this on screen.
3. A submit without a click fails with an actionable message. A submit after a click succeeds.
4. Approval in tab two lights a star in tab one within one second.
5. Quests load from Overpass. When offline, they load from the fallback file.
6. The full manual checklist in Part B section 14 passes on the deployed URL.

---

# Part B — Technical


## 1. Stack decision

**Decision: Vite + React + TypeScript.**

Vite gives instant reload, which matters when one developer has about 12 hours. React's component lifecycle maps directly onto the quest workspace state machine — tool registration lives in `useEffect`, so the UI and the registered tool set never drift apart. TypeScript catches mismatches between an `inputSchema` and its `execute()` function before Chrome does, which saves debugging time under a hard deadline.

A React hook for WebMCP registration exists, but only as third-party packages: `use-webmcp-tool`, `webmcp-sdk`, `usewebmcp`, `@mcp-b/react-webmcp`. None is confirmed as an official, stable Chrome release. **UNVERIFIED.** Do not add this dependency under deadline pressure. Write a 15-line custom hook instead (see section 6).

---

## 2. Architecture: modules and files

```
quest/
  index.html
  LICENSE                      # MIT, at repo root
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    types.ts                   # section 3 types
    state/
      store.ts                 # localStorage-backed app state
      questMachine.ts           # section 4 state machine
    webmcp/
      useWebMCPTool.ts          # custom registration hook
      findQuests.ts
      checkContribution.ts
      submitContribution.ts
      approveContribution.ts
      capabilityRackStore.ts    # internal tool registry, section 6
    data/
      seedQuests.ts              # seeded quests, non-OSM types
      fallbackOverpass.json      # cached Overpass response
      overpass.ts                # fetch + cache + map to Quest
      questStore.ts
    validators/
      verifyHours.ts
      accessPhoto.ts
      plainRewrite.ts
    channel/
      broadcast.ts               # BroadcastChannel wrapper
    components/
      CapabilityRack.tsx
      QuestList.tsx
      Workspace.tsx
      ReviewerQueue.tsx
      Constellation.tsx
  public/
    favicon.svg
```

No backend. No API routes. All state in `localStorage`. Cross-tab sync via `BroadcastChannel`.

---

## 3. Data model

```ts
export type QuestType = 'verify-hours' | 'access-photo' | 'plain-rewrite';

export interface Profile {
  id: string;
  name: string;
  minutesAvailable: number;
  skills: string[];
  languages: string[];
  accessibilityNeeds: string[];
}

export interface OsmRef {
  osmType: 'node' | 'way';
  osmId: number;
}

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  lat: number;
  lon: number;
  address?: string;
  osmRef?: OsmRef;
  sourceTags: Record<string, string>;   // raw OSM tags, untrusted, see section 12
  estimatedMinutes: number;
  requiredSkills: string[];
  languages: string[];
  accessibilityRelevant: boolean;
  source: 'overpass' | 'seed' | 'fallback';
  createdAt: string;                    // ISO 8601
}

export type ContributionPayload =
  | { kind: 'verify-hours'; openingHours: string; verifiedBy: 'phone' | 'visit' | 'website'; note?: string }
  | { kind: 'access-photo'; imageDataUrl: string; wheelchairValue: 'yes' | 'no' | 'limited'; note?: string }
  | { kind: 'plain-rewrite'; originalText: string; rewrittenText: string };

export type ContributionStatus = 'draft' | 'checked' | 'submitted' | 'approved' | 'rejected';

export interface Contribution {
  id: string;
  questId: string;
  volunteerId: string;
  payload: ContributionPayload;
  status: ContributionStatus;
  checkErrors: string[];
  submittedAt?: string;
  reviewedAt?: string;
}

export interface Review {
  id: string;
  contributionId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  reviewedAt: string;
}

export interface ConstellationState {
  totalStars: number;
  starsByType: Record<QuestType, number>;
  recentApprovals: { contributionId: string; questType: QuestType; approvedAt: string }[];
}
```

---

## 4. Quest workspace state machine

| State | Entered by | find-quests | check-contribution | submit-contribution | approve-contribution |
|---|---|---|---|---|---|
| `idle` | app load | on | off | off | off |
| `browsing` | user or agent lists quests | on | off | off | off |
| `in-workspace` | user opens a quest | on | on | off | off |
| `checked` | check passes | on | on | on | off |
| `submitted` | submit succeeds | on | off | off | off |
| `approved` | reviewer approves | on | off | off | off |
| `rejected` | reviewer rejects | on | off | off | off |

Transitions:

```
idle          -> browsing        : list rendered
browsing      -> in-workspace     : user opens a quest
in-workspace  -> in-workspace     : check fails, errors shown
in-workspace  -> checked          : check passes
checked       -> in-workspace     : user edits the draft (check invalidated)
checked       -> submitted        : submit succeeds (human click required)
submitted     -> approved         : reviewer approves (cross-tab)
submitted     -> rejected         : reviewer rejects (cross-tab)
rejected      -> in-workspace     : user edits and resubmits
```

`approve-contribution` is `on` only in the reviewer tab's own machine, which has two states: `reviewer-idle` (tool off) and `reviewer-queue` (tool on, one submitted contribution present).

---

## 5. Tool contracts

All four tools use `document.modelContext.registerTool`. Output is always `{ content: [{ type: "text", text }] }`. Text stays under 1,500 characters — Chrome's documented budget, not confirmed as hard-enforced by every runtime. **Treat as a hard limit anyway.**

### find-quests

| Field | Value |
|---|---|
| name | `find-quests` (12 chars) |
| registered | always |

Description (positive framing, 240 chars):
```
Find volunteer micro-tasks near the user that fit the time they have, their
skills, spoken languages, and accessibility needs. Returns a short ranked
list of quests, each with an estimated time and a quest type.
```

```json
{
  "type": "object",
  "properties": {
    "minutesAvailable": { "type": "number", "description": "Minutes the volunteer has free right now" },
    "skills": { "type": "array", "items": { "type": "string" }, "description": "Skills the volunteer has, e.g. photography, translation" },
    "languages": { "type": "array", "items": { "type": "string" }, "description": "Languages the volunteer speaks" },
    "accessibilityFocus": { "type": "boolean", "description": "True if the volunteer wants accessibility quests first" }
  },
  "required": ["minutesAvailable"]
}
```

Success output:
```
Found 3 quests near you:
1. Verify hours — Riverside Library (5 min) [verify-hours]
2. Photo the entrance — Corner Cafe (10 min) [access-photo]
3. Plain-language rewrite — Shelter intake form (15 min) [plain-rewrite]
Open one with its title to start.
```

Error output:
```
No quests match 5 minutes available. Try 15 minutes or more, or drop the
language filter.
```

Execute pseudocode:
```
async execute(args) {
  const profile = readProfile();
  const merged = { ...profile, ...args };
  const quests = await getQuestPool();           // seed + overpass + fallback
  const matches = filterAndRank(quests, merged);
  if (matches.length === 0) return errorText(explainWhyNoMatch(merged));
  return successText(formatQuestList(matches.slice(0, 5)));
}
```

### check-contribution

| Field | Value |
|---|---|
| name | `check-contribution` (19 chars) |
| registered | inside a workspace |

Description (180 chars):
```
Check the current quest draft for missing fields, wrong formats, or unclear
language before it is submitted. Returns exactly what to fix, or confirms
it is ready.
```

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

No parameters. The tool closes over the active `questId` and draft via the registration context (see section 6).

Success output:
```
Structure looks good. Opening hours are in valid format. Ready to submit.
```

Error outputs:
```
Missing opening_hours value. Use OSM syntax, e.g. "Mo-Fr 09:00-17:00".
```
```
Sentence too long: "This organization which was founded a long time ago by
...". Split it under 25 words.
```

Execute pseudocode:
```
async execute() {
  const draft = getActiveDraft();
  const errors = validateByType(draft.payload);   // section 10
  setCheckErrors(draft.id, errors);
  if (errors.length) { transition('in-workspace'); return errorText(errors[0]); }
  transition('checked');
  return successText('Structure looks good. Ready to submit.');
}
```

### submit-contribution

| Field | Value |
|---|---|
| name | `submit-contribution` (20 chars) |
| registered | only after check passes |

Description (220 chars):
```
Submit a quest contribution the volunteer has already confirmed in the app.
Call this after asking the volunteer to click Confirm & Submit. Revalidates
the draft and sends it to a reviewer.
```

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

Success output:
```
Submitted. A reviewer will check "Verify hours — Riverside Library" soon.
```

Error outputs:
```
Waiting for the volunteer to click Confirm & Submit in the app. Ask them
to click it, then call this tool again.
```
```
The draft changed since it was checked. Call check-contribution again
before submitting.
```

Execute pseudocode (revalidates inside execute, per Chrome's guidance):
```
async execute(_args, { signal }) {
  const draft = getActiveDraft();
  const errors = validateByType(draft.payload);        // revalidate, never trust prior check
  if (errors.length) return errorText(errors[0]);
  if (!uiState.humanConfirmed) {
    return errorText('Waiting for the volunteer to click Confirm & Submit ' +
      'in the app. Ask them to click it, then call this tool again.');
  }
  const contribution = persistContribution(draft, 'submitted');
  uiState.humanConfirmed = false;
  broadcast({ type: 'contribution:submitted', contributionId: contribution.id,
    questId: draft.questId, questType: draft.payload.kind,
    submittedAt: contribution.submittedAt });
  transition('submitted');
  return successText(`Submitted. A reviewer will check "${draft.title}" soon.`);
}
```

### approve-contribution

| Field | Value |
|---|---|
| name | `approve-contribution` (21 chars) |
| registered | reviewer tab only, when a submitted contribution is in the queue |

Description (190 chars):
```
Approve a submitted volunteer contribution as a reviewer. Lights a star in
the shared constellation and tells the volunteer's tab it was approved.
```

```json
{
  "type": "object",
  "properties": {
    "contributionId": { "type": "string", "description": "ID of the submitted contribution to approve" },
    "comment": { "type": "string", "description": "Optional short note to the volunteer" }
  },
  "required": ["contributionId"]
}
```

Success output:
```
Approved. Star lit for "Verify hours — Riverside Library". Volunteer notified.
```

Error output:
```
No submitted contribution with that ID. Refresh the review queue and try again.
```

Execute pseudocode:
```
async execute({ contributionId, comment }) {
  const contribution = getContribution(contributionId);
  if (!contribution || contribution.status !== 'submitted') {
    return errorText('No submitted contribution with that ID. Refresh the review queue and try again.');
  }
  const review = persistReview(contributionId, 'approved', comment);
  updateContribution(contributionId, 'approved', review.reviewedAt);
  const stars = incrementConstellation(contribution.payload.kind);
  broadcast({ type: 'contribution:approved', contributionId,
    questId: contribution.questId, totalStars: stars.totalStars,
    approvedAt: review.reviewedAt });
  return successText(`Approved. Star lit for "${contribution.title}". Volunteer notified.`);
}
```

Rejection is a plain UI button in the reviewer tab, not a tool call. It keeps each tool to one job and keeps the tool count at four.

---

## 6. Dynamic registration

Own `AbortController` per tool. Store controllers in a map keyed by tool name. On every state transition, abort controllers for tools the new state does not need, then register the tools it does need with fresh controllers.

```ts
// webmcp/useWebMCPTool.ts
const controllers = new Map<string, AbortController>();

export function registerQuestTool(tool: WebMCPToolDef) {
  if (!('modelContext' in document)) return;
  unregisterQuestTool(tool.name);
  const controller = new AbortController();
  controllers.set(tool.name, controller);
  document.modelContext.registerTool(tool, { signal: controller.signal });
  capabilityRackStore.add(tool.name, tool.description);
}

export function unregisterQuestTool(name: string) {
  const controller = controllers.get(name);
  if (controller) { controller.abort(); controllers.delete(name); }
  capabilityRackStore.remove(name);
}
```

`unregisterTool(name)` exists in some builds for backward compatibility, but a later spec draft removed it in favor of the `AbortSignal` pattern. **UNVERIFIED which runtimes still honor it.** Use `AbortController` as the primary mechanism. Feature-detect and skip silently where `document.modelContext` is absent.

**Capability rack.** Do not drive the rack UI from the `toolchange` event alone — support for it across runtimes (Chrome vs. ChatGPT desktop browser) is **UNVERIFIED**. Drive the rack from `capabilityRackStore`, an internal pub/sub updated by every `registerQuestTool` / `unregisterQuestTool` call. This is the source of truth and always animates correctly, regardless of runtime event support.

As a secondary check, also listen for `toolchange` where available, and log a mismatch warning if `document.modelContext.getTools()` disagrees with the internal store — useful during hour-1 testing, not required for the demo.

---

## 7. Human confirmation flow

No native confirmation primitive ships reliably (`requestUserInteraction()` status conflicts across sources, **UNVERIFIED**, do not depend on it). Build confirmation entirely in the UI.

Exact sequence:

1. `check-contribution` passes. Workspace shows a "Ready to submit" banner and a **Confirm & Submit** button. The button starts enabled but `uiState.humanConfirmed` is `false`.
2. The agent calls `submit-contribution`.
3. `execute()` sees `humanConfirmed === false`. It returns the error text: "Waiting for the volunteer to click Confirm & Submit in the app. Ask them to click it, then call this tool again."
4. The agent relays that message to the person.
5. The person clicks **Confirm & Submit**. The click handler sets `uiState.humanConfirmed = true` and shows "Confirmed. Tell the agent to finish submitting."
6. The agent calls `submit-contribution` again.
7. `execute()` sees `humanConfirmed === true`, revalidates, persists, resets the flag, and returns success text.

The click never submits directly. Only `execute()` submits. This keeps the actual write inside the WebMCP tool call, which matters for the WebMCP Leverage criterion.

---

## 8. Cross-tab reviewer flow

`BroadcastChannel` name: `"quest-events"`.

| Message | Shape | Sent by |
|---|---|---|
| Submitted | `{ type: 'contribution:submitted', contributionId, questId, questType, submittedAt }` | volunteer tab, from `submit-contribution` |
| Approved | `{ type: 'contribution:approved', contributionId, questId, totalStars, approvedAt }` | reviewer tab, from `approve-contribution` |
| Rejected | `{ type: 'contribution:rejected', contributionId, questId, comment, rejectedAt }` | reviewer tab, from the plain reject button |

On receipt:

- **Reviewer tab**, on `contribution:submitted`: adds the item to the review queue UI. If the queue was empty, this transitions the tab's own state to `reviewer-queue`, which registers `approve-contribution`.
- **Volunteer tab**, on `contribution:approved`: updates the contribution's status badge, plays the star animation, updates `ConstellationState.totalStars` in local UI.
- **Volunteer tab**, on `contribution:rejected`: shows the reviewer comment, transitions the workspace back to `in-workspace` so the person can fix and resubmit.

`localStorage` is the source of truth in every tab; `BroadcastChannel` is only the live nudge. A reload with no message still shows correct state because each tab reads `localStorage` on mount.

```ts
// channel/broadcast.ts
const channel = new BroadcastChannel('quest-events');
export function broadcast(msg: QuestEvent) { channel.postMessage(msg); }
export function onQuestEvent(handler: (msg: QuestEvent) => void) {
  channel.addEventListener('message', (e) => handler(e.data));
}
```

---

## 9. Overpass API

Endpoint: `https://overpass-api.de/api/interpreter` (POST, body = query text).

**Query 1 — amenities within 1 km missing `wheelchair`:**
```
[out:json][timeout:25];
(
  node["amenity"][!"wheelchair"](around:1000,{{lat}},{{lon}});
  way["amenity"][!"wheelchair"](around:1000,{{lat}},{{lon}});
);
out center tags;
```

**Query 2 — amenities within 1 km missing `opening_hours`:**
```
[out:json][timeout:25];
(
  node["amenity"][!"opening_hours"](around:1000,{{lat}},{{lon}});
  way["amenity"][!"opening_hours"](around:1000,{{lat}},{{lon}});
);
out center tags;
```

`[!"key"]` selects elements that do not have that tag key. `(around:radius,lat,lon)` filters by distance in meters. `out center tags` returns a `center` point for ways plus all tags.

**Response mapping:**
```ts
function mapElementToQuest(el: OverpassElement, type: QuestType): Quest {
  const point = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
  return {
    id: `osm-${el.type}-${el.id}`,
    type,
    title: el.tags.name ?? el.tags.amenity ?? 'Unnamed place',
    description: describeGap(type, el.tags),
    lat: point.lat, lon: point.lon,
    osmRef: { osmType: el.type, osmId: el.id },
    sourceTags: el.tags,
    estimatedMinutes: type === 'verify-hours' ? 10 : 15,
    requiredSkills: [], languages: [], accessibilityRelevant: type === 'access-photo',
    source: 'overpass', createdAt: new Date().toISOString(),
  };
}
```

**Rate limits (public instance, per OSM wiki):** stay under 10,000 queries and 1 GB/day. Commercial-style apps: divide both by 100. On HTTP 429 or 406, back off 30 seconds before retrying. Default query timeout is 3 minutes server-side; the query above caps at 25 seconds client-side, which is enough for a 1 km radius.

**Caching plan:** cache the raw JSON response in `localStorage`, keyed by `overpass:{questType}:{lat.toFixed(2)}:{lon.toFixed(2)}`, TTL 1 hour. Send a `User-Agent` header naming the app. Never fire both queries in parallel from the same page load — run them sequentially with a small delay.

**Fallback:** `src/data/fallbackOverpass.json`, one saved response from a real query near a real location, bundled with the app. Used when the fetch fails, times out (8 second client timeout), or the browser is offline. The find-quests tool never throws — it falls back silently and blends fallback results with seeded quests.

---

## 10. Validation rules per quest type

| Quest type | Required fields | Format check |
|---|---|---|
| `verify-hours` | `openingHours`, `verifiedBy` | OSM `opening_hours` syntax heuristic (below) |
| `access-photo` | `imageDataUrl`, `wheelchairValue` | image present, under 2 MB as data URL; `wheelchairValue` in `yes/no/limited` |
| `plain-rewrite` | `rewrittenText` | non-empty, differs from `originalText`, passes reading-level heuristic |

**Opening-hours heuristic** (not a full OSM parser, **UNVERIFIED** against every edge case in the real grammar — good enough to block obviously malformed input):
```ts
const DAYS = /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)*$/;
const TIME_RANGE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d(,([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d)*$/;

function isValidOpeningHours(value: string): boolean {
  if (value === '24/7') return true;
  return value.split(';').every((clause) => {
    const trimmed = clause.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return trimmed === 'off' || trimmed === 'closed';
    return DAYS.test(trimmed.slice(0, spaceIdx)) && TIME_RANGE.test(trimmed.slice(spaceIdx + 1));
  });
}
```

**Reading-level heuristic** for `plain-rewrite`, reusing this document's own 20-word rule:
```ts
function readingLevelOk(text: string): { ok: boolean; reason?: string } {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return { ok: false, reason: 'Add at least one sentence.' };
  const tooLong = sentences.find((s) => s.split(/\s+/).length > 25);
  if (tooLong) return { ok: false, reason: `Sentence too long: "${tooLong.slice(0, 40)}...". Split it under 25 words.` };
  return { ok: true };
}
```

**Image check:** reject if `imageDataUrl` is missing, not a `data:image/` URI, or its base64 payload exceeds roughly 2 MB — protects `localStorage`'s per-origin quota (about 5–10 MB).

---

## 11. Feature detection and graceful degradation

```ts
export const hasWebMCP = typeof document !== 'undefined' && 'modelContext' in document;
```

If `hasWebMCP` is `false`:

- Show a banner: "WebMCP not detected. Use Chrome 149+ with `chrome://flags/#enable-webmcp-testing`, or the ChatGPT desktop app browser."
- Route all UI actions (list quests, check, submit, approve) through the same underlying functions the tools call (`findQuestsImpl`, `checkContributionImpl`, etc.), invoked directly from plain buttons and forms.
- Capability rack shows a static "WebMCP unavailable — manual mode" state instead of the live tool list.
- Business logic never lives inside `execute()` bodies only — each tool is a thin wrapper around a shared function, so manual mode and agent mode behave identically.

---

## 12. Security notes

- OSM tag values (`name`, `description`, etc.) are free text from public contributors. Treat as untrusted. Never render with `innerHTML`; use `textContent` or a framework's default escaping.
- Any tool output built from OSM tags should carry `annotations: { untrustedContentHint: true }`. Chrome's docs confirm this annotation exists. Whether the ChatGPT desktop runtime enforces it is **UNVERIFIED** — set it anyway, it costs nothing.
- Strip control characters and cap length before embedding OSM text in tool output, to limit prompt-injection surface inside the 1,500-character output budget.
- Validate strictly inside `execute()`, not just in `inputSchema` — schema validation is advisory, the code check is the real gate (Chrome's own guidance).
- No secrets in the client. No API key needed for the public Overpass instance. No backend, so nothing to leak server-side.
- If an origin trial token is used, it is a public, origin-scoped value by design — not a secret, safe to commit.
- Cap `imageDataUrl` size (section 10) to prevent a hostile or oversized payload from exhausting `localStorage`.

---

## 13. Deploy plan

Netlify or Vercel, static hosting, no server.

1. Push the repo to GitHub. Add `LICENSE` (MIT) at repo root — required by the hackathon rules.
2. `npm run build` produces `dist/`.
3. Netlify: connect the repo, build command `npm run build`, publish directory `dist`. Vercel: same build command, framework preset "Vite."
4. No environment variables required — no secrets, Overpass is a public unauthenticated endpoint.
5. **Origin trial token (optional, stretch):** register the deployed origin at `developer.chrome.com/origintrials`, add `<meta http-equiv="origin-trial" content="TOKEN">` to `index.html`'s head. Not required — the hackathon rules accept "Chrome 149+ with the WebMCP flag" as-is, and judges are told how to enable it.
6. Verify the deployed URL loads with the flag on before recording the video.

---

## 14. Test plan

**Script** (run in Chrome DevTools console on the deployed page, flag enabled):
```js
copy(await navigator.modelContextTesting.listTools());
await navigator.modelContextTesting.executeTool('find-quests', JSON.stringify({ minutesAvailable: 20 }));
```
`navigator.modelContextTesting` is a Chrome-only testing namespace from prior research on this project, not independently reconfirmed today. **UNVERIFIED.** Confirm it exists at the hour-1 gate; if absent, use the DevTools WebMCP panel instead.

**Manual checklist (8 items):**

1. Chrome flag on. Page loads. Capability rack shows only `find-quests`.
2. Console tool listing matches the current state's expected tool set exactly.
3. `find-quests` with a small `minutesAvailable` returns relevant text, under 1,500 characters.
4. Opening a quest workspace makes `check-contribution` appear in the rack, with an animation.
5. Submitting an invalid draft returns an actionable error string from `check-contribution`.
6. Fixing the draft makes the check pass and `submit-contribution` appear.
7. Calling `submit-contribution` before the click returns the "ask the human to confirm" error; after the click, a retry succeeds.
8. A second tab, opened as reviewer, approves the contribution; the first tab updates its status and constellation star count via `BroadcastChannel`.

---

## 15. Build order — 9 hours of engineering

| Hours | Work |
|---|---|
| 0–1 | Scaffold Vite+React+TS. One hello-world tool registered via `document.modelContext`. **Go/no-go gate:** confirm the runtime (Chrome flag or ChatGPT desktop browser) actually calls it and returns text. If it fails, drop React, go vanilla JS, retest before hour 1 ends. |
| 1–2 | Data model types, seeded quests, fallback Overpass JSON, `localStorage` helpers. |
| 2–3 | Overpass fetch, caching, mapping to `Quest`, merge with seeds. |
| 3–4 | `find-quests` tool, browsing UI, capability rack skeleton. |
| 4–5 | Three workspace forms (verify-hours, access-photo, plain-rewrite), `check-contribution` tool, validators. |
| 5–6 | `submit-contribution` tool, human confirmation UI flow, state machine wiring. |
| 6–7 | Reviewer tab, `approve-contribution` tool, `BroadcastChannel`, constellation UI and star animation. |
| 7–8 | Capability rack polish and animation, feature-detection fallback, security pass (sanitize, `untrustedContentHint`). |
| 8–9 | Run the full manual checklist (section 14). Fix what breaks. |

Hours 9–12 are integration, video, and submission — out of scope for this engineering section. Submit with a buffer before the 2026-09-03 13:00 PDT deadline.
---

# Part C — UX and UI


## 1. Design principles

Five principles. Each ties to one cited reference (full citations in §12).

1. **Offer real choice, never fake points.** Quests carry difficulty and time tags; volunteers pick, not queue. (Ryan & Deci, 2000)
2. **Make work visible, never ranked.** Show who did what and why it matters, with no scores or leaderboards. (Erickson & Kellogg, 2000)
3. **Show one honest step, never total progress.** A goal-gradient bar tracks the current quest only, not lifetime output. (Kivetz, Urminsky & Zheng, 2006)
4. **Teach one tool at a time, fast.** A volunteer reaches their first submission inside five minutes of landing. (Hodent, 2016)
5. **Match the task to the person, always.** Time, skill, and language filters run before any quest is shown. (Porto de Albuquerque, Herfort & Eckle, 2016)

## 2. Information architecture

Five screens only. Each row states what the agent can do there.

| Screen | Contains | Agent can |
|---|---|---|
| Home / Profile setup | Name, language, available time window, skills (photo, writing, phone calls), accessibility needs. One-screen form, no account wall. | Nothing yet — no tools registered until a profile exists. |
| Quest list | Cards: quest type icon, place or document name, estimated time, distance if relevant. Filter chips (time, skill, language). | Run `find-quests`, filtered by the saved profile. |
| Quest workspace (per type) | The type-specific form (§7), source data pulled from OpenStreetMap or the source document, a sticky confirm bar. | Run `check-contribution` once fields are filled; `submit-contribution` appears only after a check passes. |
| Review queue (reviewer tab) | List of pending submissions: diff view (old value vs. new value), approve / send-back buttons, no reviewer identity shown to other reviewers. | Nothing — the reviewer is a human end to end. The agent only reads state to update the volunteer's tab. |
| Constellation view | The shared sky: one constellation per campaign, star count matching quest count, hover/tap detail. | Nothing — read-only. No tool touches this screen directly. |

Five screens, five jobs. No screen duplicates another's purpose.

## 3. Layout spec — main screen (quest workspace)

Three regions: constellation strip (top), quest workspace (main), capability rack (side). Desktop-first.

| Region | Role | Width / height |
|---|---|---|
| Constellation strip | Compact horizontal band, current campaign's stars only | Full width, 56px tall |
| Quest workspace | The active form | Flexible column, capped max-width |
| Capability rack | Tool state list (§4) | Fixed-width column |

**At 1920px:** `grid-template-columns: minmax(680px, 760px) 320px;` centered, with side margins absorbing extra width. Workspace never grows past 760px — long line lengths hurt readability.

**At 1280px:** `grid-template-columns: 1fr 280px;` workspace flexes down to a 560px minimum, rack fixed at 280px.

**Breakpoint at 900px (mobile fallback):** single column. Order: constellation strip (shrinks to one row, horizontal scroll) → quest workspace → capability rack. The rack collapses into a closed drawer, opened by a small badge in the header showing a live count ("3 tools ready"). Tapping it slides the drawer up from the bottom, 260ms.

Header height stays 56px at every breakpoint. Nothing in the header ever wraps to two lines.

## 4. Capability rack — visual states

Five states. Each state has fixed copy and timing so the component reads the same on every quest type.

| State | Visual | Copy | Timing |
|---|---|---|---|
| Available | Solid card, icon, one-line description | `find-quests — matches quests to your time and skills` | Static, no animation |
| Newly appeared | Slides in from the right, brief highlight ring, "New" tag | `New: submit-contribution is ready` | Slide+fade in 240ms ease-out; highlight pulses twice at 600ms each, then settles |
| Removed | Fades and collapses height, then leaves the list | `check-contribution is no longer needed` (shown for 1.5s before removal) | Fade 200ms ease-in, height collapse 260ms, sequential not parallel |
| Executing | Card dims slightly, spinner replaces icon, label changes | `Running check-contribution…` | Spinner loop 1200ms per rotation, no easing (linear) |
| Blocked | Greyed card, lock icon, no highlight | `Locked — submit unlocks after check-contribution passes` | Static, no animation |

**Reduced motion:** disable slide and pulse entirely. State changes become an instant opacity/color swap, capped at 120ms if any transition is used at all. The spinner becomes a static "Running…" label with no rotating icon. Removal skips the collapse animation and disappears on the next state read.

## 5. Constellation

One shared sky. Each campaign (a batch of related quests — one town's missing wheelchair tags, one guide's paragraphs) is its own constellation inside that sky.

**Stars per campaign:** 6 to 14, one star per quest slot in the campaign. Fewer than 6 reads as empty. More than 14 is unreadable at 1080p in a recording.

**Unlit state:** open circle, 4px radius, low-opacity stroke, no fill.
**Lit state:** filled circle, 6px radius, soft glow (SVG `feGaussianBlur`, blur radius 8px).

**Lighting a star:** a peer approval in the review queue triggers the transition. The volunteer's tab (open in a separate tab or window) updates live via a `BroadcastChannel` message, not a page reload.

**Showing "who" without ranking:** hover or tap on a lit star reveals one line: `Verified by Priya. Reviewed by Tom.` First names only, no totals, no per-person star count anywhere in the UI. This is the social-translucence move — visibility and accountability, no comparison. (Erickson & Kellogg, 2000)

**SVG approach:** star positions are precomputed once per campaign from a seeded pseudo-random scatter (seed = campaign id), so the shape is stable across reloads. Connecting lines are the edges of a minimum spanning tree over the star positions — drawn faint, always present once two adjacent stars are lit. Pure SVG: `<circle>` for stars, `<path>` for connectors, CSS classes toggle lit/unlit, no charting library.

**Sizing:** strip view (header) 56px tall, full constellation view up to 720px max-width viewBox, scales down proportionally on mobile.

**Animation:** lighting a star is one transition, capped at 500ms (`scale 0.6→1, opacity 0→1, ease-out`). The connecting line to its nearest lit neighbor draws in over 400ms, starting after the star settles. Total sequence stays under 600ms.

**Reduced motion:** skip the scale/opacity tween and the line draw. Set the star to its final lit state directly, optionally with a single 150ms fade.

## 6. Human confirmation UI for submit

**Modal, not inline.** Submission is rare, consequential, and goes to a real human reviewer — it earns an interruption. An inline bar would blend into routine form activity; this moment needs to read as distinct on camera and to the volunteer. (Aligns with Apple's generative-AI guidance to keep the human as the deciding party for consequential actions, and Microsoft HAX's guidance to make consequences of an action clear before it happens — see §12.)

**Copy:**

- Title: `Send this to a reviewer?`
- Body: `A person will check your answer before it's used. You can still edit it after sending if it's sent back.`
- Primary button: `Send for review`
- Secondary button: `Keep editing`

**Focus order:** modal opens with focus on the title (`role="dialog"`, `aria-labelledby` pointing to it). Tab order: title (announced, not focusable) → `Keep editing` → `Send for review`. Focus returns to the field the volunteer last edited if they cancel.

**Keyboard:** `Esc` closes and equals `Keep editing`. `Enter` on the focused button activates it. Focus is trapped inside the modal while open. No action fires on `Enter` from a background field — only from a focused button.

## 7. Workspace per quest type

| Field / element | `verify-hours` | `access-photo` | `plain-rewrite` |
|---|---|---|---|
| Read-only context | Place name, address, current OSM `opening_hours` value if any (often blank) | Place name, address, map thumbnail | Source paragraph, read-only scroll box |
| Main input | Text field for the new `opening_hours` string | Photo upload/camera control | Multi-line textarea for the rewrite |
| Helper controls | Preset buttons: `Weekdays`, `Weekends`, `24/7`, `Closed public holidays` — each inserts valid syntax | Access select: `Yes` / `No` / `Partial` / `Can't tell` | Live reading-level meter (Flesch–Kincaid grade estimate), updates as the volunteer types |
| Helper copy | `Use HH:MM, not H:MM. Example: Mo-Fr 08:00-17:00. A comma splits a lunch break; a semicolon splits a different day.` | `Step-free means no stairs, no high curb, and a door wide enough for a wheelchair. If you're not sure, pick "Can't tell."` | `Aim for grade 8 or lower. Short sentences. Common words. One idea per sentence.` |
| Validation shown by `check-contribution` | Rejects malformed syntax with the exact bad token highlighted (per OSM `opening_hours` grammar) | Rejects a missing photo or a missing access answer | Rejects a rewrite above the target grade level or empty textarea |

OSM `opening_hours` syntax reference, verified: `Mo-Fr 08:00-17:00` for weekdays; commas split intervals in one day (`08:00-12:00,13:00-17:30`); semicolons split day groups; `off` marks a closure (`Tu off`, `PH off`); `24/7` for always open. ([OpenStreetMap wiki, Key:opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours))

## 8. Visual system

**Typography:** Inter (variable font, Google Fonts), fallback stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Use the variable axis for weight, not separate font files.

| Role | Size | Weight |
|---|---|---|
| Page title | 28px | 600 |
| Section heading | 20px | 600 |
| Body | 16px | 400 |
| Helper / caption | 14px | 400 |
| Button label | 15px | 500 |

**Color tokens.** Contrast ratios computed against the token's typical background (WCAG 2.2 relative-luminance formula), all meet or exceed AA (4.5:1 text, 3:1 UI components).

| Token | Light hex | Dark hex | Role | Contrast (light / dark) |
|---|---|---|---|---|
| `--bg` | #F7F7F5 | #121212 | Page background | — |
| `--surface` | #FFFFFF | #1B1B1B | Cards, rack items | — |
| `--text` | #1A1A18 | #EDEDEA | Body text | 16.2:1 / 16.1:1 |
| `--text-muted` | #5B5B57 | #B7B7B2 | Helper text, captions | 6.4:1 / 9.4:1 |
| `--border` | #DDDDD8 | #333331 | Card and input borders | — |
| `--accent` | #2F6F4F | #6FCF97 | Primary buttons, lit-star fill link | 6.0:1 / 10.0:1 |
| `--accent-info` | #2A5C99 | #7FB2F0 | Capability-rack "available" accent | 6.8:1 / 8.6:1 |
| `--warning` | #B45309 | #F2B84B | Blocked state | 5.0:1 / 10.6:1 |
| `--danger` | #B3261E | #F2867A | Errors | 6.5:1 / 7.6:1 |
| `--star-unlit` | #C7C7C2 | #3A3A38 | Unlit star stroke | — |
| `--star-lit` | #FFD166 | #FFD166 | Lit star fill and glow | decorative, not used for text |

**Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64.

**Radius:** small 6px (inputs), medium 10px (cards), large 16px (modal), pill 999px (chips, badges).

**Shadow:** one level only. Light: `0 1px 2px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04)`. Dark: skip shadow, use a 1px `--border` instead — shadows barely register on dark backgrounds.

## 9. Motion

| Moves | Never moves |
|---|---|
| Capability rack items on appear/remove/execute | Layout while typing in any field |
| Star lighting and connector drawing | Quest list order, except by explicit filter change |
| Confirmation modal open/close | Anything decorative or idle (no ambient background animation) |
| Live cross-tab update highlight (brief background flash on the field that changed) | The header height or grid columns |

**Durations:** rack transitions 200–260ms, star lighting ≤500ms, modal open/close 200ms, cross-tab flash 400ms.
**Easing:** `ease-out` for things appearing, `ease-in` for things leaving, `linear` only for the executing spinner.
**`prefers-reduced-motion: reduce`:** every duration above collapses to 0–120ms crossfades or none. No looping animation survives — the spinner becomes static text, the pulse becomes a single color change.

## 10. Copy and tone

1. State what happened, not how good it is. No "Amazing work!"
2. Name the real place or document, never "your quest."
3. Buttons are verbs: `Check`, `Submit`, `Approve`, not `Go` or `Next`.
4. Never claim certainty about quality. Say "submitted for review," not "verified."
5. No urgency or scarcity language. No "Hurry!" or "Only 2 left."
6. Errors state the fact and the fix, in that order, never blame.
7. Sentences stay under 20 words. One idea per sentence. Same term every time: "quest," never "task" or "mission."
8. No exclamation points in system copy. Enthusiasm is the volunteer's, not the app's.

**Examples:**

| Context | Copy |
|---|---|
| Empty quest list | `No quests match right now. Try widening your time window.` |
| Empty constellation | `This campaign has no lit stars yet. Be the first.` |
| Validation error | `08:00 needs a closing time. Example: 08:00-17:00.` |
| Submit success | `Sent to a reviewer. You'll see it here when it's checked.` |
| Approval (volunteer's tab) | `Priya's photo of Elm Street Library was approved. A star lit up.` |

## 11. Accessibility checklist

1. Visible focus ring on every interactive element, 2px minimum, never removed with `outline: none` alone.
2. Every form input has a programmatic `<label>`, not placeholder-only text.
3. Capability-rack state changes announce via `aria-live="polite"` (appear, remove, blocked); avoid `assertive` except for a blocking form error.
4. Star lighting on the volunteer's tab announces via a polite live region: "A star lit up for [place]."
5. Lit/unlit and available/blocked states never rely on color alone — pair with icon and text.
6. Touch targets minimum 44×44px, including capability-rack cards and star hit areas.
7. Capability rack items are keyboard-focusable even when not clickable, so screen-reader users can read their state.
8. Modal traps focus, restores it on close, and is dismissible with `Esc` (§6).
9. Form validation errors link to their field with `aria-describedby`.
10. Reviewer-queue new items announce via a live region in the reviewer tab.
11. Tooltips and helper text trigger on focus, not hover-only.
12. Respect `prefers-reduced-motion` globally — one media query, not per-component overrides that can drift out of sync.

## 12. Design references

| # | Reference | What we borrow |
|---|---|---|
| 1 | Ryan & Deci, 2000. "Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being." [PDF](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf) | Autonomy, competence, relatedness — task choice over points. |
| 2 | Morschheuser, Hamari & Maedche, 2019. "Cooperation or Competition — When Do People Contribute More?" [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1071581918305822) | Honest caveat: competition can out-produce cooperation. No-leaderboards is an ethical choice, not a proven performance win. |
| 3 | Nicholson, 2015. "A RECIPE for Meaningful Gamification." [Preprint](https://scottnicholson.com/pubs/recipepreprint.pdf) | Reflection, choice, information, play, exposition, engagement — the frame for the whole reward system. |
| 4 | Bogost, 2011. "Gamification Is Bullshit." [Essay](https://bogost.com/writing/blog/gamification_is_bullshit/) | The hostile-review test: if the constellation just dresses up unpaid labor, cut it. |
| 5 | Kivetz, Urminsky & Zheng, 2006. "The Goal-Gradient Hypothesis Resurrected." [Study](https://journals.sagepub.com/doi/10.1509/jmkr.43.1.39) | One bounded, honest step of progress — never a fake prefilled bar. |
| 6 | Erickson & Kellogg, 2000. "Social Translucence." [ACM DOI](https://doi.org/10.1145/344949.345004) | Visibility, awareness, accountability without ranking — the basis for the constellation's "who" disclosure. |
| 7 | Hodent, 2016. "The Gamer's Brain, Part 2: UX of Onboarding and Player Engagement." [GDC session](https://gdcvault.com/play/1022951/The-Gamer-s-Brain-Part) | One task immediately, one mechanic at a time — first contribution before 20 minutes. |
| 8 | Cox et al., 2015. "Defining and Measuring Success in Online Citizen Science: A Case Study of Zooniverse Projects." [Paper](https://eprints.whiterose.ac.uk/id/eprint/86535/) | Measure accepted useful work, not stars lit or accounts made. |
| 9 | Porto de Albuquerque, Herfort & Eckle, 2016. "The Tasks of the Crowd." [MDPI](https://www.mdpi.com/2072-4292/8/10/859) | Task typologies and skill matching from Missing Maps — quests filtered by skill, not one-size-fits-all. |
| 10 | Xie, Yu, Cui, Lee, Carroll & Billah, 2023. "Are Two Heads Better than One? Investigating Remote Sighted Assistance with Paired Volunteers." [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11699856/) | Be My Eyes-style fast matching on an objective microtask; also warns that adding collaborators adds coordination cost. |
| 11 | teamLab, "Forest of Resonating Lamps." [Designboom coverage](https://www.designboom.com/art/teamlab-forest-of-resonating-lamps-maison-et-objet-paris-09-05-2016/) | Lighting one lamp spreads light along a fixed connected path to its neighbors — the model for the constellation's connector lines. |
| 12 | Hashemi & LaPorte (Hatnote), "Listen to Wikipedia." [Project site](https://listen.hatnote.com/) / [Wikipedia entry](https://en.wikipedia.org/wiki/Listen_to_Wikipedia) | Many small individual edits shown as light and sound in real time, color-coded by contributor type, with no ranking or count of who did most. |
| 13 | GOV.UK Design System, accessibility strategy and component library. [Site](https://design-system.service.gov.uk/accessibility/accessibility-strategy/) | WCAG 2.2 AA baseline, component-level accessibility guidance. (Equivalent: [U.S. Web Design System](https://designsystem.digital.gov/documentation/accessibility/), same role.) |
| 14 | Google PAIR, "People + AI Guidebook." [Site](https://pair.withgoogle.com/guidebook/) | Feedback + control pattern — the volunteer sees and can act on what the agent found before anything is sent. |
| 15 | Microsoft Research, "HAX Toolkit — Guidelines for Human-AI Interaction." [Site](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) | Convey consequences before a consequential action; support efficient correction — basis for the submit confirmation modal (§6). |

No reference above is marked UNVERIFIED — each URL was fetched or returned in a live search result during this drafting session.

## 13. Anti-patterns to avoid

1. Fake or prefilled progress bars that imply work already done.
2. Leaderboards, rankings, or any "top contributor" display.
3. Points, badges, or streaks with no connection to real outcomes.
4. Confetti, fireworks, or celebratory animation on routine actions.
5. AI-slop gradients, glassmorphism, or generic glowing-orb decoration with no functional meaning.
6. Dark patterns: forced continuity, disguised ads, confirm-shaming copy ("No thanks, I don't want to help").
7. Auto-submitting anything the agent prepared without a human confirmation step.
8. Claiming verification quality ("Verified!", "100% accurate") the app cannot back up.
---

# Part D — Quest Content and Data


## 1. Why Real Data Gaps Beat a Seeded Organization

A fake nonprofit produces fake trust. Volunteers can check a real OSM node against the real world, so the work is falsifiable and honest. Real gaps also never run out, since OpenStreetMap has millions of untagged `wheelchair` and `opening_hours` values worldwide.

## 2. OSM Tagging Facts

### `wheelchair` semantics

| Value | Meaning | Practical test |
|---|---|---|
| `yes` | Full unrestricted access. Stepless entry and stepless rooms. | No steps, or a ramp/lift covers them. |
| `limited` | Partial access. Some areas reachable, others not. | Entry step up to 7 cm (3 in), or assistance needed. |
| `no` | No unrestricted access. Stair-only entry. | Entry step over 7 cm, or stairs only. |
| `designated` | Built specifically for wheelchair users. | Rare. Example: a wheelchair-only lift. |

Source: [OSM Wiki, Key:wheelchair](https://wiki.openstreetmap.org/wiki/Key:wheelchair). A free-text `wheelchair:description` tag (and `wheelchair:description:en`, etc.) holds detail when yes/limited/no is not enough.

### `opening_hours` syntax

Full grammar: [Key:opening_hours/specification](https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification). Reference: [Key:opening_hours](https://wiki.openstreetmap.org/wiki/Key:opening_hours).

5 valid examples:

```
Mo-Fr 08:00-17:00
Mo-Fr 08:00-12:00,13:00-17:30; Sa 08:00-12:00
Mo-Su 00:00-24:00; Aug off
sunrise-sunset
24/7
```

3 invalid examples, and why:

| Invalid | Problem |
|---|---|
| `7/8-23` | Not a real weekday code. Must spell days as `Mo`-`Su`. |
| `10:00 - 13:30 / 17:00` | Wrong separator. Use commas between time ranges, not slashes. |
| `Mo 20:00-02:00; Tu off` | Midnight crossing needs a comma split, not a semicolon override. |

### Amenity types that matter most for accessibility

| Type | Why it matters |
|---|---|
| `pharmacy` | Frequent, urgent visits. Often has steps at entry. |
| `clinic` / `doctors` | Health visits. Access failure blocks care. |
| `library` | Public service, long visits, often older buildings. |
| `community_centre` | Hosts public meetings and services. |
| `cafe` | High density, good practice quests, low stakes. |
| `toilets` | Direct accessibility need, binary and checkable. |
| `bank` / `post_office` | Essential errands, frequent visits. |

### `check_date` for verification

`check_date=YYYY-MM-DD` records when an object was last field-checked. A tag-scoped form works too: `check_date:opening_hours=2026-05-13`. `survey:date` is an accepted older alternative. Source: [OSM Wiki, Key:check_date](https://wiki.openstreetmap.org/wiki/Key:check_date). Quest submits `check_date:opening_hours` for `verify-hours` and `check_date:wheelchair` for `access-photo`.

## 3. Overpass API

### (a) Places missing `wheelchair`, within 1000 m of a point

```
[out:json][timeout:25];
nwr(around:1000,12.9716,77.5946)
  ["amenity"~"^(pharmacy|clinic|library|community_centre|cafe|toilets|bank|post_office)$"]
  ["name"]
  ["wheelchair"!~"."];
out center tags;
```

### (b) Places missing `opening_hours`, within 1000 m of a point

```
[out:json][timeout:25];
nwr(around:1000,12.9716,77.5946)
  ["amenity"~"^(pharmacy|clinic|library|community_centre|cafe|toilets|bank|post_office)$"]
  ["name"]
  ["opening_hours"!~"."];
out center tags;
```

`nwr` searches nodes, ways, and relations in one statement. `["wheelchair"!~"."]` matches any value of the empty string, so it only passes elements that lack the key entirely. Both queries were run live against the public endpoint on 2026-09-01 and returned 92 and 94 results respectively for central Bengaluru (see Section 13).

**Endpoint**: `https://overpass-api.de/api/interpreter` (public instance). Source: [OSM Wiki, Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).

**Fair use**: light users stay under 10,000 queries/day and 1 GB/day. A regular app should target roughly 100 queries and 10 MB per day. On HTTP 429/406, wait 30 seconds before retrying. Send a `User-Agent` and `Referer` identifying the app.

**Caching plan**:

| Layer | Rule |
|---|---|
| Client cache | Round lat/lon to 3 decimals (~110 m). Cache the response in `localStorage` for 24 h. |
| Fallback | Ship one pre-fetched JSON file for the demo city, loaded when Overpass is unreachable or rate-limited. |
| Refresh | Re-query only when the cache is missing, expired, or the user moves more than ~500 m. |

## 4. Mapping an Overpass Element to a Quest Object

| Field | Source | Notes |
|---|---|---|
| `id` | `type` + `id` from Overpass (e.g. `node/428457212`) | Stable, unique per OSM element. |
| `type` | Set by the query that found the gap | `verify-hours`, `access-photo`, or `plain-rewrite`. |
| `title` | Generated template + `tags.name` | e.g. "Confirm hours for {name}". |
| `place_name` | `tags.name` | Required. Elements without a name are excluded. |
| `address` | `addr:*` tags if present | Optional. Omit field if absent, do not guess. |
| `lat`, `lon` | Element `lat/lon`, or `center.lat/lon` for ways | Ways/relations use the `center` block from `out center`. |
| `estimated_minutes` | Heuristic table, Section 5 | Shown to volunteer before accept. |
| `required_skills` | Heuristic table, Section 5 | Used for agent matching. |
| `language` | Locale of the volunteer pool, not the OSM data | Task instructions are localized, not the source tag. |
| `task_accessibility` | Manual per quest type | Can a volunteer with low vision or limited mobility do this remotely? |
| `source_tags` | Full `tags` object from Overpass | Kept for audit and for the OSM export. |
| `osm_link` | `https://www.openstreetmap.org/{type}/{id}` | Deep link for the reviewer and the volunteer. |

### Example: `verify-hours`

```json
{
  "id": "quest_vh_node428457212",
  "type": "verify-hours",
  "title": "Confirm hours for Old Madras Baking Company",
  "place_name": "Old Madras Baking Company",
  "address": {
    "street": "Saint Mark's Road",
    "city": "Bangalore",
    "postcode": "560001"
  },
  "lat": 12.9697383,
  "lon": 77.6003775,
  "estimated_minutes": 5,
  "required_skills": ["phone-call"],
  "language": "en",
  "task_accessibility": "phone-based, no travel required",
  "source_tags": { "amenity": "cafe", "name": "Old Madras Baking Company" },
  "osm_link": "https://www.openstreetmap.org/node/428457212"
}
```

### Example: `access-photo`

```json
{
  "id": "quest_ap_node901234567",
  "type": "access-photo",
  "title": "Photograph the entrance of City Library, Shivajinagar",
  "place_name": "City Library, Shivajinagar",
  "address": { "street": "Cubbon Road", "city": "Bangalore" },
  "lat": 12.9784,
  "lon": 77.5917,
  "estimated_minutes": 10,
  "required_skills": ["in-person-visit", "smartphone-camera"],
  "language": "en",
  "task_accessibility": "requires physical presence at the site",
  "source_tags": { "amenity": "library", "name": "City Library, Shivajinagar" },
  "osm_link": "https://www.openstreetmap.org/node/901234567"
}
```

### Example: `plain-rewrite`

```json
{
  "id": "quest_pr_seed004",
  "type": "plain-rewrite",
  "title": "Rewrite: how to claim PIP",
  "place_name": null,
  "address": null,
  "lat": null,
  "lon": null,
  "estimated_minutes": 15,
  "required_skills": ["plain-language-writing"],
  "language": "en",
  "task_accessibility": "fully remote, text only",
  "source_tags": {
    "source_url": "https://www.gov.uk/pip/how-to-claim",
    "license": "Open Government Licence v3.0"
  },
  "osm_link": null
}
```

## 5. Estimating Minutes and Skills

| Quest type | Minutes | Basis | Required skills |
|---|---|---|---|
| `verify-hours` (phone) | 5 | One short call plus data entry. | Phone call, local language. |
| `verify-hours` (website check) | 3 | Search and read one page. | Web search, reading. |
| `verify-hours` (in-person) | 10–20 | Travel time not counted; add if the volunteer must go there. | Local presence. |
| `access-photo` | 10 | Travel to entrance, one photo, one tag choice. | Smartphone, local presence. |
| `plain-rewrite` | 15 | One paragraph, ~150–250 words, one rewrite pass. | Plain-language writing. |

These are estimates, not guarantees. The UI should say "about N minutes," not promise an exact time. Travel time is excluded because it depends on the volunteer's own location, which the app does not always know in advance.

## 6. The `plain-rewrite` Seed Corpus

| # | Source | URL | License | Why it needs rewriting |
|---|---|---|---|---|
| 1 | USA.gov, Food help | [usa.gov/food-help](https://www.usa.gov/food-help) | Public domain (US federal work) | Card layout hides eligibility steps; needs one plain summary paragraph. |
| 2 | USA.gov, Social Security disability | [usa.gov/social-security-disability](https://www.usa.gov/social-security-disability) | Public domain (US federal work) | Uses "SSDI"/"SSI" jargon and legal qualifiers without plain definitions. |
| 3 | GOV.UK, PIP: how to claim | [gov.uk/pip/how-to-claim](https://www.gov.uk/pip/how-to-claim) | Open Government Licence v3.0 | Branching instructions by nation and by life stage, dense for a first read. |
| 4 | GOV.UK, Healthy Start | [gov.uk/healthy-start](https://www.gov.uk/healthy-start) | Open Government Licence v3.0 | Eligibility rules and an under-18 exception need a plain if/then rewrite. |
| 5 | WHO, Disability and health fact sheet | [who.int/.../disability-and-health](https://www.who.int/news-room/fact-sheets/detail/disability-and-health) | CC BY-NC-SA 3.0 IGO (WHO's standard fact-sheet licence — UNVERIFIED on this exact page, no licence line was visible in the fetched excerpt) | Long clause-heavy sentences ("results from the interaction between..."). |
| 6 | WHO, Assistive technology fact sheet | [who.int/.../assistive-technology](https://www.who.int/news-room/fact-sheets/detail/assistive-technology) | CC BY-NC-SA 3.0 IGO (UNVERIFIED on this exact page, same reason as #5) | Abstract phrasing ("umbrella term," "related systems and services"). |
| 7 | CDC, Disability and health | [cdc.gov/disability-and-health](https://www.cdc.gov/disability-and-health/index.html) | Public domain (US federal work). Confirmed by CDC's general copyright policy at [stacks.cdc.gov/Content and Copyright](https://stacks.cdc.gov/Content%20and%20Copyright). Exact paragraph text is UNVERIFIED — the live page blocked automated fetch (HTTP 403). | Health-literacy pages often mix clinical and lay terms; good rewrite practice. |
| 8 | Wikipedia, "Accessibility" | [en.wikipedia.org/wiki/Accessibility](https://en.wikipedia.org/wiki/Accessibility) | CC BY-SA 4.0 (new edits); requires attribution to authors or a link back | Definitional sentences ("ability to access... benefit from some system") read as abstract, not concrete. |

Note on city open-data pages: standard city government websites (checked: NYC.gov) carry a normal copyright notice, not an open licence, even when they publish public services content. UNVERIFIED whether any city explicitly licenses its help pages for reuse; do not use a city page for the seed corpus unless its footer states an open licence. Use federal (USA.gov, CDC) or Crown-copyright (GOV.UK OGL) sources instead — both are confirmed open.

## 7. Plain-Language Criteria (Checker Rules)

| Test | Rule | How to compute |
|---|---|---|
| Sentence length | Average ≤ 20 words per sentence | Split on `.!?`, count words, average. |
| Passive voice | Flag likely passive constructions | Regex: an auxiliary (`is\|are\|was\|were\|be\|been\|being`) followed by a past participle (`\w+ed\b` or an irregular-participle list). |
| Reading grade | Flesch-Kincaid Grade Level ≤ 8 | `0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59` |
| Jargon | No banned words remain | Case-insensitive match against the list below; each has a plain replacement. |
| Facts preserved | All numbers and proper names from the source appear in the rewrite | Extract numbers (regex `\d[\d,.]*`) and capitalized multi-word spans from both texts; take a set difference; empty diff passes. |

Banned jargon list (30 words → plain replacement):

| Jargon | Plain |
|---|---|
| utilize | use |
| facilitate | help |
| individual | person |
| eligibility | who qualifies |
| pursuant to | under |
| in the event that | if |
| prior to | before |
| subsequent to | after |
| terminate | end |
| commence | start |
| ascertain | find out |
| endeavor | try |
| in accordance with | following |
| notwithstanding | even so |
| aforementioned | this / that |
| in order to | to |
| approximately | about |
| provision | rule / help |
| constitute | count as / make up |
| stipulate | require |
| disseminate | share |
| implement | carry out |
| methodology | method |
| optimal | best |
| sufficient | enough |
| requisite | needed |
| remuneration | pay |
| residence | home |
| transmit | send |
| interaction between | how X and Y affect each other |

## 8. Contribution Validation Rules

| Quest type | Field | Rule | Error string |
|---|---|---|---|
| `verify-hours` | `opening_hours` | Must parse as valid OSM syntax | `"opening_hours: could not parse. Use format like 'Mo-Fr 08:00-17:00'."` |
| `verify-hours` | `verified_by` | Must be one of `phone`, `visit`, `website` | `"verified_by: choose phone, visit, or website."` |
| `verify-hours` | `source_note` | ≥ 10 characters | `"source_note: add at least 10 characters describing how you checked."` |
| `access-photo` | `photo` | File present | `"photo: attach a photo of the entrance."` |
| `access-photo` | `photo` | ≤ 5 MB | `"photo: file too large. Max 5 MB."` |
| `access-photo` | `wheelchair` | One of `yes`, `limited`, `no` | `"wheelchair: choose yes, limited, or no."` |
| `access-photo` | `note` | Required when `wheelchair=limited` | `"note: explain what is limited about access."` |
| `plain-rewrite` | rewrite text | Passes all Section 7 checks | `"rewrite: average sentence length over 20 words."` / `"rewrite: reading grade above 8."` / `"rewrite: contains jargon word '{word}'."` / `"rewrite: missing number or name '{value}' from the source."` |

For `opening_hours` grammar checking, use the [`opening_hours` npm package](https://www.npmjs.com/package/opening_hours) (current version 3.14.0, maintained at [github.com/opening-hours/opening_hours.js](https://github.com/opening-hours/opening_hours.js)). It parses and validates the full OSM `opening_hours` grammar. If it is unavailable in the build target, fall back to a regex subset covering day codes, `HH:MM-HH:MM` ranges, and the `24/7` literal — this subset will reject valid but complex strings (e.g. `PH off`), so prefer the library.

## 9. What Happens After Approval

The honest v1 answer: Quest does not write to OSM automatically. An automated edit bot without a human OSM account and without following the [OSM Automated Edits code of conduct](https://wiki.openstreetmap.org/wiki/Automated_Edits_code_of_conduct) risks a ban and bad data. Two paths exist for pushing an approved contribution into OSM, both requiring a human:

| Path | Who | Risk |
|---|---|---|
| Manual edit via iD editor | A reviewer with their own OSM account, editing the node directly | Standard OSM edit. Reviewer is responsible for correctness. |
| OSM Notes API | A reviewer, via `POST /api/0.6/notes` | Low risk. A note does not change the map; it flags the node for any mapper to check. |

`POST /api/0.6/notes` accepts `lat`, `lon`, and `text` as parameters. Creating a note does **not** require authentication, per the [OSM Wiki, Notes](https://wiki.openstreetmap.org/wiki/Notes) page — but posting anonymously means no email notification and less traceability. Exact authentication requirements for the API path specifically (as opposed to the website form) are UNVERIFIED against the raw API docs; treat "no login needed" as likely but confirm before relying on it in production. Notes are explicitly not auto-applied: OSM guidance states edits "should not be made based only on notes."

**What Quest v1 actually does**: stores approved contributions in its own database, tied to the source OSM element id, and offers a **"copy for OSM"** export — a formatted note (`wheelchair=limited, checked in person, see note`) or a tag suggestion the reviewer can paste into iD or a new Note. No auto-edit of the live OSM database in this build.

## 10. Review Policy

One reviewer role exists. A reviewer checks each submission against a 5-item checklist before approving.

| Quest type | 5-item checklist |
|---|---|
| `verify-hours` | 1. `opening_hours` string is valid syntax. 2. `verified_by` matches a plausible method. 3. `source_note` is specific, not generic. 4. No contact info or personal data leaked into notes. 5. Value is plausible for that amenity type. |
| `access-photo` | 1. Photo shows the entrance, not an unrelated scene. 2. No visible faces or license plates. 3. `wheelchair` value matches what the photo shows. 4. `note` present and useful if `limited`. 5. Photo location roughly matches the quest's coordinates. |
| `plain-rewrite` | 1. All Section 7 automated checks pass. 2. Meaning matches the source paragraph. 3. No new claims added. 4. Tone stays neutral, not preachy. 5. Reads naturally, not like a word-swapped original. |

One approval lights one star for the volunteer; there is no multi-approval threshold in v1. A rejection returns to the volunteer with the specific failed checklist item as the reason, plus one sentence on how to fix it. The volunteer may resubmit once.

## 11. Prior Art in Micro-Volunteering

| Platform | What we borrow | Source |
|---|---|---|
| Zooniverse | Break large work into short, single-question tasks; show each item to more than one volunteer. | [zooniverse.org](https://www.zooniverse.org/) |
| Missing Maps / HOT Tasking Manager | Split a large area into discrete, independently completable task squares. | [missingmaps.org/hot-tasking-manager](https://missingmaps.org/hot-tasking-manager/) |
| Be My Eyes | Match the request to the first available, right-language volunteer in seconds, not hours. | [bemyeyes.com](https://www.bemyeyes.com/) |
| Wheelmap | Use the exact same OSM `wheelchair=yes/limited/no` scale, and write submissions back into OSM. This is Quest's closest prior art — Wheelmap is built directly on OSM data and tags. | [wheelmap.org FAQ](https://news.wheelmap.org/en/faq/), [OSM Wiki, Wheelmap](https://wiki.openstreetmap.org/wiki/Wheelmap) |
| Folding@home | Split one big problem into small independent units any volunteer's device can complete alone. | [foldingathome.org/faq/how-it-works](https://foldingathome.org/faq/how-it-works) |
| Mapillary | Automatically blur faces and plates before any human sees the image; never store the unblurred original. | [blog.mapillary.com, privacy blurring](https://blog.mapillary.com/news/2020/08/31/imagery-privacy-blurring.html) |

## 12. Ethics and Safety

| Concern | Rule |
|---|---|
| Volunteer safety | Never send a volunteer to a place flagged unsafe, closed, or under active incident. Skip `access-photo` quests at night-only or high-crime-flagged locations (manual exclusion list). |
| Personal data | Contributions must not contain names, phone numbers, or addresses of private individuals. Reviewer checklist enforces this. |
| Photo privacy | No faces or license plates in submitted photos. Guidance text tells the volunteer to frame only the entrance. Blur any face caught by accident before storage. |
| Phone verification consent | The volunteer, not the app, places the call. The volunteer must identify themselves as a member of the public, not as an official inspector. |
| Contribution license | The volunteer agrees, at submission time, that their contribution may be published under ODbL-compatible terms if it goes to OSM. Consent is explicit, not implied — a checkbox, not a buried clause. |

## 13. Seed Data for the Demo City

Recommendation: **Bengaluru** (center point `12.9716, 77.5946`), for IST-timezone convenience and OSM data density. Confirmed live by running the Section 3 queries against the public Overpass endpoint on 2026-09-01.

```
[out:json][timeout:25];
nwr(around:1000,12.9716,77.5946)
  ["amenity"~"^(pharmacy|clinic|library|community_centre|cafe|toilets|bank|post_office)$"]
  ["name"];
out center tags;
```

| Result | Count |
|---|---|
| Total named amenities in the set, within 1000 m | 98 |
| Missing `wheelchair` | 92 |
| Missing `opening_hours` | 94 |
| Breakdown by type | cafe 33, bank 30, pharmacy 11, clinic 6, library 6, toilets 4, community_centre 4, post_office 4 |

Order of magnitude: **~100 candidate quests per 1 km radius**, with over 90% missing both target tags. This is enough for a demo without expanding the radius. Ship this exact result set as the pre-fetched fallback JSON described in Section 3.
---

# Part E — Build Order

Total engineering budget: about 9 hours. Then 3 hours for video and submission, covered in the demo document.

| Hour | Work | Done when |
|---|---|---|
| 0 to 1 | Scaffold Vite, React, TypeScript. Register one hello-world tool. Test in ChatGPT desktop browser, then Chrome with flag. | **Gate.** The agent calls the tool and reads the text. Test whether a 30 second `execute` survives. If the gate fails, switch to vanilla JS and retest inside the hour. |
| 1 to 2 | Types. Seed quests. Fallback Overpass JSON. localStorage helpers. | Quest list renders from fallback data. |
| 2 to 3 | Overpass fetch, cache, mapping. Merge with seeds. | Live quests for central Bengaluru appear. Offline still works. |
| 3 to 4 | `find-quests`. Quest list UI. Capability rack skeleton. | Agent returns a ranked list. Rack shows one tool. |
| 4 to 5 | Three workspace forms. Validators. `check-contribution`. | Agent gets actionable errors, then a pass. Rack shows two tools. |
| 5 to 6 | `submit-contribution` with modal await. State machine wiring. | Rack shows three tools after a pass. Submit waits for the click. |
| 6 to 7 | Reviewer tab. `approve-contribution`. BroadcastChannel. Constellation SVG and star animation. | Approval in tab two lights a star in tab one. |
| 7 to 8 | Rack animation. Feature detection banner. Security pass. Dark mode. Reduced motion. | Part C sections 4, 8, 9, 11 checked. |
| 8 to 9 | Deploy. Run Part B section 14 checklist on the live URL. Fix what breaks. | All eight items pass. |

Freeze the code after hour 9. Only fix blockers after that.

---

# Appendix — References

All references are collected in Part C section 12 and Part D sections 2, 8, 9, and 11. Research that led to this spec is in `Research Docs/`.
