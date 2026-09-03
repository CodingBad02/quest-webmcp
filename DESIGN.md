# DESIGN.md — v3

Source of truth: `SPEC.md`. This document is authored directly, not generated. When `SPEC.md` changes, edit this file by hand and re-audit against it.

Scope: the shared npm package `@gatherlight/quest-tools` (capability rack, confirmation dialog) and the two reference sites that consume it, Quest and Survey. The rack and dialog are the portable instrument. Everything else — the sky, quest cards, the reviewer queue, page headings — is Quest's own app, styled with the same tokens but not shipped in the package.

## 1. Direction

Two surfaces, one contrast.

**The sky.** Dark, deep, slow. Serif headline. Real coordinates rendered as stars. This is where impact lives, and it never moves fast.

**The rack.** Flat, bright, mono, exact. A machine panel. This is where the agent lives, and every state change is instant and legible.

**The landing is the sky.** One full-viewport hero: a slow procedural spiral galaxy far behind the constellations, the headline, one intent bar (place, minutes, go), the sentence to say to an agent, and three steps. Nothing else competes for the first look. The quest list and the rack sit below the fold.

Everything else — quest cards, the workspace form, the reviewer queue, page copy — is quiet editorial: the sans body font, restrained color, no decoration that doesn't carry meaning.

**What stays from v1, and why:** Fraunces for headings, Inter for interface text, one gold for stars, one green for actions, no gradients, no stock or generated imagery. This was the right call in v1 and nothing in v2 changes the product's relationship to real places or real people, so nothing here changes.

**What v2 adds:**
- The rack and the confirmation dialog leave the app and become a portable package. They must look and behave identically on a foreign site that has never heard of Fraunces (§2, §3).
- Five envelope states become ten (§4). A quest can be stale, declined, or invalid, and each needs its own honest mark.
- Two real skins now exist side by side: Quest (warm paper, cold sky) and Survey (a plain utility partner site, system fonts, no sky) (§3).
- Cross-site handoff is now visible UI, not an implementation detail: a provenance strip, a return receipt, a runtime pill (§7).
- The sky's visual grammar generalizes to a second collective artifact, the knowledge graph for Wikidata citations (§8).

## 2. Portable token contract

The package ships CSS custom properties with system defaults. No web font, no network request, no build step required to render correctly on a site that changes nothing.

**Scoping rule.** The rack renders in the host page's light DOM under one class root, `.qt`. Every selector is scoped under it (`.qt .qt-rack …`) at the lowest specificity that still wins, and `.qt` carries a defensive reset (`box-sizing`, `list-style`, `line-height`) so it survives a host's own reset without needing `!important`. The rack needs the host's layout system to place it — inside a grid column on Quest, a right rail or bottom sheet on Survey — so it cannot hide behind a Shadow boundary.

**The confirmation dialog: light DOM today, Shadow DOM when needed.** The package ships `createDialogConfirm()`, which builds a native `<dialog class="qt qt-confirm">` per request in the host's light DOM and removes it after. That is enough while both adopters link `qt.css`. The paragraph below describes the shadow-rooted `<qt-confirm-dialog>` the package moves to the first time a host stylesheet breaks the dialog.

**The confirmation dialog uses Shadow DOM (reserved).** It ships as a custom element, `<qt-confirm-dialog>`, with an open shadow root. Two reasons: it is the safety-critical surface in the whole system — a host page's own `dialog { display: none }` reset, competing `z-index`, or third-party CSS must never be able to suppress or corrupt it — and it is a fixed-position overlay, so unlike the rack it never needs to inherit the host's layout context. CSS custom properties cross the shadow boundary by inheritance: a `--qt-*` value set on `:root` or `.qt` still reaches inside the shadow root and themes the dialog. Only *rules* are isolated, not *values*, which is exactly the isolation this component needs and no more.

**Mapping direction.** Quest maps its own design tokens onto `--qt-*`. A partner site (Survey, or any future adopter) maps its own tokens onto `--qt-*`, or changes nothing and gets the system defaults below.

### Default token table

