# North Star

Written 2026-09-02. No timeline. What Quest becomes if the idea is right.

## 1. The sentence

Quest is the agent-readable layer for civic work. Any browser agent can turn a person's spare twenty minutes into one real, checked contribution. The person does the part only a person can do.

## 2. What we proved in version 1

- A browser agent can find, open, check, and submit on a website through five tools, and cannot skip the human.
- Tools that appear only when earned are a usable interface pattern. The rack makes it visible.
- A tool call can wait for a human click. That is a confirmation primitive built on WebMCP today.
- Real data gaps make an endless, honest quest supply. No fake charity needed.

## 3. Five pillars

### Pillar 1. The quest grammar

Five verbs: find, open, check, submit, approve. Every quest type speaks them. Every agent learns them once.

The grammar is the product. Not the app. A site that adopts the grammar becomes agent-ready for volunteering with one script.

Target: a `quest-tools` package. One import. A site declares its quest types and validators. The package registers the five tools, runs the rack, and handles confirmation.

### Pillar 2. Real gaps, many sources

Version 1 reads OpenStreetMap. The same shape fits:

| Source | Gap | Human input |
|---|---|---|
| OpenStreetMap | Missing tags | Visit, call, photograph |
| Wikidata | Missing properties, unsourced claims | Find a citation |
| Wikipedia | "Citation needed" | Find and add a source |
| Common Voice | Missing recordings in a language | Speak a sentence |
| Zooniverse | Unclassified images | Classify one |
| Local government open data | Stale service listings | Confirm by phone |
| Plain-language corpora | Hard-to-read public text | Rewrite one paragraph |

Each source is an adapter. Each adapter maps a gap to a quest and a validator.

### Pillar 3. Human confirmation as a platform primitive

Our await-the-click pattern works. The spec has no primitive for it. We should propose one: `execute` may call `ctx.requestConfirmation({ title, body })` and the browser renders the dialog. Until then, our pattern is the reference implementation. Publish it. File the issue on the spec repository with our code as evidence.

### Pillar 4. Write-back with accountability

Version 1 stores approved work. The next step lands it:

1. OpenStreetMap Notes API. Low risk. Flags a place for any mapper.
2. OpenStreetMap edits by the reviewer's own account through OAuth. The reviewer owns the edit. The app never edits on its own.
3. Wikidata edits the same way.

Every write carries `check_date`, the volunteer's method, and the reviewer. The trail is part of the data.

### Pillar 5. The shared sky as civic memory

Stars are real places. Their positions are real coordinates. A neighborhood's sky fills as its map gets fixed. Two neighborhoods can be compared. Individuals are never ranked.

Long term, the sky is the public record of who helped where. Not a scoreboard. A map of care.

## 4. What the agent does that nothing else can

- It runs inside the volunteer's own logged-in session. No keys, no OAuth dance.
- It sees the exact tools the page allows right now. Not the whole API. Not a scraped DOM.
- It cannot submit without a click. The page enforces it, not the model.
- It can span sites. Find a gap on Quest, verify on Wheelmap, land the edit on OpenStreetMap. One agent, three sites, one session.

That last one is the real north star for the WebMCP part. Quest becomes the coordinator of a cross-site civic workflow.

## 5. Design direction

The identity is a contrast between two surfaces.

**The sky.** Dark, deep, slow. A real map of real places rendered as stars. Poetry. This is where impact lives.

**The rack.** Flat, bright, mono type, exact. A machine panel. This is where the agent lives.

Everything else is quiet and editorial: one serif for headings, one sans for interface, one gold for stars, one green for actions. No gradients as decoration. No stock imagery. No generated imagery. The places are real. Pictures that are not real would break the promise.

## 6. Measures that matter

| Measure | Why |
|---|---|
| Accepted contributions per week | The only output that counts |
| Time from landing to first accepted contribution | The twenty-minute promise |
| Share of contributions started by an agent | Is WebMCP pulling weight |
| Reviewer latency | Trust depends on it |
| Edits landed in the source dataset | Did the world change |
| Rejection reasons by type | Where validators fall short |

Not measured: stars per person, streaks, ranks.

## 7. Risks

- Agent runtimes fragment. Chrome, Edge, ChatGPT each differ. Feature-detect everything. Manual mode must stay first-class.
- Prompt injection through public data. Place names are untrusted text. Mark them. Cap them. Never trust them in tool descriptions.
- Volunteer safety for in-person quests. Daylight only. Public places only. No private addresses.
- Gamification critiques. The sky must stay a record, never a reward. If it starts to feel like points, remove it.
- Write-back harm. A wrong edit hurts the map. Reviewer owns every edit. Bots never do.

## 8. What Quest never becomes

- A place where the AI does the volunteering.
- A leaderboard.
- A bot that edits public datasets on its own.
- A platform that needs an organization to exist before anyone can help.
