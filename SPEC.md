# Quest Spec v2 — Gatherlight Cross-Site Civic Workflows

## Summary

Quest becomes an open grammar for human-led civic work:

> One browser agent coordinates the logistics across sites. People gather evidence, confirm consequential actions, review submissions, and own every public edit.

The primary product is `@gatherlight/quest-tools`, with Quest as its reference implementation. The protocol keeps exactly five verbs: `find-quests`, `open-quest`, `check-contribution`, `submit-contribution`, and `approve-contribution`.

“One import” means one package plus five site-owned operations—not automatic conversion of arbitrary sites. Each adopter must connect the grammar to its real UI, authentication, validation, and data.

P0 proves:

- The package works across unrelated sites and frameworks.
- Quest coordinates workflow receipts without sharing credentials across origins.
- OSM and Wikidata provide two deep, real-data adapters.
- One agent can move through Quest → Survey (a partner site on a second origin) → an iD embed in one browser session.
- The OSM flow ends with a reviewed, conflict-checked edit staged in iD, not uploaded.
- Geographic and non-geographic work produce honest collective artifacts.
- Quest contributes implementation evidence to existing WebMCP standards discussions.

Live OSM Notes, direct OSM/Wikidata edits, and source-authenticated reviewer identity remain P1.

P0 order: package → tiny store → Survey partner site and cross-site loop → untrusted-content hygiene → standards evidence → iD embed → Wikidata. Each step ships on top of a working product.

