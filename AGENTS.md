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

WebMCP micro-volunteering app. Deadline 2026-09-03 13:00 PDT. Read `SPEC.md` Part A5 first. Those decisions override everything else.

- Agent does logistics. Human does the work. No tool performs the volunteer's task.
- Five tools only: `find-quests`, `open-quest`, `check-contribution`, `submit-contribution`, `approve-contribution`. `open-quest` exists so the agent can move the volunteer into a workspace without a click. Do not add a sixth.
- Use `document.modelContext`. Never `navigator.modelContext`.
- Tool output is text under 1,500 characters. Descriptions under 500. Names under 30.
- Every tool is a thin wrapper over a shared function the UI also calls.
- No backend. `opening_hours` is the one planned dependency.
- `PRODUCT.md` and `DESIGN.md` are generated from `SPEC.md` Parts A and C for the `impeccable` skill. Edit `SPEC.md`, then regenerate. Do not edit them directly.

## Skill routing

Load skills only when the task clearly needs them. Do not preload.

| When | Do |
|---|---|
| UI work: layout, tokens, rack, constellation, modal, copy | `impeccable`. Follow `DESIGN.md` tokens exactly. |
| Library or API facts: Vite, React, BroadcastChannel, Overpass, `opening_hours` | Context7 first. Web search second. Never from memory. |
| WebMCP API questions | `Research Docs/02-webmcp-technical-ceiling.md`, then developer.chrome.com/docs/ai/webmcp. |
| Tool not registering, agent not calling, cross-tab not updating | `/investigate`. Root cause before fix. |
| UI QA on the deployed URL | `/qa-only` or Playwright MCP. Report first. Fix in a separate step. |
| Before final push | `/codex review` once. Fix blockers only. |
| Scope creep | Reject. Cite `SPEC.md` Part A4. |
| Demo video or submission text | Separate document. Not this file. |

Do not use: `/ship`, `/autoplan`, `/spec`, `/design-consultation`, `/cso`, `/land-and-deploy`.

## Done means

1. Rack shows the right tools for the current state.
2. Submit fails before the click. Succeeds after.
3. Approval in tab two lights a star in tab one.
4. Offline load works from the fallback JSON.
5. The eight-item checklist in `SPEC.md` Part B section 14 passes on the live URL.
