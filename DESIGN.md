# DESIGN.md

Source of truth: SPEC.md Part C. Edit there, regenerate here.



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

