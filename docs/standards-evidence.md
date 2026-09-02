# WebMCP standards evidence from Quest

Drafts for three comments on existing webmachinelearning/webmcp issues. Post by hand after the cross-site e2e passes on the deployed URLs. Do not open new issues unless a maintainer asks for a narrower proposal.

Fill the `[ ]` fields from `tests/e2e.mjs` output and the deployed URLs before posting.

## What we built, in one paragraph

Quest is a micro-volunteering flow across two origins. `@gatherlight/quest-tools` registers five tools (`find-quests`, `open-quest`, `check-contribution`, `submit-contribution`, `approve-contribution`) with `document.modelContext`, registers and unregisters them as page state changes, and makes `submit-contribution` wait inside `execute` for a human click in a native `<dialog>`. `open-quest` can return a URL plus a short-lived, origin-bound, single-use handoff; the agent navigates to a second origin, which exchanges the handoff and registers its own `check-contribution` and `submit-contribution`. Source: https://github.com/CodingBad02/quest-webmcp. Package: `packages/quest-tools`.

## Runtime observations (Chrome 152, `--enable-features=WebMCP`, Playwright `channel: 'chrome'`, 2026-09-03)

| Observation | What we saw | Where |
|---|---|---|
| Long-running `execute` | A tool that awaits a promise resolved by a user click returns normally; measured with a 3 s sleep (3,003 ms round trip) and with the real dialog in e2e step 7. We cap at 90 s ourselves. | `packages/quest-tools/src/controller.ts` run(), `tests/e2e.mjs` 7a/7b |
| Unregister during execute | Aborting the registration `AbortSignal` while the tool's own `execute` is still running drops the result. We defer the abort until after the result returns (`deferredAbort`, 50 ms). | `controller.ts` register()/unregister() |
| `execute(input, { signal })` | Absent in Chrome 152: `execute` is called with exactly one argument (`arguments.length === 1`), so there is no runtime-driven cancellation today. We accept an optional second argument and forward its signal to the confirm dialog, so a runtime that adds it gets a cancel path for free. | `controller.ts`, `ui/confirm-dialog.ts` |
| `toolchange` | Registering after a state change surfaces in `getTools()` immediately; agents that cache the tool list at page load miss `submit-contribution`. Revalidating inside `execute` is therefore required, not optional. | `controller.ts` run() re-checks `available()` |
| Cross-document | Tools do not survive navigation. A tool result containing a URL is the only continuation we have; the receiving document must re-register. `executeTool` returns `null` when the call causes navigation, so `open-quest` must not navigate itself. | `src/webmcp/tools.ts` open, `survey/main.ts` boot |
| Budgets | Output over 1,500 characters is truncated by us before it leaves the page. Chrome 152 does not truncate: a 4,000-character result came back whole through `executeTool`. | `packages/quest-tools/src/envelope.ts` |

## Comment 1 — issue #165, native elicitation / user confirmation

> We shipped a site-enforced confirmation inside a tool's `execute` and would like to share what a native primitive would need to replace it.
>
> **What we do today.** `submit-contribution` runs check → open a native `<dialog>` with the exact payload, destination, visibility, and license → wait up to 90 s for Confirm or Keep editing → re-check → write. Decline, timeout, agent cancellation (`AbortSignal`), stale source data, and validation failure each return a distinct, actionable result. One confirmation may be pending per page; a second call returns immediately. Implementation, framework-neutral, ~120 lines: `packages/quest-tools/src/controller.ts` and `ui/confirm-dialog.ts` in [repo].
>
> **Why the page cannot make this a security boundary.** The dialog is ours. A hostile page can skip it. The agent cannot tell a real confirmation from a fake one. Users cannot see which origin is asking. This is exactly the gap a native primitive would close.
>
> **Requirements we would put on `requestUserInteraction()` or similar, from running this in Chrome 152:**
> 1. Visible origin, rendered by the browser, not the page.
> 2. An exact action preview supplied by the tool: what will be sent, where, under which license, public or held for review.
> 3. An explicit user response distinguishable from timeout and from agent cancellation.
> 4. Cancellation through the same `AbortSignal` the tool received.
> 5. Concurrency: one pending interaction per top-level document, with a defined result for a second request.
> 6. Continuity across navigation, or a clear statement that there is none, so tools can return a URL instead of navigating.
>
> Runtime observations table and e2e trace: [link to docs/standards-evidence.md].

## Comment 2 — issue #161, skills / task-level tool patterns

> Evidence for a small fixed grammar over many sites: five verbs, `find`, `open`, `check`, `submit`, `approve`, each a thin wrapper over a function the page's own buttons call.
>
> Two unrelated sites (React, vanilla TS) register the same five names from one package; a site implements only the verbs it can perform, and `available()` decides registration per verb on every state change, so an agent sees `submit-contribution` only after `check-contribution` passes. Every result ends with one machine line `quest/1 {"ok":…,"state":…,"next":{"url","handoff"}}` so an agent can plan without parsing prose.
>
> What generalized well: the state machine, the confirm gate, and the rack (a visible panel listing exactly the tools registered now, so people and agents see the same thing). What did not: descriptions. A 500-character agent description and a one-line human label are different texts; we ship both.
>
> Package and contract tests: [repo]/packages/quest-tools.

## Comment 3 — issue #227, cross-tab / cross-document discovery

> A concrete trace of a workflow that spans two origins with today's API, and where it stops.
>
> 1. Origin A (`Quest`): agent calls `open-quest`. The tool stores a draft server-side, mints a handoff (random token, stored hashed, bound to origin B, one action, 5-minute expiry, single use) and returns text ending `quest/1 {"state":"open","next":{"url":"https://B/?handoff=…","handoff":"…"}}`. The tool does not navigate; `executeTool` would return `null`.
> 2. The agent navigates the tab to `next.url`.
> 3. Origin B (`Survey`) exchanges the token with its own origin as the `Origin` header, receives canonical state, and registers `check-contribution` (and later `submit-contribution`). A strip shows `Carried from Quest · expires 4:59`.
> 4. The person fills B's form. The agent calls `check-contribution` then `submit-contribution` on B; the person confirms; B writes to the shared store.
> 5. Back on A, a different session sees the submission and approves it.
>
> Observed in Chrome 152 through `document.modelContext.executeTool` (Playwright): the first document's tools vanish on navigation and the second document's appear after its script runs (`tests/e2e.mjs` steps 10–11). Whether a given agent runtime follows `next.url` on its own is runtime behavior we could not observe from the page; the page's contract is the URL in the result. What the page needs from the platform: (a) a way for a tool result to say "continue on this URL" that agents treat as a first-class step, (b) an assurance that tool registration on the new document is discoverable without the user re-prompting, (c) nothing else — the capability exchange itself works fine as ordinary HTTP. We did not need cross-tab tool discovery for this; sequential navigation with a handoff token covers the civic case.
>
> e2e trace: `tests/e2e.mjs` steps 10–15 in [repo].
