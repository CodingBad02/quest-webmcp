# Strategy: How to Place in the Top 10

Written 2026-09-02. Consolidates docs 01 to 04.

## 1. The one fact that changes everything

Submissions close **Sep 3, 2026 at 1:00 PM PDT**. In IST that is **Sep 4, 1:30 AM**. From this writing (Sep 2, 00:37 IST) that is about 37 hours. The 10-day window is almost over. Plan for hours, not days.

## 2. What judges reward

Four equal criteria: WebMCP Leverage, Execution, Impact, Creativity. Ten prizes. No side categories.

Three signals from the organizers:

- Starter apps all show agents that write: book, post, checkout, solve.
- Sarah Drasner (Chrome judge) wants "implementations that feel genuinely game-changing rather than demo-ware." Her example: hide features behind tool calls so agents reveal them in context.
- "Judges are not required to watch past 3 minutes, so put your best material first."

Parth Mittal's test applies: "Could I build my project without this?" If yes, wrong project.

## 3. The community quest idea: verdict

Keep the idea. Cut the platform. Ship one workflow.

The full pitch (verified orgs, four campaign types, peer review, skill paths, chapters) is a quarter of product work. It cannot be finished by tomorrow. Judges will see the gaps and score Execution low.

The core is strong. Social good is empty space in the WebMCP demo corpus. Every Chrome Built-in AI Challenge winner solved a clear human problem, often accessibility. Impact is one quarter of the score.

### The narrowed version

One organization. One campaign. One task type. Example: a food bank needs its intake guide translated into Spanish, split into eight short passages.

One-line pitch: "Tell your browser 'I have twenty minutes and I speak Spanish.' It finds a real community task, drafts it, checks it, and submits it. You approve every step."

### Tools (six, no more)

| Tool | State | Why WebMCP and not a chatbot |
|---|---|---|
| `find-quests` | Always | Reads the volunteer's saved skills, language, and time from the logged-in session. |
| `open-quest` | Always | Navigates the real workspace. Agent becomes a guest in the UI. |
| `draft-contribution` | Only inside a workspace | Writes into the live editor. Volunteer sees and edits it. |
| `validate-contribution` | Only inside a workspace | Runs real checks against task state: glossary terms, length, missing fields. Returns actionable errors. |
| `submit-contribution` | **Only after validation passes** | Registered dynamically. Agent cannot see it until the work is valid. Requires a click in the UI. |
| `review-contribution` | Reviewer role only | On approval, the shared constellation lights one star. Live, on camera. |

The dynamic `submit-contribution` tool is the hook. It is the pattern Drasner described. No demo in the corpus shows it. It is impossible for a chatbot, because a chatbot has no live page state.

### What to cut

- Multiple campaign types. One.
- Skill paths, chapters, story mode. Cut.
- Peer review queue. One reviewer approves one item on camera.
- User accounts. Two seeded users: volunteer and reviewer.
- Verified org onboarding. One seeded org.

### The constellation

Keep it small. One SVG. Eight stars, one per passage. Unlit until approved. This makes the tool call visible. It also fills the Creativity score.

## 4. Runtime decision

The rules name two runtimes: ChatGPT desktop app browser, and Chrome 149+ with WebMCP on.

1. Test the ChatGPT desktop browser first. WebMCP is on by default there. OpenAI runs this hackathon. Their judge will test in it.
2. Fallback for the video: Chrome with `chrome://flags/#enable-webmcp-testing` plus Gemini in Chrome. Verify Gemini calls tools on your machine before you script around it.
3. Last fallback: GoogleChromeLabs Page Agent with your own Gemini API key. Guaranteed to work.

Use `document.modelContext`. Feature-detect it. Show the DevTools WebMCP panel in the video for five seconds.

## 5. Video plan (2 minutes 30 seconds)

| Time | Content |
|---|---|
| 0:00 to 0:10 | One sentence problem. One sentence pitch. Show the site. |
| 0:10 to 1:00 | Full flow. Volunteer types "I have 20 minutes and speak Spanish." Agent finds, opens, drafts. Volunteer edits one word. |
| 1:00 to 1:40 | Agent validates. One error. Agent fixes. Submit tool appears. DevTools panel shows it register. Volunteer clicks confirm. |
| 1:40 to 2:10 | Reviewer approves. Star lights up. |
| 2:10 to 2:30 | Why WebMCP: session, live state, tools that appear when earned, human confirms. Stack in one line. |

Captions on. Screencast plus voice. Script written before code.

## 6. Hour plan

| Hours | Work |
|---|---|
| 0 to 1 | Confirm ChatGPT desktop browser calls a hello-world tool. Or Chrome flag plus agent. Do not skip this. |
| 1 to 5 | Single-page app. Seeded data. Workspace editor. Six tools. Dynamic submit registration. |
| 5 to 7 | Constellation SVG. Reviewer view. |
| 7 to 8 | Deploy to Netlify or Vercel. Live URL works. |
| 8 to 9 | Repo public. MIT license at root. README with setup steps. |
| 9 to 11 | Record video. Three takes. Upload to YouTube. |
| 11 to 12 | Submission text. Four required points. Submit. |
| Buffer | About 25 hours for sleep, breakage, and polish. Submit by Sep 3, 11:00 PM IST at the latest. |

## 7. Submission text: four required points

1. **Fit to WebMCP.** Tools mirror the volunteer's task. Tools appear only when page state allows. Agent runs in the volunteer's session.
2. **User experience.** Removes the uncertainty that stops people from helping. Twenty minutes becomes one verified contribution.
3. **Capabilities for humans and agents.** Humans: see and edit every step, confirm every write. Agents: structured discovery, validation feedback, progressive tool disclosure.
4. **Implementation.** Six `document.modelContext` tools. Dynamic registration keyed to workspace state. Chrome Translator API for draft. Static host.

## 8. Risks

- Agent runtime does not call tools on your machine. Test in hour one.
- Deadline math. Submit by Sep 3, 11:00 PM IST (10:30 AM PDT). Not at the wire.
- Fake org reads as fake. Use a real, named public document as the source text. Attribute it.
- Translator API unavailable. Fall back to a seeded draft. The demo point is the tool flow, not the translation quality.

## 9. If the narrowed quest idea feels too big

Fallback: the adversarial red-team demo from doc 04, idea 8. Self-contained. No content needed. Scores high on Leverage and Creativity. Lower on Impact. Choose by hour two. Do not switch after.
