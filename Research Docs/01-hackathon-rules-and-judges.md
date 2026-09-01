# WebMCP Challenge: Rules, Criteria, Judges

Research date: 2026-09-02. Source: https://webmcp.devpost.com and linked pages.

## 1. Organizer

OpenAI runs the hackathon. Devpost hosts it. Partners: Google Chrome, Cloudflare, Shopify, Vercel, Render, Netlify.

## 2. Timeline (Pacific time)

| Event | Date |
|---|---|
| Submissions open | Aug 25, 12:00 PM |
| **Submission deadline** | **Sep 3, 1:00 PM** |
| Judging | Sep 4 to Sep 21 |
| Winners announced | Sep 23, 2:00 PM |

The deadline is one day after this research. Plan for it.

## 3. Prizes

Ten winning teams. Each team gets one prize package. No category prizes. No prize stacking.

| Sponsor | Prize per team |
|---|---|
| OpenAI | $3,000 cash, social spotlight, Codex Micro device, ChatGPT Pro for 1 year (3 members), merch |
| Cloudflare | $10,000 credits |
| Vercel | About $4,200 credits over 12 months |
| Render | $300 credits |
| Netlify | $500 cash |
| Shopify | Limited-edition gear |
| Google Chrome | 3-month AI Ultra subscription per member |

Participation perks exist for early registrants (Vercel, Netlify, Render credits). These are not prizes.

## 4. Eligibility and submission rules

- Legal age of majority required.
- Excluded regions: countries without OpenAI API access, plus US-sanctioned regions.
- Sponsor employees and judges cannot enter.
- No team size limit. One person submits for the team.
- Project must be new, or an existing project "meaningfully extended using WebMCP" with timestamped commits as proof.
- Repository must be open source. License file must be visible at the top of the repository page.

### Required submission items

1. **Video.** Under 3 minutes. Public on YouTube. Shows a working project with spoken explanation. No unlicensed third-party media.
2. **Public repository.** GitHub, GitLab, or Bitbucket. Include source, assets, setup instructions, and license.
3. **Live URL.** Must work in the ChatGPT desktop app browser, or in Chrome 149+ with WebMCP enabled. Supply login credentials if needed.
4. **Text description.** Cover four points: fit to WebMCP, user experience improvement, capabilities for humans and agents, implementation approach.

### Required technology

The project must register tools with the WebMCP API. The rules page shows `document.modelContext.registerTool(...)`. Supported runtimes:

- ChatGPT desktop app in-app browser (WebMCP on by default).
- Chrome 149+ with the WebMCP flag or origin trial.

## 5. Judging criteria

Four criteria. Equal weight.

| Criterion | Question judges ask |
|---|---|
| WebMCP Leverage | "How thoroughly and skillfully does the project use WebMCP?" |
| Execution | Is it "a working or runnable project that has a complete, coherent product experience"? |
| Potential Impact | "Does the project make a credible, specific case for solving a real problem?" |
| Creativity and Ambition | "How creative and novel is the concept?" |

Organizer tip from the Devpost updates page: "judges are not required to watch past 3 minutes, so put your best material first."

Two more rules, verified on the rules page:

- Tie-breaker: "the tied Submission with the highest score in the first applicable criterion listed above will be considered the higher scoring Submission." WebMCP Leverage is first.
- Judges may skip the live URL: "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."

## 6. Judges

Devpost has no judges page. The rules say the panel "may or may not be listed" and may change. The names below come from secondary coverage. Treat as likely, not confirmed.

| Judge | Role | Known for |
|---|---|---|
| Sarah Drasner | Google Chrome | Web platform and developer experience leader. Quoted: wants "implementations that feel genuinely game-changing rather than demo-ware." Example she gave: hide features behind tool calls so agents reveal them in context. |
| Ilya Grigorik | Shopify, Distinguished Engineer | Web performance author. Drives Universal Commerce Protocol (agent commerce). |
| Andrew Galloni | Cloudflare, VP Engineering | Cloudflare Workers and performance. |
| Jude Gao | Vercel, Next.js core | Makes Next.js "agent-first." AGENTS.md, evals, MCP server for Next.js. |
| Sean Roberts | Netlify, VP Applied AI | Coined "Agent Experience (AX)." Netlify MCP tooling. |
| Alex Nahas | Creator of MCP-B | Built the browser MCP project that preceded the WebMCP spec. |
| Justin Rushing | OpenAI | Leads browser platform and WebMCP work. Title unverified. |

## 7. What organizers signal they want

- Theme tags: Machine Learning/AI, E-commerce/Retail, Web.
- Framing: "Build a web experience we haven't seen before using WebMCP." People and agents work together through structured tool calls.
- Halfway checklist from organizers: tools registered and called by an agent, one end-to-end workflow, deployed URL, public repo, video plan.
- Official starter apps: WebMCP starter, Kurio (marketplace with agent checkout), Tagboard (guestbook with moderated writes), Mabel's Table (restaurant reservations), The Archive (collaborative detective mystery).

The starters all show agents that **write**: search, book, post, solve. Read-only demos look weak by comparison.

## 8. Resources

- Spec: github.com/webmachinelearning/webmcp
- Chrome docs: developer.chrome.com/docs/ai/webmcp
- WebMCP origin trial instructions
- WebMCP tool security guide (prompt injection, trust boundaries)
- OpenAI WebMCP Showcase and ChatGPT Sites
- Cloudflare WebMCP on Workers, React template
- Vercel storefront demo repo
- Shopify WebMCP tools docs, Catalog API
- Chrome: `useWebMCPTool` React hook, Angular support, evals, DevTools debugging
- Support: OpenAI Discord, Devpost discussion board

## 9. Field size

About 5,567 registered participants on Sep 2. Project gallery not yet public.

## 10. What this means for winning

- WebMCP must be central, not an add-on. It is one quarter of the score, and the panel built the API.
- Ship something complete. Half-built loses on Execution.
- Put the strongest agent moment in the first 60 seconds of the video.
- Show the agent writing state: book, submit, post, solve. Match the starter apps' pattern.
- Speak the panel's language: "agent experience," tools that mirror user tasks, human confirmation for writes.
- Keep the repo clean and licensed. Judges can read code.
- Do not clone the starter apps. Creativity is scored on its own.
- Optimize for the single top-10 list. No side prizes exist.
