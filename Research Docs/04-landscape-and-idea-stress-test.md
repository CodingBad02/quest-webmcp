# Landscape, Positioning, and Idea Stress-Test

Research date: 2026-09-02. Project gallery for this hackathon is not public yet. The landscape below covers the public WebMCP demo ecosystem.

## 1. What already exists

| Project | One-liner | Pattern |
|---|---|---|
| Travel Demo (Chrome) | Flight search tool | Imperative |
| webmcp.sh | Browser MCP playground with in-browser Postgres | Tool testing |
| isainative.dev | Audits repos for AI readiness | Declarative and imperative |
| webmcp-kanban | React kanban, 8 tools | CRUD |
| big-calendar | Next.js calendar, 15 tools, chat widget | CRUD plus embedded agent |
| ai-tinkerers-webmcp-demo | In-browser RAG with Transformers.js | On-device ML plus tools |
| webMCP-exploration | Git-like versioned state | State via tools |
| WebMCP-demo (SrinivasanTarget) | Polyfill, 15 tools, agent simulator | Reference |
| webmcp-travel-insurance | Policy lifecycle | Multi-step transaction |
| medsyn-web | Medical evidence search | Domain search |
| webmcp-demo (khushalsagar) | Flight booking by spec co-author | Both APIs |
| webmcp-starter "Midnight Eats" | Food delivery, 9 tools, no deps | Minimal reference |
| WebMCP-org/examples | Cart, tasks, notes in 5 frameworks | Framework references |
| WebMCP Maze (Chrome) | Agent is the only input device | Game state as tools |
| CineFlow, Le Petit Bistro, L'Atelier Hotel | Tickets, reservations, hotel booking | Commerce |
| WebMCP Smart Home | Device control dashboard | Control tools |
| Page Agent (Chrome) | Gemini agent for any WebMCP page | Generic driver |
| Model Context Tool Inspector | Chrome extension to view tools | Dev tooling |
| Persona.js | WebMCP-native chat UI library | SDK |
| Sodium | Auto-generates tools from a repo | Retrofit |
| Cloudflare WebMCP bridge | Edge injects one script into any site | Retrofit at CDN |
| webmcp-userscripts | Tampermonkey scripts add tools to sites | Retrofit |
| CDP MCP fork | Replaces DevTools MCP with WebMCP calls. 90% fewer tokens. | Testing efficiency |

### Saturated

- Commerce, checkout, booking. Nearly every official demo.
- Todo, kanban, notes, calendar CRUD. At least six examples.
- "Make any site agent-ready" retrofits. Eight competing tools.
- Inspectors and dev tooling. Chrome ships its own DevTools panel now.

### Empty

- Accessibility for real disabled or low-literacy users. W3C lists it as a goal. No shipped demo.
- Civic, nonprofit, social-good platforms. None found.
- One agent completing a task across several independent WebMCP sites.
- Two users' browsers cooperating on one task.
- On-device Prompt API driving WebMCP tools offline.
- Consumer-facing audit or receipt of agent tool calls.
- Adversarial demos. Spec issue #101 flags malicious tool overwrite. No demo shows it.

## 2. What WebMCP does that nothing else does

Chrome's own words (developer.chrome.com/blog/webmcp-mcp-usage):

- Tools use "live session data, cookies, and DOM elements that are available only in a live browser tab."
- "Instead of your application being a guest within an agent, the agent is a guest on your platform."
- Tools "connect to application logic, not design." Redesigns do not break agents.
- Use MCP as "a foundational service layer." Use WebMCP for "contextual, in-browser interactions when users actively visit your site."

Chrome's flagship use cases: customer support, e-commerce, travel. This is why demos cluster there.

Builder.io: the browser "already has context assistants usually struggle to reconstruct: the current page, the current session, the state the user is in, and the exact moment they need help."

W3C accessibility goal: "Provide a standardized way for assistive technologies to access web application functionality beyond what's available through traditional accessibility trees."

