# @gatherlight/quest-tools

Five WebMCP verbs for human-led civic work. One import makes a site agent-ready for volunteering.

```
find-quests · open-quest · check-contribution · submit-contribution · approve-contribution
```

The agent does logistics. A person does the work and confirms every consequential action. No tool argument ever carries the person's evidence.

## Install

```
npm install @gatherlight/quest-tools
```

Framework-neutral. TypeScript source, ES modules, no runtime dependencies beyond `@mcp-b/webmcp-types` for `document.modelContext` typings.

## Use

```ts
import { createQuestTools, createDialogConfirm, mountRack, result } from '@gatherlight/quest-tools';
import '@gatherlight/quest-tools/qt.css';

const tools = createQuestTools({
  protocol: 'quest/1',
  operations: {
    // Implement only the verbs your site can perform.
    check: () => {
      const errors = validate(form);
      if (errors.length) return result('invalid', `Not ready. Fix these:\n${errors.join('\n')}`);
      return {
        ...result('checked', 'Ready. Ask the volunteer if they want to submit.'),
        confirm: { summary: [['Opening hours', form.hours]], destination: 'Review queue', visibility: 'Held for review. Not public yet.', license: 'ODbL' },
      };
    },
    submit: async () => { const id = await save(form); return result('submitted', 'Sent for review.', { contributionId: id }); },
  },
  // Decides registration on every refresh(). true = registered, { locked } = shown greyed with the reason, false = hidden.
  available: () => ({ check: true, submit: form.checked ? true : { locked: 'Opens after the check passes.' } }),
  confirm: createDialogConfirm(),
});

tools.refresh();                                  // call again whenever page state changes
mountRack(document.querySelector('#rack'), tools); // optional: the capability rack, DESIGN.md §5a markup

// Your own buttons call the same functions the agent calls. A button click is not the confirmation:
// submit still shows the dialog, rechecks, and refuses if the draft changed after the click.
button.onclick = () => tools.run('submit', {}, { viaUi: true });
```

## What the package owns

- **Registration by state.** `available()` is re-read on every `refresh()`; tools appear and disappear with the page. A locked verb shows in the rack with its reason and answers an agent with that reason.
- **The order of submit.** `check` → confirm → `check` again → `submit`. A site cannot skip the confirmation, and a draft that stops validating after the click is not sent.
- **Confirmation.** A native `<dialog>` with the exact summary, destination, visibility, license, `Keep editing` / `Send`. Waits up to 90 s. Decline, timeout, and agent cancellation return distinct results. One pending confirmation per page.
- **The `quest/1` envelope.** Every result is text ending in one machine line: `quest/1 {"ok":true,"state":"checked","questId":"…","next":{"url":"…","handoff":"…"}}`. `parseResult(text)` reads it back. Ten states: `available open invalid checked declined submitted approved rejected stale landed`.
- **Cross-site continuation.** `open` may return `next: { url, handoff }`. The agent navigates; the receiving origin exchanges the handoff and registers its own verbs.
- **Budgets.** Names ≤ 30, descriptions ≤ 500, parameter descriptions ≤ 150, output ≤ 1,500 characters. Enforced at create time and on every result.
- **Untrusted content.** Every tool is annotated `untrustedContentHint`, since any result can carry text a person or another site typed; `safeText()` strips control characters and caps external strings.

## API

| Export | Purpose |
|---|---|
| `createQuestTools(config)` | The controller: `run`, `refresh`, `getRack`, `subscribe`, `registeredNames`, `runtime`, `hasRuntime`, `destroy`. |
| `result(state, message, extra?)` | Build an envelope. `ok` defaults from the state. |
| `formatResult`, `parseResult` | Envelope to text and back. |
| `safeText(value, max?)` | Cap and clean external text. |
| `mountRack(el, controller, opts?)` | Vanilla rack renderer. Returns an unmount function. |
| `createDialogConfirm(root?)` | The default `ConfirmFn`. |
| `TOOL_NAMES`, `VERBS`, `PROTOCOL`, `LIMITS` | Constants. |

Styling: link `@gatherlight/quest-tools/qt.css` and, optionally, override `--qt-*` custom properties on `.qt`. The rack reads as the same instrument on any site; only colour, font family, and radius are yours to change.

## Tests

```
npm test
```

Thirteen contract tests under `node --test`: exact names and budgets, registration by state, envelope round trip, the submit order, one pending confirmation, cancellation, UI and tool parity, optional verbs.

MIT. Part of [Quest](https://github.com/CodingBad02/quest-webmcp).
