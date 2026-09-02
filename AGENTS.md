# AGENTS.md

## Engineering principles

- Do not preserve backward compatibility. Remove obsolete paths. Do not add compatibility layers or migrations.
- Choose the simplest implementation that fully meets the current requirement. No speculative abstractions, configuration, or indirection.
- Grow the system in layers. Start from the smallest version that works end to end. Add each capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular. Separate concerns clearly.
- Prefer established, well-maintained libraries when they reduce complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Use the dependencies already in the project before writing your own or adding packages. Check a library's docs and types before assuming it lacks a capability.
- Make architectural decisions for the long term. No stopgaps meant to be replaced later.
- Do not create unnecessary documents or notes. Write in a concise, active tone. Follow ASD-STE100 and Zinsser: clarity, simplicity, brevity, humanity.

## Agentic Orchestration:
- If you are Codex - GPT 5.6 Sol Medium as orchestrator and GPT 5.6 Luna xHigh as worker agent
- If you are Claude - Fable 5.1 as orchestrator and Sonnet as worker Agent

## Project: Quest

WebMCP micro-volunteering. Read `SPEC.md` (v2) first. Its Summary and P0 order override everything else here.

- Agent does logistics. Human does the work. No tool performs the volunteer's task. No WebMCP argument carries the volunteer's evidence.
- Five tools only: `find-quests`, `open-quest`, `check-contribution`, `submit-contribution`, `approve-contribution`. Do not add a sixth. Cross-site continuation rides on `open-quest` returning `next.url + handoff`.
- Use `document.modelContext`. Never `navigator.modelContext`.
- Tool output is text under 1,500 characters. Descriptions under 500. Parameter descriptions under 150. Names under 30. Every tool returns the `quest/1` envelope.
- Every tool is a thin wrapper over a shared function the UI also calls. The package controller is that function.
- Shape: `@gatherlight/quest-tools` (npm workspace at `packages/quest-tools`, framework-neutral) consumed by two sites: Quest (this Vite app, React) and Survey (second origin, vanilla TS). One tiny shared store with two entities, `contributions` and `handoffs`. Nothing else server-side.
- Deferred to P0-last: iD embed page, Wikidata adapter. Deferred to P1: write-back, reviewer OAuth. Do not start them before the cross-site proof works.
- `DESIGN.md` is the design source of truth, authored directly. Follow its tokens exactly. `PRODUCT.md` does not exist.

## Skill routing

Load skills only when the task clearly needs them. Do not preload.

| When | Do |
|---|---|
| UI work: layout, tokens, rack, sky, dialog, chips, copy | `impeccable`. New surfaces: `design-taste-frontend` first. Follow `DESIGN.md` tokens exactly. |
| Library or API facts: Vite, React, Overpass, `opening_hours`, Cloudflare Workers, Supabase, iD | Context7 first. Web search second. Never from memory. |
| WebMCP API questions | `Research Docs/02-webmcp-technical-ceiling.md`, then developer.chrome.com/docs/ai/webmcp. |
| Tool not registering, agent not calling, cross-tab not updating | `/investigate`. Root cause before fix. |
| UI QA on the deployed URL | `/qa-only` or Playwright MCP. Report first. Fix in a separate step. |
| Before final push | `/codex review` once. Fix blockers only. |
| Scope creep | Reject. Cite `SPEC.md` P0 order. |
| Demo video or submission text | Separate document. Not this file. |

Do not use: `/ship`, `/autoplan`, `/spec`, `/design-consultation`, `/cso`, `/land-and-deploy`.

## Done means

1. Rack shows the right tools for the current state, on Quest and on Survey.
2. Submit fails before the click. Succeeds after.
3. `open-quest` returns a Survey URL and handoff. Survey exchanges it and registers `check-contribution`.
4. Approval in a second session lights a star on Quest's sky.
5. Offline load works from the fallback JSON.
6. The test plan in `SPEC.md` passes on the live URLs.
