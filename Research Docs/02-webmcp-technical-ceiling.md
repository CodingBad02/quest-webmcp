# WebMCP: What Works Today

Research date: 2026-09-02. Primary sources: webmachinelearning/webmcp README, developer.chrome.com/docs/ai/webmcp, chromestatus.com.

## 1. API shape

Use `document.modelContext`. The older `navigator.modelContext` is deprecated. The hackathon rules page also uses `document.modelContext`.

### Imperative API

```js
await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text content of the todo item" }
    },
    required: ["text"]
  },
  annotations: { readOnlyHint: false },
  async execute({ text }, { signal }) {
    await addTodoItemToCollection(text);
    return { content: [{ type: "text", text: `Added: "${text}"` }] };
  }
}, { signal: controller.signal });

document.modelContext.unregisterTool("add-todo");

const tools = await document.modelContext.getTools();
document.modelContext.addEventListener("toolchange", (e) => { /* tools changed */ });
```

Key facts:

- `execute(input, { signal })` receives parsed input and an AbortSignal.
- Return an MCP-style object: `{ content: [{ type: "text", text }] }`.
- `executeTool()` returns `null` when the call causes navigation.
- Tools are page JavaScript. They run in the user's logged-in session.

### Declarative API

```html
<form toolname="reserve-table" tooldescription="Reserve a table at the restaurant">
  <input name="date" toolparamdescription="Date in YYYY-MM-DD" />
  <input name="guests" type="number" toolparamdescription="Number of guests" />
  <button type="submit">Reserve</button>
</form>
```

Extras: `toolautosubmit` attribute, `SubmitEvent.agentInvoked`, `respondWith()`, `:tool-form-active` pseudo-class, `toolactivated` and `toolcanceled` events. Live in the Chrome 149 origin trial.

### Annotations Chrome documents

- `readOnlyHint`: the agent can skip confirmation.
- `untrustedContentHint`: tool output contains user or external content. The agent must treat it with care.

Other MCP hints (`destructiveHint`, `idempotentHint`) may not be implemented. Unverified.

### Cross-origin

- `exposedTo: ["https://origin"]` limits which origins can call a tool.
- Iframes need `allow="tools"` (Permissions Policy). Default is `self`.
- WebMCP is off in any document that relaxes `document.domain`.

## 2. Browser support

| Browser | Status |
|---|---|
| Chrome 146 to 148 | Behind flag only |
| Chrome 149 to 156 | Origin trial. Also flag. |
| Chrome 157 | Target for default-on |
| Edge 150+ | Origin trial |
| Firefox, Safari | No implementation |
| ChatGPT desktop app browser | Supported by default ("Site tools") |

Chrome stable on Sep 2, 2026 is about version 153.

### Enable for a demo

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set to Enabled.
3. Relaunch Chrome.

For a deployed site without flags: register an origin trial token at developer.chrome.com/origintrials and add `<meta http-equiv="origin-trial" content="TOKEN">`.

Chrome DevTools has an experimental WebMCP panel. It lists tools, invokes them, and shows schema errors. Good for a video.

Testing API: `navigator.modelContextTesting.listTools()` and `.executeTool(name, jsonArgs)`.

## 3. Who can call the tools

| Caller | How | Demo use |
|---|---|---|
| Gemini in Chrome | Native. Chrome docs say "will soon support." Rollout is gradual. | Best if you have it. Verify before recording. |
| ChatGPT desktop browser | Native. Listed in implementation-status.md. | Required runtime per hackathon rules. Test first. |
| Page Agent (GoogleChromeLabs) | Generic agent loop. Needs your Gemini API key. | Guaranteed to work. Good fallback. |
| MCP-B extension | Bridges tab tools to Claude Desktop or Cursor. | Shows external MCP client driving a live tab. |
| Chrome DevTools MCP | Scripted `evaluate_script`. Bypasses browser consent UI. | Reliable for CI or scripted demo. |
| Playwright / Puppeteer | No first-class support. Use `page.evaluate()` with the testing API. | Manual. |
| Prompt API (Gemini Nano) | No `tools` field. You must write the dispatch loop. | Possible but DIY. |

## 4. Limits and gotchas

Character budgets from the Chrome security guide:

| Item | Limit |
|---|---|
| Tool description | 500 characters |
| Parameter description | 150 characters |
| Tool or parameter name | 30 characters |
| Tool output | 1,500 characters |

Other limits:

- No hard tool count. Chrome advises fewer, broader tools. Reliability drops past about 20 to 30 tools. Unverified number.
- Tools do not persist across full navigation. Register and unregister as views change.
- The agent sees tool name, description, schema, URL, title, and origin. It does not see the DOM.
- Output is text. No `outputSchema` yet.
- Chrome tells agents to treat every tool as state-changing unless marked otherwise.
- Prompt injection is a real risk. Tool descriptions and outputs can carry hostile text. Chrome: "the probabilistic nature of LLMs makes it impossible to guarantee safety inside the model itself."

## 5. Chrome best practices (quoted)

- "Each tool should handle one distinct task without overlap."
- "Most applications should use static registration to reduce complexity." Use dynamic registration only when tools depend on page state.
- Describe what a tool can do. Not what it must not do.
- Accept natural strings. Use `shipping="Express"`, not `shipping_id=1`.
- "Validate strictly in code, loosely in schema."
- Return errors the agent can act on: "No flight search results found. Search for flights first."
- Update visible UI after each tool call. The agent plans its next step from it.
- Design tools from role-played user conversations. Then write evals from those conversations.

## 6. Reference demos

- GoogleChromeLabs/webmcp-tools: 15 official demos. Flight booking, restaurant, hotel, pizza, smart home, movie tickets, maze game, Page Agent.
- MiguelsPizza/WebMCP (MCP-B): extension plus local bridge to Claude Desktop.
- Angular v22 WebMCP: first framework with built-in support.
- agentk: one JSON Schema powers a command palette and WebMCP tools.
- webmcpify: retrofits an existing app.
- Model Context Tool Inspector: Chrome extension to view live tools.

No public demo combines WebMCP with the on-device Prompt API for tool calling.

## 7. Adjacent Chrome built-in AI APIs

| API | Status |
|---|---|
| Prompt API (`LanguageModel`) | Stable since Chrome 148. No tool-calling field. |
| Summarizer | Stable |
| Translator, Language Detector | Stable |
| Writer, Rewriter | Experimental. Unverified for Sep 2026. |
| Proofreader | Origin trial ended Chrome 145. Status unverified. |

Hardware: desktop only. 4 GB VRAM or 16 GB RAM. No Android or iOS.

## 8. Not possible yet

Do not build on these:

1. Streaming tool output.
2. `outputSchema` or output validation.
3. Native user confirmation primitive. Spec explainers mention `requestUserInteraction()`. Shipping status conflicts across sources. Build your own confirm step in the UI.
4. MCP resources or prompts. WebMCP is tools only.
5. Binary or multimodal tool input and output.
6. First-class Playwright support.
7. Prompt API calling WebMCP tools on its own.
8. Firefox or Safari.
9. Default-on Chrome. Users need a flag or your origin trial token.
10. Gemini in Chrome for every user. Verify on your machine.
11. Tool discovery on sites not open in a tab.

## 9. Demo checklist

1. Chrome 153 with the flag on. Or the ChatGPT desktop app.
2. Register tools with `document.modelContext`.
3. Show the DevTools WebMCP panel listing your tools.
4. Show an agent calling them: Gemini in Chrome, ChatGPT browser, or Page Agent.
5. Feature-detect: `if ("modelContext" in document)`.