WebMCP currently exposes page-owned tools and keeps the human interface primary, but cross-top-level-document discovery and native elicitation remain active design questions. Quest must work through sequential navigation today rather than pretending the package can call arbitrary tabs. [WebMCP explainer](https://github.com/webmachinelearning/webmcp), [cross-tab discovery issue](https://github.com/webmachinelearning/webmcp/issues/227), [elicitation issue](https://github.com/webmachinelearning/webmcp/issues/165).

## Product and Architecture

### Package and repository

- Replace `SPEC.md` with the authoritative v2 specification; Git preserves v1. `DESIGN.md` is authored directly and is the design source of truth. `PRODUCT.md` is removed; this Summary is the product statement.
- Keep the existing Vite app at the repository root and add an npm workspace at `packages/quest-tools`; do not reorganize the project into a larger monorepo.
- Publish the package as `@gatherlight/quest-tools`.
- Keep the package framework-neutral and dependency-light. Use `@mcp-b/webmcp-types` for WebMCP typings, not a custom browser API definition or mandatory polyfill.
- Export a headless controller plus optional accessible capability-rack and confirmation UI. React remains an app concern, not a package peer dependency.
- Refactor Quest itself to consume the published interface. No duplicated private tool registry remains in the app.

### Coordinator

Static frontends stay on GitHub Pages or Netlify. Cross-origin state needs one shared store, and nothing more. Use the smallest option that works: one Cloudflare Worker with KV, or one Supabase project with a single anonymous key. Pick by fewest lines.

The store holds exactly two entities:

- `contributions`: id, quest source reference and revision, opaque volunteer session id, payload, validation result, state, review decision, and the landed receipt (note, changeset, or revision id) once one exists.
- `handoffs`: hashed short-lived capability, target origin, permitted action, contribution id, expiry, and used flag.

Quests are derived from the source (Overpass, later SPARQL) on each client and are not stored. Campaigns and impact are derived from `contributions`. No workflow-event log, no reviewer table, no private evidence bucket: photos stay downscaled data URLs inside the contribution payload, as in v1.

Partner sites retain their own sessions, APIs, and final public data. No source access token is sent through Quest tool output, URLs, or another origin.

### Identity and trust

- Volunteers and reviewers are anonymous session ids generated in the browser. No profile, no recoverable score.
- Reject self-review: a contribution cannot be approved by the session that submitted it.
- Source-authenticated reviewer identity (OSM and Wikimedia OAuth) is P1. It arrives with write-back, where it is required.
- “One session” means one browser/agent session. Each origin keeps its own first-party state; Quest does not create cross-origin single sign-on.
- Validate every store write. Require an unexpired, unused, origin-matched handoff for any partner-site mutation.

## Public Contracts and Required Behavior

### Package interface

Expose one constructor:

```ts
createQuestTools({
  protocol: 'quest/1',
  operations: {
    find?,
    open?,
    check?,
    submit?,
    approve?,
  },
  available,
  confirm,
})
```

Each operation receives an `AbortSignal`. A site implements only the verbs it can perform. `available()` controls dynamic registration. The returned controller exposes the same operations to ordinary UI buttons, so UI and WebMCP always call identical functions.

The package registers only these tool names:

- `find-quests`
- `open-quest`
- `check-contribution`
- `submit-contribution`
- `approve-contribution`

All descriptions remain under 500 characters, names under 30, parameter descriptions under 150, and output under 1,500 characters.

Every tool returns text containing a compact stable envelope:

```ts
interface QuestToolResult {
  protocol: 'quest/1';
  ok: boolean;
  state:
    | 'available'
    | 'open'
    | 'invalid'
    | 'checked'
    | 'declined'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'stale'
    | 'landed';
  message: string;
  questId?: string;
  contributionId?: string;
  next?: { url: string; handoff: string };
}
```

External titles, source text, and API responses are untrusted content. Cap their lengths, escape them in UI, and set `untrustedContentHint`.

### State and safety rules

The canonical lifecycle is:

`available → open → checked → confirmed → submitted → approved/rejected → landed`

- Editing a checked draft returns it to `open`.
- `submit-contribution` is registered only after the current draft passes validation.
- The package revalidates immediately after confirmation and before submission.
- A changed source revision moves the contribution to `stale`; the system never silently overwrites newer public data.
- `approve-contribution` requires a submitted contribution, a different reviewer session, and the source-specific checklist.
- `landed` means the source accepted the public write. Approval alone never claims that the public dataset changed.
- No WebMCP argument accepts the volunteer’s substantive evidence. The person fills the visible site UI; the agent may only open, check, route, and submit it.

### Human confirmation

The default package UI uses an accessible native `<dialog>` and shows:

- The exact contribution summary.
- Destination and visibility.
- Applicable contribution license.
- Whether the action submits for review or writes publicly.
- Explicit Confirm and Keep Editing actions.

The tool waits up to 90 seconds, supports cancellation through `AbortSignal`, and permits one pending confirmation per page. Decline, timeout, cancellation, stale data, and validation failure produce distinct actionable results.

This remains a site-enforced gate, not a claimed browser security primitive. Publish runtime results and a minimal implementation in the existing WebMCP elicitation discussion. Also contribute the five-verb workflow evidence to the existing [skills proposal](https://github.com/webmachinelearning/webmcp/issues/161). Open a new standards issue only if maintainers request a narrower proposal.

### Cross-site handoff

- `open-quest` may return `next.url` and a short-lived opaque `handoff`.
- The agent navigates to that URL in the same browser session.
- The receiving origin exchanges the handoff for canonical workflow state.
- Handoffs are bound to one target origin and action, expire quickly, and cannot be reused for a mutation.
- Raw evidence, OAuth credentials, and source write tokens never travel in tool output.
- If the agent runtime cannot continue across navigation, stop with an actionable URL; do not add an extension, custom agent, or sixth tool as a compatibility layer.

### Adapter contracts

A source adapter must provide:

- Deterministic gap discovery and stable source identifiers.
- Source revision or equivalent conflict marker.
- A human contribution form.
- Structural validation and a human review policy.
- Licensing and attribution rules.
- Optional source write-back.
- One source-derived `ImpactMark`.

P0 adapters:

- **OSM:** Continue missing or stale `opening_hours` and `wheelchair` gaps. Capture the OSM element version when opened. Accessibility quests hand off to **Survey**, a purpose-built partner site on a second origin, written in vanilla TypeScript, that imports `@gatherlight/quest-tools`. Survey is the human's workspace for the visit: the volunteer records the wheelchair observation and photo there. Survey is not itself evidence, and it is not Wheelmap. Wheelmap and other real partners become adopters of the same package later.
- **Wikidata (P0-last):** Start with curated existing statements that lack references, not arbitrary missing properties. The human selects and evaluates a reliable source. Automated checks verify URL safety, availability, metadata, non-circular sourcing, and preserved claim identity; the reviewer decides whether the source supports the claim. Discovery uses reviewed SPARQL templates for statements without references. [Wikidata query guidance](https://www.wikidata.org/wiki/Wikidata%3ASPARQL_query_service/queries).

Do not proxy Common Voice or Zooniverse contributions through Quest. Treat them as future partner-site adapters only when their maintainers can preserve native consent, accounts, and contribution terms.

### Collective impact

Generalize “the sky” into adapter-owned collective artifacts:

```ts
type ImpactMark =
  | { kind: 'geo'; lat: number; lon: number; sourceRef: string }
  | { kind: 'knowledge-edge'; entityId: string; claimId: string; sourceUrl: string };
```

- OSM renders real coordinates in the civic sky.
- Wikidata renders real entity → claim → source relationships in a living knowledge graph.
- Approved-but-unlanded marks remain outlined.
- Landed marks become fully lit.
- The current contribution may pulse once for acknowledgement.
- No public or private karma, streak, rank, lifetime score, or transferable point exists.

## Delivery Layers

### P0: Protocol foundation

- Extract the five verbs, state machine, result envelope, confirmation gate, dynamic registration, cancellation, and optional UI into `@gatherlight/quest-tools`.
- Convert Quest’s UI and WebMCP tools to the package controller.
- Delete the v1-specific private registry and obsolete localStorage workflow rather than maintaining adapters around it.

### P0: Tiny store and the OSM adapter

- Add the two-entity store: `contributions` and `handoffs`. Handoff issue, exchange, expiry, single use.
- Preserve offline OSM discovery through the bundled fallback.
- Implement OSM end to end through approval, with no public write. Exact source-revision conflict check on approve.

### P0: Cross-site proof

1. Quest finds an accessibility gap and `open-quest` returns a Survey URL and handoff.
2. The agent navigates to Survey.
3. Survey exchanges the handoff, registers `check-contribution`, and shows the provenance strip. A person performs the visit and fills Survey's visible form.
4. The agent checks it; `submit-contribution` appears; the agent calls it; the person confirms in the dialog.
5. A different session approves in Quest. The star lights on Quest's sky.

### P0-last: iD embed

A page that embeds iD from its npm package, reads an approved handoff, reloads the OSM entity, checks its version against the captured one, and stages the exact tag diff in iD's undoable editor state. The reviewer sees the unsaved diff. P0 stops before upload. No fork, no upstream patch. Verify the embed API against iD's documentation before building. [iD integration API](https://github.com/openstreetmap/iD/blob/develop/API.md).

### P0-last: Wikidata

Second adapter and second collective artifact (the knowledge graph). Build only after the cross-site proof and iD embed are stable. The design system reserves the visual grammar for it.

### P0: WebMCP platform contribution

Publish:

- A framework-neutral confirmation implementation.
- Browser/runtime observations covering foregrounding, waiting, cancellation, timeout, and navigation.
- A cross-site civic workflow trace with the five tool contracts.
- Concrete requirements for native elicitation: visible origin, exact action preview, explicit user response, cancellation, concurrency handling, and cross-document continuity.

Contribute evidence to issues `#165`, `#161`, and `#227` instead of filing duplicates.

### P1: Accountable write-back

Reuse the same five verbs; do not add `land-contribution`.

- First add authenticated OSM Notes for individually reviewed, high-quality reports. Notes must communicate useful human evidence, never dump automated gaps. [OSM Notes guidance](https://wiki.openstreetmap.org/wiki/Notes/API_and_development).
- Then allow the source-site `submit-contribution` to upload one approved edit through the reviewer’s OAuth account after a fresh conflict check and confirmation.
- For OSM, store the reviewer in Quest’s receipt and rely on the OSM account/changeset for public attribution. Use standard `check_date:*`, `source`, and changeset metadata; never add a custom `reviewer=*` object tag. [OSM OAuth](https://wiki.openstreetmap.org/wiki/OAuth), [`check_date`](https://wiki.openstreetmap.org/wiki/Key%3Acheck_date).
- For Wikidata, write the reference through the reviewer’s Wikimedia account with the latest revision/claim checked immediately before the edit.
- Store the returned note, changeset, or revision ID in the impact receipt and then mark it `landed`.
- Never batch, background, or autonomously retry public edits. Discuss the live OSM workflow with the mapping community before enabling direct writes because individually reviewed tool-assisted edits can still fall under organized or mechanical-edit scrutiny. [OSM automated-edit policy](https://wiki.openstreetmap.org/wiki/Automated_Edits/Code_of_Conduct).

## Test Plan and Acceptance

- Package contract tests verify exact tool names, registration by state, result-envelope parsing, character budgets, cancellation, and shared UI/tool operations.
- Confirmation tests prove submission cannot occur before a valid check and explicit click; draft changes and source revision changes invalidate the check.
- Handoff tests cover expiry, single use, wrong target origin, and self-review rejection.
- Adapter fixtures cover malformed Overpass/Wikidata data, unavailable sources, circular citations, stale source revisions, invalid opening hours, oversized photos, and offline fallback.
- Real-Chrome WebMCP E2E completes the Quest → Survey → Quest approval workflow, then the iD embed staging, and asserts that no live OSM write occurred.
- A second E2E completes a Wikidata reference quest through human entry, validation, source-authenticated approval, and knowledge-graph impact rendering.
- Security tests inject hostile source titles and tool-output text and verify escaping, length caps, and untrusted-content annotations.
- P1 tests run against OSM and Wikimedia development/test environments before any production capability is enabled.
- Test in Chrome 149+ with the flag and in the ChatGPT desktop browser; unsupported runtimes degrade to manual UI without claiming cross-site agent completion.

P0 is complete only when:

- Quest and Survey both consume the published package.
- The OSM adapter uses real gap sources and passes the conformance suite. Wikidata passes the same suite when it lands.
- The cross-site proof works in one agent/browser session.
- A human supplies every substantive contribution.
- Submit cannot bypass confirmation.
- Review cannot bypass the self-review block or the conflict check.
- OSM and Wikidata collective artifacts use real source structure and expose approved versus landed truthfully.
- No source was edited, no individual was ranked, and no organization was required to create a quest.

Production remains on the working v1 build until the full P0 flow passes on a preview deployment. Cut over once it passes; do not migrate v1 localStorage or retain compatibility code.
