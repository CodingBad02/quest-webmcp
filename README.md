# Quest

Turn twenty free minutes into one real, checked community contribution. Your browser agent does the logistics. You do the work.

Built for The WebMCP Challenge, September 2026.

## What it does

Quests come from real gaps in OpenStreetMap: places near you with no wheelchair access tag, or no opening hours. A third quest type rewrites one paragraph of a public help page in plain words.

A WebMCP-enabled browser agent can call five tools on this page. They appear and disappear with page state.

| Tool | Available when | Job |
|---|---|---|
| `find-quests` | Always | Match quests to minutes, skills, and whether you can go out |
| `open-quest` | Always | Open one quest in the workspace |
| `check-contribution` | A quest is open | Validate the form. Return exactly what to fix |
| `submit-contribution` | Check passed | Open a confirm dialog. Wait for your click. Then send to a reviewer |
| `approve-contribution` | Reviewer tab, queue not empty | Approve one submission. Light a star. Notify the volunteer |

The agent never does the volunteer's task. It cannot make the call, take the photo, or know how a person reads a form.

## Run it

```
npm install
npm run dev
```

Open in a WebMCP runtime:

- Chrome 149 or newer: enable `chrome://flags/#enable-webmcp-testing`, relaunch. Or launch with `--enable-features=WebMCP`.
- ChatGPT desktop app browser: WebMCP is on by default.

Without WebMCP the app runs in manual mode. Every tool has a button.

Open `/?role=reviewer` in a second tab to review and approve. Tabs sync with BroadcastChannel and localStorage.

## Test

Real Chrome, WebMCP on, tools called through `document.modelContext.executeTool` as an agent would:

```
npm run build
npx vite preview --port 4173 &
node tests/e2e.mjs
```

Fourteen checks. Screenshots land in `test-results/`.

## Stack

Vite, React, TypeScript, `opening_hours` for OSM hours validation. No backend. State in localStorage. Quests from the Overpass API with a bundled offline copy for central Bengaluru.

## Data and licences

Place data © OpenStreetMap contributors, ODbL. Rewrite sources: USA.gov (public domain), GOV.UK (Open Government Licence v3.0), WHO fact sheets (CC BY-NC-SA 3.0 IGO), Wikipedia (CC BY-SA 4.0). Version 1 does not write to OpenStreetMap. Approved contributions stay in the app for a reviewer to carry over by hand.

MIT licence.
