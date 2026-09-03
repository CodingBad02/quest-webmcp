# Quest

Turn twenty free minutes into one real, checked contribution to the public map. One browser agent coordinates the logistics across sites. A person does the part only a person can do.

Built for The WebMCP Challenge, September 2026.

## The idea in one line

Five verbs, one import. Any site that adopts `@gatherlight/quest-tools` becomes agent-ready for volunteering: the agent finds, opens, checks, and submits; the human gathers the evidence and confirms every consequential action.

## What is here

| Part | Path | What it is |
|---|---|---|
| Package | `packages/quest-tools` | `@gatherlight/quest-tools`. Framework-neutral. Registers the five WebMCP tools, owns the state machine, the `quest/1` result envelope, character budgets, the check → confirm → check → submit order, cancellation, and the capability rack. Optional rack renderer and native `<dialog>` confirm. |
| Quest | `src/` | The reference site. React. Two adapters: OpenStreetMap gaps near central Bengaluru (hours, step-free entry) and Wikidata statements about Bengaluru that lack a source. Runs the review queue. Renders two collective artifacts: the sky (real places as stars) and the knowledge graph (entity → claim → source). Approved marks stay outlined; only landed ones fill. |
| Survey | `survey/` | A partner site on a second origin. Vanilla TypeScript. Receives a handoff from Quest and lets a person record a step-free entrance check. Imports the package, overrides no design token. |
| Store | `worker/` | One Cloudflare Durable Object holding two entities: `contributions` and `handoffs`. Handoffs are hashed, origin-bound, single-use, and expire; exchanging one yields a grant scoped to that contribution, never the volunteer's session. Submitted contributions are frozen. Self-review is refused. Unknown browser origins get 403. Serves Survey as static assets. |

## The five tools

| Tool | Registered when | Job |
|---|---|---|
| `find-quests` | Always | Match quests to minutes and skills. Returns ids. |
| `open-quest` | Always | Open one quest. For a step-free entry quest it returns `next.url` and a short-lived `handoff`; the agent navigates there. |
| `check-contribution` | A quest is open on this origin | Validate the form. Return exactly what to fix. |
| `submit-contribution` | Check passed | Open a confirm dialog. Wait up to 90 seconds for the click. Nothing is sent without it. |
| `approve-contribution` | Reviewer tab, queue not empty | Approve one submission after reading it. Conflict-checked against the live OSM element version. |

Every tool returns text that ends with one machine line: `quest/1 {"ok":true,"state":"open","questId":"…","next":{…}}`. States: `available open invalid checked declined submitted approved rejected stale landed`. `approved` never claims the public map changed; only `landed` does.

The agent never does the volunteer's task. No tool argument accepts evidence.

## Quest types

| Type | Source | Human does | Agent checks |
|---|---|---|---|
| `verify-hours` | OSM places with no `opening_hours` | Calls or visits, enters hours | `opening_hours` syntax, method, note |
| `access-photo` | OSM places with no `wheelchair` | Visits, photographs the entrance on Survey | Fields present, photo attached |
| `cite-claim` | Wikidata statements with no reference (SPARQL, Bengaluru) | Finds an independent source and reads it | https, reachable, not Wikimedia, claim unchanged on Wikidata |

Approved OSM edits can be staged in iD from the review queue (`Stage in iD`): the live element is loaded, its version compared, and the exact tag diff placed in iD's undo history. Nothing is uploaded.

## The cross-site loop

1. On Quest, the agent calls `find-quests`, then `open-quest` on a step-free entry quest. Quest stores a draft and mints a handoff bound to Survey's origin.
2. The agent navigates to `next.url`. Survey exchanges the handoff once, registers `check-contribution`, and shows `Carried from Quest · expires 4:59`.
3. A person visits the entrance and fills Survey's form. The agent calls `check-contribution`; `submit-contribution` appears.
4. The agent calls `submit-contribution`. The person clicks Send. The store holds it as `submitted`, `via` Survey.
5. A different session approves on Quest. A gold ring appears on the sky for that place.

## Run it locally

```
npm install
npm run dev:store      # Durable Object store + Survey on http://localhost:8787
npm run dev            # Quest on http://localhost:5173
```

Survey needs a build to be served by the store: `npm run build:survey`. For Survey's own dev server: `npm run dev:survey` (http://localhost:5174).

Open Quest in a WebMCP runtime:

- Chrome 149 or newer: enable `chrome://flags/#enable-webmcp-testing`, relaunch. Or launch with `--enable-features=WebMCP`.
- ChatGPT desktop app browser: WebMCP is on by default.

Without WebMCP everything runs in manual mode. Every tool has a button, and the Send button opens the same confirmation dialog the agent path does: the person always confirms the exact preview. The rack says `Agent runtime: none. Manual mode.`

Open `/?role=reviewer` in a second tab to review. The reviewer tab uses a separate anonymous session so the two-tab demo works in one browser; this is a demo compromise, and it means one browser can approve its own work. Reviewer identity by OpenStreetMap or Wikimedia sign-in is P1.

## Test

```
npm run test:contract          # package: names, budgets, registration by state, envelope, confirm order, cancellation
node worker/test/smoke.mjs [url]   # store: ownership, grants, handoff origin/single-use/expiry, self-review, url checks; default http://localhost:8787
npm run build && npm run build:survey
npx vite preview --port 4173 & npm run test:e2e   # real Chrome, WebMCP on, the whole loop through document.modelContext
```

## Deploy

Quest is live at https://gatherlight.netlify.app (Netlify, `netlify.toml`). The store and Survey are live at https://quest-store.quest-store.workers.dev. In Netlify → Site configuration → Environment variables, `VITE_STORE_URL` = `https://quest-store.quest-store.workers.dev` and `VITE_SURVEY_URL` = `https://quest-store.quest-store.workers.dev/` point the build at the store. GitHub Pages also works (`.github/workflows/pages.yml`, repository variables `STORE_URL` and `SURVEY_URL`).

The store and Survey deploy as one Worker: `.github/workflows/worker.yml` on push, with secret `CLOUDFLARE_API_TOKEN` and variable `QUEST_URL` (`https://gatherlight.netlify.app/`). By hand:

```
npm run build:survey
cd worker && npx wrangler login && npx wrangler deploy
```

Quest's origin is already in `ALLOWED_ORIGINS` in `worker/wrangler.toml`; add any other origin you serve Quest from.

## Design

`DESIGN.md` is the design source of truth. Two surfaces: the sky (dark, deep, slow, real places) and the rack (flat, bright, mono, exact). The rack and dialog ship in the package under a `--qt-*` token contract; Quest and Survey prove one grammar in two skins.

## Data and licences

Place data © OpenStreetMap contributors, ODbL. P0 does not write to OpenStreetMap; approved work waits for a reviewer-owned edit (P1). MIT licence.
