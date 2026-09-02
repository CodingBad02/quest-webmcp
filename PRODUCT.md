# PRODUCT.md

Source of truth: SPEC.md Part A. Edit there, regenerate here.

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