Chrome engineer on Hacker News, answering "what is the point": browser-native agents (Chrome's, ChatGPT's, Copilot) already sit in the tab. They call tools with no API keys, in the session the user is already logged into.

## 3. Stress-test of the community quest platform

### Strong

- Fits the Impact criterion. Social-good is empty space in the demo corpus.
- Confirm-before-submit matches the spec's human-in-the-loop story.
- Novel next to commerce and todo demos.

### Weak

- It is a platform, not a demo. Verified orgs, four task types, sub-task graphs, peer review, and a constellation visual is a multi-quarter product.
- Platforms need real content to look credible. Fake orgs read as staged. The rubric says "real problem for a real audience."
- Gamification cannot be shown in three minutes. A constellation that fills over weeks is the opposite of a short demo.
- WebMCP may be decorative. Translating a guide does not need in-page tools. A chatbot with copy-paste gives most of the value. The agent workflow (recommend, open, prepare, validate, confirm) has the same shape as the saturated checkout demos. The novelty is the domain, not the capability.

### Likely scoring

| Criterion | Risk | Why |
|---|---|---|
| WebMCP Leverage | Medium | Strong only if every step is a real, distinct tool call. |
| Execution | High | Too many surfaces to finish well. |
| Potential Impact | Medium | Strong on paper. Weak unless narrowed to one believable pilot. |
| Creativity | Medium | Novel skin. Common mechanism. |

### Three fixes that make WebMCP load-bearing

1. **One org, one campaign, one task type.** End to end. Depth beats breadth.
2. **Tools change with page state.** A `validateContribution` tool checks real task state (glossary, length, alt text). The submit tool appears only after validation passes. A chatbot cannot do this. No demo in the corpus shows it.
3. **The constellation is the proof of a tool call.** The peer-review tool updates the shared visual live, on camera. Turns the weakest part into the payoff.

## 4. Eight alternative ideas

Ranked by feasibility times novelty. Novelty of 4, 5, and 7 is unverified.

1. **Cross-site errand agent.** One agent finishes a task across two or three independent WebMCP sites in one session. No shared backend. Wow: the agent hops tabs and never re-authenticates. Risk: no native agent orchestrates across tabs yet. You may build the driver.
2. **Legacy-site accessibility co-pilot.** Inject tools into an old form-heavy site. An agent narrates and completes a multi-page task for screen-reader users. Wow: crusty site, live narration, visible tool calls. Risk: use a mirrored site, not a live .gov site.
3. **Consent receipt for non-technical users.** Plain-English log of every agent tool call. "Read card ending 4242. Called placeOrder for $43.10. You clicked Confirm at 10:04." Risk: must not look like a dev inspector.
4. **Offline emergency-prep agent.** Prompt API drives WebMCP tools with no network. Wow: cut WiFi live, agent still completes the form. Risk: Gemini Nano tool-calling reliability is unproven.
5. **Task handoff between two browsers.** A caregiver gets a scoped, revocable link. Their agent completes one task in their own session. Risk: highest. Easy to build a backend app with WebMCP bolted on.
6. **Deep civic form filler.** One painful government form. Real `validateEligibility` tool. Confirm per section. Wow: a form people abandon, done in two minutes. Risk: same shape as checkout demos. Differentiation is the vertical.
7. **Live structured language relay.** Non-English speaker types. Agent proposes structured English inline. User edits one word and confirms. Case worker sees a structured ticket. Risk: scope creep into two apps.
8. **Adversarial red-team demo.** Hostile tools on a sample store. A WebMCP-confirmation agent catches the trick. A screenshot agent gets fooled. Wow: same site, one agent loses $500, one asks the human. Risk: may score low on Impact unless framed as agent safety.

### Researcher's recommendation

Given the deadline, ideas 6 and 8 are the only ones finishable in hours. Both are self-contained. Neither needs fake platform content. If keeping the quest idea, apply the three fixes and cut everything except one workflow.