| Token | Default value | Role |
|---|---|---|
| `--qt-color-bg` | `#F7F7F5` | Rack/dialog page-level background |
| `--qt-color-surface` | `#FFFFFF` | Card, rack row, dialog surface |
| `--qt-color-surface-2` | `#F0EFE9` | Secondary surface: rack sublabel row, dialog summary block |
| `--qt-color-surface-3` | `#E6E5DE` | Tertiary surface: hover state on surface-2 |
| `--qt-color-border` | `#DDDDD8` | Hairlines, dividers |
| `--qt-color-text` | `#1A1A18` | Body and rack copy |
| `--qt-color-text-muted` | `#5B5B57` | Helper text, tool descriptions, timestamps |
| `--qt-color-accent` | `#2F6F4F` | Primary action, `checked`/`approved` marks |
| `--qt-color-accent-ink` | `#FFFFFF` | Text/icon on an accent-filled surface |
| `--qt-color-info` | `#2A5C99` | `open`/`submitted` marks, neutral in-progress state |
| `--qt-color-warn` | `#B45309` | `declined`/`stale` marks |
| `--qt-color-danger` | `#B3261E` | `invalid`/`rejected` marks |
| `--qt-color-gold` | `#FFD166` | `landed` mark, decorative only, never used for text |
| `--qt-color-focus` | `#2F6F4F` | Focus ring |
| `--qt-font-ui` | `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | Rack and dialog body text |
| `--qt-font-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` | Tool names, ids, countdowns |
| `--qt-font-size-xs` | `12px` | Tags, counts |
| `--qt-font-size-sm` | `13px` | Descriptions, helper text |
| `--qt-font-size-md` | `15px` | Rack heading, button label |
| `--qt-font-size-lg` | `17px` | Dialog title |
| `--qt-font-weight-regular` | `400` | Body |
| `--qt-font-weight-medium` | `500` | Buttons, tags |
| `--qt-font-weight-semibold` | `600` | Headings |
| `--qt-line-height-tight` | `1.25` | Headings |
| `--qt-line-height-normal` | `1.5` | Body |
| `--qt-space-1` … `--qt-space-8` | `4 8 12 16 24 32 48 64` (px) | Spacing scale |
| `--qt-radius-sm` | `4px` | Rack rows, inputs, small controls. The rack is flat and exact; it never takes a softer corner |
| `--qt-radius-md` | `10px` | Cards |
| `--qt-radius-lg` | `16px` | Dialog |
| `--qt-radius-pill` | `999px` | Tags, buttons |
| `--qt-duration-fast` | `120ms` | Reduced-motion ceiling; small state flips |
| `--qt-duration-base` | `240ms` | Rack row transitions |
| `--qt-duration-slow` | `400ms` | Dialog open/close, cross-tab flash |
| `--qt-ease-out` | `cubic-bezier(.2,.8,.2,1)` | Things appearing |
| `--qt-ease-in` | `cubic-bezier(.6,0,.8,.2)` | Things leaving |
| `--qt-ease-linear` | `linear` | The executing spinner only |
| `--qt-z-rack` | `10` | Rack, in normal flow or sticky |
| `--qt-z-backdrop` | `100` | Dialog backdrop |
| `--qt-z-dialog` | `101` | Dialog surface |
| `--qt-z-toast` | `120` | Transient status messages |

## 3. Two skins, side by side

Quest's own skin is Tailwind v4 utilities plus shadcn/ui primitives (Button, Input, Badge, ToggleGroup, Command, Popover, Drawer, Sonner, Collapsible) on `light-dark()` tokens in `src/index.css`. The shadcn names map onto Quest's palette (`--background` paper, `--primary` green, `--gold`), and one unconditional block bridges them onto `--qt-*`. `qt.css` stays vanilla and unlayered so preflight cannot reach it; the one UA default it relied on, `dialog { margin: auto }`, is restored explicitly. Survey links `qt.css` and nothing else.


| Token | Quest | Survey |
|---|---|---|
| `--qt-color-bg` | `#F5F4EF` (warm paper) | `#F7F7F5` (default, unset) |
| `--qt-color-surface` | `#FFFFFF` (default, unset) | `#FFFFFF` (default, unset) |
| `--qt-color-accent` | `#2F6F4F` (default, unset) | `#2F6F4F` (default, unset) |
| `--qt-color-gold` | `#FFD166` (default, unset) | `#FFD166` (default, unset) |
| `--qt-font-ui` | `Inter, …` (web font, loaded by Quest's shell) | default `system-ui` stack |
| Dark mode | `@media (prefers-color-scheme: dark)` override block, all tokens remap | none. Survey is light-only |

Quest overrides three things: the page background (warm paper, which sits *outside* `.qt` — the rack itself stays on the neutral default surface so it reads as the same machine panel regardless of the page around it), the interface font (Inter, loaded once by Quest's shell), and a full dark-mode remap. Survey overrides nothing. It links one stylesheet and gets the system defaults. That is the proof: an unrelated site with no design work gets the same instrument.

**Dark token values (Quest).** Quest's `@media (prefers-color-scheme: dark)` block remaps every `--qt-color-*` token to the dark palette `styles.css` already used for its own `--bg`/`--surface`/etc. family before v2. `--qt-color-gold` is not remapped: DESIGN.md §13 fixes it at the same value in both themes.

| Token | Dark value |
|---|---|
| `--qt-color-bg` | `#111216` |
| `--qt-color-surface` | `#191a1f` |
| `--qt-color-surface-2` | `#21222a` |
| `--qt-color-surface-3` | `#2a2b34` |
| `--qt-color-border` | `#2c2e37` |
| `--qt-color-text` | `#ecedf1` |
| `--qt-color-text-muted` | `#a9adb8` |
| `--qt-color-accent` | `#6fcf97` |
| `--qt-color-accent-ink` | `#0d1f16` |
| `--qt-color-info` | `#b3bccf` |
| `--qt-color-warn` | `#d8b25c` |
| `--qt-color-danger` | `#f2867a` |
| `--qt-color-focus` | `#6fcf97` (same as `--qt-color-accent`) |

**Why the rack still reads as the same instrument on both sites:** most of the token table is not exposed for override at all.

| May a skin override it? | Properties |
|---|---|
| Yes | Color tokens (`--qt-color-*`), `--qt-font-ui`, `--qt-font-mono`, radius tokens (`--qt-radius-*`) |
| No — fixed by the package | Tool names, state names, glyph shapes, the DOM order of a rack row (dot → name + tag → description), the type scale (`--qt-font-size-*`, weights, line-heights), the spacing scale, every duration and easing, the z-index scale, the dialog's copy structure and keyboard behavior |

A skin can make the rack green or blue, sharp-cornered or soft, set in Inter or in the OS default. It cannot make a row taller, a transition slower, or `submit-contribution` render before `check-contribution` passes. Those are the instrument, not the paint.

## 4. Lifecycle state system

`SPEC.md`'s envelope carries ten states. One chip renders all of them, used in exactly four places: quest cards, the workspace, the reviewer queue, and the sky legend. **The chip is not part of the npm package** — it is Quest's own component (and Survey's, if Survey chooses to show contribution status), built from the same `--qt-*` tokens so a state looks identical everywhere a volunteer sees it, but it is not one of the two things `@gatherlight/quest-tools` exports.

Three glyph families carry the meaning so color is never the only signal:

- **Circle** — progress toward a landed contribution. Fill amount tracks progress; `approved` breaks the pattern deliberately (outlined, not filled) per `SPEC.md`'s explicit rule.
- **Triangle** — needs a person's attention. Filled means "acting now is expected"; outlined means "the volunteer already chose to stop."
- **Diamond** — a conflict with the world, not with the volunteer's work.

| State | Label | Glyph | Color token | Shape rule |
|---|---|---|---|---|
| `available` | Available | Empty circle, 1.5px stroke | `--qt-color-text-muted` | Circle, 0% fill |
| `open` | Open | Circle, quarter-arc fill | `--qt-color-info` | Circle, partial fill |
| `checked` | Checked | Circle, filled, checkmark inside | `--qt-color-accent` | Circle, full fill |
| `submitted` | Sent for review | Circle, filled, static dot at 12 o'clock | `--qt-color-info` | Circle, full fill + orbit mark |
| `approved` | Approved | Circle, 2px ring, **no fill** | `--qt-color-accent` | Circle, outline only |
| `landed` | Landed | Circle, filled, soft glow (`feGaussianBlur`, 8px, reused from the sky) | `--qt-color-gold` | Circle, full fill + glow |
| `invalid` | Needs a fix | Filled triangle, exclamation | `--qt-color-danger` | Triangle, filled |
| `declined` | Kept editing | Outline triangle, exclamation | `--qt-color-warn` | Triangle, outline |
| `rejected` | Sent back | Filled triangle, exclamation | `--qt-color-danger` | Triangle, filled |
| `stale` | Out of date | Filled diamond | `--qt-color-warn` | Diamond, filled |

**The current contribution pulses once.** Whichever chip is the signed-in volunteer's own latest contribution scales `1 → 1.08 → 1` over 400ms, `ease-out`, the first time its state changes while the tab is open — never on page load, never on every re-render (reuse the `firstLit` guard already in `Sky.tsx`). One pulse, then still.

**A star is this chip's circle family**, rendered at sky scale with gold instead of the chip's default accent hue: `available` → the existing unlit ring; `approved` → an outlined ring (new in v2 — v1 only had lit/unlit); `landed` → filled + glow (the existing "lit" star, unchanged). See §8.

## 5. Rack states

| State | Visual | Copy | Timing |
|---|---|---|---|
| Available | Solid row, dot, one-line description | `find-quests — Finds quests near you that fit your time.` | Static |
| New | Slides in from the right, highlight ring, "New" tag | `New: submit-contribution is ready` | Slide + fade `--qt-duration-base` (240ms) `--qt-ease-out`; ring pulses twice at 600ms each, starting 240ms after slide-in, settling at 1400ms total |
| Executing | Row dims, dot becomes a spinner, label changes | `Running check-contribution…` | Spin 1200ms per rotation, `--qt-ease-linear` |
| Removing | Fades, then collapses height, then leaves | `check-contribution is no longer needed` (visible 1.5s before removal starts) | Fade 200ms `--qt-ease-in`, then collapse 260ms `--qt-ease-in` — sequential, not parallel |
| Locked, with reason | Greyed row, lock glyph, no highlight | The reason string the site's `available()` supplied, e.g. `Unlocks after check-contribution passes` | Static |

**Audit decision:** all four numeric timings above are unchanged from v1 (`registry.ts`, `styles.css`). They were already correct — fast enough to read as machine feedback, slow enough to survive a 3-minute demo recording and a low-vision user's tracking. The only change is architectural: they become named `--qt-duration-*` tokens instead of magic numbers, and the 1400ms "new → available" window (previously an undocumented `setTimeout` in `registry.ts:66`) is now a specified value, not an implementation accident.

**Locked, with reason is new as a data-driven state.** v1 hardcoded which two tool names could be locked and why (`CapabilityRack.tsx`'s `LOCKED` map). That breaks the moment a second site declares its own operations. In v2, any operation a site declares but whose `available()` currently returns false renders locked, with the reason string the site provided — the rack draws what it is given, it does not know the product.

**Fixed row layout**, identical on both skins: a glyph/dot column (12px), then a mono tool name with an optional state tag beside it, then the description below. This order never changes.

### 5a. Markup contract

The rack and dialog are plain HTML with fixed class names. Any renderer (React on Quest, vanilla on Survey) emits exactly this. Styles live in one portable stylesheet, `src/qt.css` today, moving unchanged into the package.

```html
<aside class="qt qt-rack" aria-label="Agent tools">
  <h2 class="qt-rack-title">Tools available now</h2>
  <p class="qt-rack-runtime">Agent runtime: none. Manual mode.</p>
  <ul class="qt-rack-list" aria-live="polite">
    <li class="qt-tool" data-state="available" tabindex="0">
      <span class="qt-tool-dot" aria-hidden="true"></span>
      <span class="qt-tool-name">find-quests</span>
      <span class="qt-tool-tag">New</span>
      <span class="qt-tool-desc">Matches quests to your time and skills.</span>
    </li>
    <li class="qt-tool" data-state="locked" tabindex="0">
      <span class="qt-tool-dot" aria-hidden="true"></span>
      <span class="qt-tool-name">submit-contribution</span>
      <span class="qt-tool-desc">Unlocks after check-contribution passes.</span>
    </li>
  </ul>
  <p class="qt-rack-empty" hidden>No tools right now.</p>
</aside>
```

`data-state` is one of `available | new | executing | removing | locked`. The tag span is present only for `new` (text `New`) and `executing` (text `Running`). Executing rows render the spinner on `.qt-tool-dot`.

```html
<dialog class="qt qt-confirm" aria-labelledby="qt-confirm-title">
  <h2 class="qt-confirm-title" id="qt-confirm-title">Send this to a reviewer?</h2>
  <dl class="qt-confirm-summary">
    <dt>Opening hours</dt><dd>Mo-Fr 08:00-17:00</dd>
    <dt>Checked by</dt><dd>Phone call</dd>
  </dl>
  <dl class="qt-confirm-meta">
    <dt>Destination</dt><dd>Quest's review queue</dd>
    <dt>Visibility</dt><dd>Held for review. Not public yet.</dd>
    <dt>License</dt><dd>Open Database License (ODbL)</dd>
  </dl>
  <p class="qt-confirm-body">A person checks this before it changes anything public. You can edit it again if it's sent back.</p>
  <p class="qt-confirm-note">This closes on its own if you wait 90 seconds. Nothing is sent until you choose.</p>
  <div class="qt-confirm-actions">
    <button class="qt-btn" value="cancel">Keep editing</button>
    <button class="qt-btn qt-btn-primary" value="confirm">Send for review</button>
  </div>
</dialog>
```

Until the package exists, the dialog renders in light DOM with these classes. The `<qt-confirm-dialog>` shadow wrapper (§2) arrives with package extraction and wraps this same markup.

## 6. Confirmation dialog

Native `<dialog>`, rendered inside `<qt-confirm-dialog>`'s shadow root (§2). One pending confirmation per page: a second `submit-contribution` call while one is open resolves immediately with `state: 'declined'` and `message: 'Finish or close the current confirmation first.'` — matching the platform's own behavior, since a second `showModal()` on an open dialog already throws.

Two copy modes, selected by the adapter. P0 only ships review mode; public-write mode is reserved grammar for P1's write-back and specified now so the dialog never needs a second design pass.

**Review mode (P0 — every quest today):**

- Title: `Send this for review?`
- Summary: the exact fields the volunteer filled, verbatim (for example: `Opening hours: Mo-Fr 08:00-17:00 · Checked by: phone call`)
- Destination: `Destination: {site name}'s review queue`
- Visibility: `Visibility: Held for review. Not public yet.`
- License: `License: {adapter license}` (for example, `Open Database License (ODbL)`)
- Body: `A person reads it before anything changes in public. If it comes back, you can edit it.`
- Buttons: `Keep editing` / `Send`
- Timeout notice, shown once near the buttons, not a ticking countdown: `Nothing is sent until you choose. This closes after 90 seconds.`

**Public-write mode (P1, reserved — reviewer-owned direct edits):**

- Title: `Publish this change?`
- Destination: `Destination: {source element or entity, e.g. OpenStreetMap way 483920}`
- Visibility: `Visibility: Public immediately, under your account.`
- License: same license line as review mode
- Body: `This writes to the public record now, under your account. A new edit can correct it later; nothing here can be quietly undone.`
- Buttons: `Keep editing` / `Publish`

**Outcomes.** Confirm resolves `submitted` (review mode) or `landed` (public-write mode, after the write succeeds). `Keep editing`, `Esc`, backdrop click, and the 90-second timeout all resolve the same way: `state: 'declined'`, message `Kept editing. Nothing was sent.` (or, on timeout, `No response in 90 seconds. Nothing was sent.`). A stale source revision or a failed re-validation never reaches the dialog at all — the tool returns `stale` or `invalid` before offering to confirm.

**Focus, keyboard, motion.** `showModal()` gives native focus containment in evergreen browsers; the controller still restores focus explicitly to the field the volunteer last touched on any close path, matching `ConfirmModal.tsx` today. `Esc` equals `Keep editing`. `Enter` activates only a focused button, never a background field. Under `prefers-reduced-motion: reduce`, the dialog's rise-and-fade collapses to a 120ms opacity crossfade with no translation.

**Untrusted content.** Any external text inside the summary (a quest title, a place name) is a plain text node, never HTML, capped at 120 characters with an ellipsis, and carries `untrustedContentHint` at the tool-output layer per `SPEC.md`.

## 7. Handoff provenance

**Receiving-site strip.** Survey shows this at the top of its workspace the moment it exchanges the handoff:

`Carried from Quest · check-contribution ready · expires 4:59`

The countdown is real and ticks down in `--qt-font-mono`, tabular figures — unlike the confirmation dialog's timeout, this urgency is true (the handoff really does expire), so it is allowed to count down live. Style: a thin bar, `--qt-color-surface-2` background, `--qt-color-text-muted` text, a small origin mark at the left (a generic chain-link glyph if the origin site can't be identified). On expiry, the copy replaces itself: `Handoff expired. Ask your agent to reopen this quest from Quest.` in `--qt-color-warn`, no action available.

**Return receipt on Quest.** When work comes back from a partner site, it appears in the volunteer's own contribution list with the same chip (§4) plus a small muted mono tag: `via Survey`. Example: `Sent for review — via Survey · Elm Street Library entrance photo`.

**Runtime pill.** Feature-detected, never boastful — plain text, no accent color, no icon celebrating itself. This replaces the amber "WebMCP off" pill flagged in §0:

| Condition | Copy |
|---|---|
| WebMCP present, runtime identifiable | `Agent: Chrome 153` |
| WebMCP present, runtime unclear | `Agent: detected` |
| WebMCP absent | `No agent connected. Click the buttons instead.` |

All three render in the same neutral pill style (`--qt-color-text-muted` on `--qt-color-surface-2`, no border-color signaling). Manual mode is not a degraded state; it does not get a warning color.

## 8. Collective artifacts

**The sky** is the ten-state chip's circle family (§4), rendered at sky scale in gold instead of accent:

- `available` (not yet contributed) → open ring, low-opacity stroke, no fill.
- `approved` (reviewed, not yet landed) → outlined ring, no fill — **new in v2**. v1 only distinguished lit from unlit; v2 adds this middle truth, because a reviewer's approval and a source's actual acceptance are different facts and the sky must not conflate them.
- `landed` (the source accepted the write) → filled, soft glow — unchanged from v1's "lit" star.

The current contribution pulses once on ignition (500ms, scale `.6→1`, opacity `0→1`, `--qt-ease-out`), its nearest lit neighbor's connector draws in over the following 400ms, and the whole sequence stays under 600ms — unchanged from v1. Hover or tap reveals first names only: `Verified by Priya. Reviewed by Tom.` No per-person counts, no ranks, no lifetime score, anywhere.

**The knowledge graph (Wikidata).** Built in `src/components/KnowledgeGraph.tsx`. Same primitives as the sky: SVG circles and paths, no charting library, no continuous scale.

- **Entity node** — a circle, one of three fixed sizes by claim count (small / medium / large — never continuous, so it can't read as a leaderboard).
- **Claim edge** — a line from the entity to a small terminal mark representing its source.
- **Approved, not yet landed** — dashed edge, outlined terminal mark.
- **Landed** — solid edge, filled terminal mark, the same gold used for stars, the same single-pulse rule on the current contribution.

No node ever shows an edit count beside a name.

## 9. Motion and reduced motion

| Moves | Never moves |
|---|---|
| Rack rows on appear / remove / execute | Layout while typing in any field |
| Star and knowledge-graph marks lighting, connectors drawing | Quest list order, except by an explicit filter change |
| Confirmation dialog open / close | The header height or the grid columns |
| Handoff countdown digits, cross-tab flash on a changed field | Anything on the paper surfaces that is decorative or idle |
| The hero sky only: galaxy spin (1 rev / 240 s), a shallow grain shimmer, nebula drift, pointer parallax | The band sky: the galaxy dims to 25% and the copy is gone |

| Component | Duration | Easing |
|---|---|---|
| Rack row transitions | 200–260ms | `--qt-ease-out` in, `--qt-ease-in` out |
| Rack "new" ring | 600ms × 2 | `--qt-ease-out` |
| Executing spinner | 1200ms / rotation | `--qt-ease-linear` (the one linear exception) |
| Star / graph-mark ignition | ≤500ms | `--qt-ease-out` |
| Connector draw | 400ms, after ignition settles | `--qt-ease-out` |
| Dialog open / close | 200–220ms | `--qt-ease-out` / `--qt-ease-in` |
| Cross-tab field flash | 400ms | `--qt-ease-out` |
| Chip pulse (current contribution) | 400ms | `--qt-ease-out` |
| Hero copy entry (`@starting-style`, once per mount) | 640ms, 90ms stagger | `--ease-out` |
| Galaxy alpha hero ↔ band | ~1.2 s lerp | linear per frame |

**`prefers-reduced-motion: reduce`:** one global query, not per-component overrides that can drift. Every duration above collapses to 0–120ms crossfades or disappears outright. The executing spinner becomes a static "Running…" label. Rack removal skips the collapse and vanishes on the next state read. Star and graph-mark ignition skips the scale/opacity tween and sets the final state directly, optionally with a single 150ms fade. The confirmation dialog loses its rise, keeping only a 120ms fade. The sky switches to the static SVG path with a CSS haze in the galaxy's place: same composition, no motion.

## 10. Copy rules

1. State what happened, not how good it is. No `Amazing work!`.
2. Name the real place, document, or entity — never `your quest`.
3. Buttons are verbs: `Check`, `Submit`, `Approve`, `Publish` — not `Go` or `Next`.
4. Never claim certainty the app hasn't earned. `Sent for review`, not `Verified`. `Landed`, only once the source confirms it — `approved` never implies `landed`.
5. No urgency or scarcity language, with one narrow exception: a handoff countdown is a true constraint and may count down (§7). A confirmation timeout is not — state it once, don't tick it.
6. Errors state the fact and the fix, in that order, never blame.
7. Sentences stay under 20 words. One idea per sentence. Same term every time: `quest`, `reviewer`, `contribution` — never a synonym for variety.
8. No exclamation points in system copy. Enthusiasm belongs to the volunteer, not the app.
9. Runtime and provenance copy is informational, never a boast. `Agent: Chrome 153`, not `Powered by AI!`.

## 11. Accessibility checklist

1. Visible focus ring on every interactive element, 2px minimum, `--qt-color-focus`, never removed with `outline: none` alone.
2. Every form input has a programmatic `<label>`, not placeholder-only text.
3. Rack state changes announce via `aria-live="polite"` (new, removed, locked); reserve `assertive` for a blocking form error only.
4. A landed star or graph mark announces on the volunteer's tab through a polite live region: `A star lit up for {place}.`
5. No state — chip, star, rack row — ever relies on color alone; each pairs a shape or icon with text (§4, §5).
6. Touch targets minimum 44×44px: rack rows, star hit areas, chip tap targets.
7. Rack rows are keyboard-focusable even when not clickable, so a screen-reader user can read their state.
8. The confirmation dialog traps focus (native via `showModal()`, with an explicit restore-on-close fallback), and is dismissible with `Esc`.
9. Custom properties cross the shadow boundary, but ARIA relationships (`aria-labelledby`, `aria-describedby`) must stay inside one root — verify none reach across the `<qt-confirm-dialog>` shadow boundary.
10. The handoff countdown updates via a polite live region at most once per 15 seconds, not on every tick — a screen reader should not narrate a stopwatch.
11. Form validation errors link to their field with `aria-describedby`.
12. Respect `prefers-reduced-motion` globally, one media query, everywhere in §9's table.

## 12. Layout

**Quest.** Three regions: the sky (top), the quest workspace (main), the rack (side). While browsing the sky is the landing: `min-height: 100svh`, the topbar floats over it, the copy block sits left of centre (headline, lede, intent bar, agent sentence), the constellations take the right half, the steps sit bottom-left and one legend bottom-right. Once a quest is open, or in the reviewer role, it shrinks to a `140px` band with the galaxy at 25%.

- At 1920px: `grid-template-columns: minmax(680px, 760px) 320px;`, centered. The workspace never exceeds 760px.
- At 1280px: `grid-template-columns: minmax(560px, 1fr) 280px;`.
- Below 900px: single column. Constellations drop below the copy inside the hero; the band is `96px`. The rack becomes a shadcn Drawer (vaul) opened by a floating count pill (`2 tools`).
- The quest list carries a kind filter (All / Call / Visit / Read), the provenance badge in its footer, and the knowledge graph in a collapsible `Sources in {place}` section. There is no profile card: place and minutes live in the intent bar, the name is asked once in the workspace as `Sign as`.

**Survey.** No sky. Single column by default.

- Wide (≥1024px): the rack sits as a right rail, `280px` fixed, alongside the main content column.
- Narrow (<1024px): the rack becomes a bottom sheet, identical mechanism to Quest's mobile rack — this is the same instrument, so its mobile fallback is not reinvented per site.

**Shared breakpoints:** `1280px`, `1024px` (Survey's rail-to-sheet point), `900px` (Quest's column-to-sheet point), `640px` (dense mobile adjustments: hidden secondary pills, stacked dialog buttons). The header or top bar never exceeds 56–72px and never wraps to two lines, on either site.

## 13. Contrast

All pairs meet or exceed WCAG AA (4.5:1 body text, 3:1 large text and UI components), computed against relative luminance.

| Pair | Light | Dark (Quest only) |
|---|---|---|
| `--qt-color-text` on `--qt-color-surface` | 17.4:1 | 14.7:1 |
| `--qt-color-text` on `--qt-color-bg` | 16.3:1 | 16.0:1 |
| `--qt-color-text-muted` on `--qt-color-surface` | 6.8:1 | 8.6:1 |
| `--qt-color-text-muted` on `--qt-color-surface-2` | 5.9:1 | — |
| `--qt-color-accent` on `--qt-color-surface` | 6.0:1 | 9.1:1 |
| `--qt-color-accent-ink` on `--qt-color-accent` | 6.0:1 | 9.0:1 |
| `--qt-color-info` on `--qt-color-surface` | 6.8:1 | 7.8:1 |
| `--qt-color-warn` on `--qt-color-surface` | 5.0:1 | 9.6:1 |
| `--qt-color-danger` on `--qt-color-surface` | 6.5:1 | 6.9:1 |
| `--qt-color-gold` on `--sky` (Quest sky, both themes) | 13.3:1 (decorative; not used for text) | 13.3:1 |
| sky text (`--sky-ink`) on `--sky` | 17.0:1 | 17.0:1 |
| sky muted (`--sky-muted`) on `--sky` | 8.8:1 | 8.8:1 |

`--qt-color-border` on `--qt-color-surface` is 1.4:1 — below the 3:1 UI-component threshold. This is a deliberate, narrow exception: every bordered control (input, rack row, card) also carries a label, padding, and, for interactive states, a focus ring or shape change, so no control depends on the border alone to be identified. It stays a hairline, not a boundary of record.

**Dark mode.** Quest follows `prefers-color-scheme: dark` with no manual toggle — every token above remaps, and the sky stays the same dark surface in both themes (it was already dark; "dark mode" only changes the paper around it). Survey ships light-only. Nothing here prevents Survey from adding a dark override later — the tokens make it a one-line change — but it is not part of this contract, since a single-purpose partner site has not asked for one.

## 14. Anti-patterns

1. Fake or prefilled progress bars implying work already done.
2. Leaderboards, rankings, or any "top contributor" display — for people, or for graph entities.
3. Points, badges, or streaks with no connection to real outcomes.
4. Confetti, fireworks, or celebratory animation on a routine action.
5. Gradients, glassmorphism, or glowing-orb decoration with no functional meaning.
6. Dark patterns: forced continuity, disguised ads, confirm-shaming copy (`No thanks, I don't want to help`).
7. Auto-submitting anything the agent prepared without an explicit human confirmation.
8. Claiming a quality the app hasn't earned: `Verified!`, `100% accurate`, or `landed` before the source has confirmed it.
9. A ticking countdown on anything that isn't a real, external deadline — the confirmation timeout gets one calm sentence, not a stopwatch (§6, §10).
10. A boastful runtime pill (`AI-Powered!`) or a warning color on manual mode, which is a supported mode, not a fallback (§7).
11. Two different visual treatments for the same lifecycle state in two different surfaces — there is one chip (§4); a second one is a bug, not a variant.

## 15. References

Carried from v1; the reward-system rationale and accessibility baseline are unchanged by v2's protocol work.

| # | Reference | What we borrow |
|---|---|---|
| 1 | Ryan & Deci, 2000, *Self-Determination Theory* | Autonomy over points — task choice, not a score. |
| 2 | Erickson & Kellogg, 2000, *Social Translucence* (ACM) | Visibility and accountability without ranking — the basis for chip and sky disclosure. |
| 3 | Kivetz, Urminsky & Zheng, 2006, *The Goal-Gradient Hypothesis Resurrected* | One honest, bounded step of progress — never a prefilled bar. |
| 4 | Bogost, 2011, *Gamification Is Bullshit* | The hostile-review test for the sky and the graph: cut it if it starts to feel like a reward. |
| 5 | Porto de Albuquerque, Herfort & Eckle, 2016, *The Tasks of the Crowd* (MDPI) | Skill- and task-matched quests, not one-size-fits-all. |
| 6 | teamLab, *Forest of Resonating Lamps* | Lighting one node spreads light along a fixed connected path — the model for both the sky's and the graph's connectors. |
| 7 | Hashemi & LaPorte, *Listen to Wikipedia* | Many small edits shown as light in real time, with no ranking of who did most. |
| 8 | GOV.UK Design System, accessibility strategy | WCAG 2.2 AA baseline and component-level guidance (equivalent: US Web Design System). |
| 9 | Google PAIR, *People + AI Guidebook* | Feedback and control — the volunteer sees and can act on what the agent found before anything sends. |
| 10 | Microsoft Research, *HAX Toolkit* | Convey consequences before a consequential action — the basis for §6's dialog copy. |
| 11 | `SPEC.md`, Public Contracts §"Human confirmation" and §"Collective impact" | The ten-state envelope, the outlined/filled/pulse rule, and the no-karma rule are product requirements, not design choices — this document implements them, it does not originate them. |
