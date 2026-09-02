import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestTools, formatResult, parseResult, result, LIMITS, TOOL_NAMES, VERBS } from '../src/index.ts';
import type { ConfirmOutcome, QuestToolsConfig } from '../src/index.ts';

// ---------- a fake document.modelContext ----------

interface Registered { name: string; description: string; inputSchema: { properties?: Record<string, { description?: string }> }; execute: (input: Record<string, unknown>, o?: { signal?: AbortSignal }) => Promise<{ content: { text: string }[] }> }

function fakeModelContext() {
  const tools = new Map<string, Registered>();
  return {
    tools,
    async registerTool(tool: Registered, opts?: { signal?: AbortSignal }) {
      tools.set(tool.name, tool);
      opts?.signal?.addEventListener('abort', () => tools.delete(tool.name));
    },
    async getTools() { return [...tools.values()]; },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function harness(over: Partial<QuestToolsConfig> = {}) {
  const mc = fakeModelContext();
  const calls: string[] = [];
  let ready = false;
  let outcome: ConfirmOutcome = 'confirmed';
  const state = { open: false, checked: false, submitted: 0 };
  const controller = createQuestTools({
    protocol: 'quest/1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelContext: mc as any,
    confirmTimeoutMs: 50,
    operations: {
      find: () => { calls.push('find'); return result('available', 'Found 1 quest: q1'); },
      open: ({ id }) => { calls.push('open'); state.open = true; return result('open', `Opened ${id}`, { questId: id }); },
      check: () => {
        calls.push('check');
        if (!ready) return result('invalid', 'Fix: hours missing.');
        state.checked = true;
        return { ...result('checked', 'Ready.'), confirm: { summary: [['Opening hours', 'Mo-Fr 08:00-17:00']], destination: 'Quest\'s review queue', visibility: 'Held for review. Not public yet.', license: 'ODbL' } };
      },
      submit: () => { calls.push('submit'); state.submitted++; return result('submitted', 'Submitted.', { contributionId: 'c1' }); },
      approve: ({ contributionId }) => { calls.push('approve'); return result('approved', `Approved ${contributionId}.`, { contributionId }); },
    },
    available: () => ({
      find: true,
      open: true,
      check: state.open ? true : { locked: 'Unlocks when a quest is open.' },
      submit: state.checked ? true : { locked: 'Unlocks after check-contribution passes.' },
    }),
    confirm: async (content, { signal }) => {
      calls.push(`confirm:${content.summary[0][1]}`);
      if (signal.aborted) return 'cancelled';
      return outcome;
    },
    ...over,
  });
  return { mc, controller, calls, state, setReady: (v: boolean) => { ready = v; }, setOutcome: (o: ConfirmOutcome) => { outcome = o; } };
}

// ---------- tests ----------

test('exact tool names, all within character budgets', () => {
  assert.deepEqual(Object.values(TOOL_NAMES).sort(), ['approve-contribution', 'check-contribution', 'find-quests', 'open-quest', 'submit-contribution']);
  const { mc, controller } = harness({ available: () => ({ find: true, open: true, check: true, submit: true, approve: true }) });
  controller.refresh();
  assert.equal(mc.tools.size, 5);
  for (const t of mc.tools.values()) {
    assert.ok(t.name.length <= LIMITS.name, t.name);
    assert.ok(t.description.length <= LIMITS.description, t.name);
    for (const p of Object.values(t.inputSchema.properties ?? {})) assert.ok((p.description?.length ?? 0) <= LIMITS.paramDescription);
  }
  controller.destroy();
});

test('registration follows available(): locked verbs appear in the rack but not in the runtime', async () => {
  const { mc, controller, setReady } = harness();
  controller.refresh();
  assert.deepEqual([...mc.tools.keys()].sort(), ['find-quests', 'open-quest']);
  assert.deepEqual(controller.getRack().map((r) => `${r.name}:${r.status}`), [
    'find-quests:new', 'open-quest:new', 'check-contribution:locked', 'submit-contribution:locked',
  ]);
  assert.equal(controller.getRack()[2].reason, 'Unlocks when a quest is open.');

  await controller.run('open', { id: 'q1' });
  controller.refresh();
  assert.ok(mc.tools.has('check-contribution'));
  assert.ok(!mc.tools.has('submit-contribution'));

  setReady(true);
  await controller.run('check');
  controller.refresh();
  assert.ok(mc.tools.has('submit-contribution'));
  controller.destroy();
});

test('running a locked or hidden verb returns an actionable invalid result', async () => {
  const { controller } = harness();
  const locked = await controller.run('check');
  assert.equal(locked.ok, false);
  assert.equal(locked.state, 'invalid');
  assert.match(locked.message, /Unlocks when a quest is open/);
  const hidden = await controller.run('approve', { contributionId: 'c1' });
  assert.match(hidden.message, /not available right now/);
  controller.destroy();
});

test('envelope: format is under the output budget and parses back', () => {
  const r = result('open', 'x'.repeat(3000), { questId: 'q1', next: { url: 'https://survey.example/q/1', handoff: 'h_abc' } });
  const text = formatResult(r);
  assert.ok(text.length <= LIMITS.output);
  const back = parseResult(text)!;
  assert.equal(back.protocol, 'quest/1');
  assert.equal(back.state, 'open');
  assert.equal(back.questId, 'q1');
  assert.deepEqual(back.next, r.next);
  assert.ok(back.message.endsWith('…'));
  assert.equal(parseResult('no envelope here'), null);
});

test('submit: check, confirm, check again, submit. Declined never submits', async () => {
  const { controller, calls, state, setReady, setOutcome } = harness();
  await controller.run('open', { id: 'q1' });
  setReady(true);
  await controller.run('check');
  calls.length = 0;

  setOutcome('declined');
  let r = await controller.run('submit');
  assert.equal(r.state, 'declined');
  assert.equal(r.message, 'Kept editing. Nothing was sent.');
  assert.deepEqual(calls, ['check', 'confirm:Mo-Fr 08:00-17:00']);
  assert.equal(state.submitted, 0);

  calls.length = 0;
  setOutcome('timeout');
  r = await controller.run('submit');
  assert.equal(r.state, 'declined');
  assert.match(r.message, /No response in \d+ seconds/);
  assert.equal(state.submitted, 0);

  calls.length = 0;
  setOutcome('confirmed');
  r = await controller.run('submit');
  assert.equal(r.state, 'submitted');
  assert.equal(r.contributionId, 'c1');
  assert.deepEqual(calls, ['check', 'confirm:Mo-Fr 08:00-17:00', 'check', 'submit']);
  controller.destroy();
});

test('submit: a draft that stops validating after confirmation is not submitted', async () => {
  let checks = 0;
  let submitted = 0;
  const { controller } = harness({
    confirm: async () => 'confirmed',
    operations: {
      check: () => { checks++; return checks === 1 ? { ...result('checked', 'Ready.'), confirm: { summary: [['a', 'b']], destination: 'd', visibility: 'v', license: 'l' } } : result('invalid', 'The form changed.'); },
      submit: () => { submitted++; return result('submitted', 'Submitted.'); },
    },
    available: () => ({ check: true, submit: true }),
  });
  const r = await controller.run('submit');
  assert.equal(r.state, 'invalid');
  assert.equal(checks, 2);
  assert.equal(submitted, 0);
  controller.destroy();
});

test('submit via UI click skips the dialog but still revalidates', async () => {
  const { controller, calls, setReady } = harness();
  await controller.run('open', { id: 'q1' });
  setReady(true);
  await controller.run('check');
  calls.length = 0;
  const r = await controller.run('submit', {}, { viaUi: true });
  assert.equal(r.state, 'submitted');
  assert.deepEqual(calls, ['check', 'submit']);
  controller.destroy();
});

test('one pending confirmation per page', async () => {
  let release!: (o: ConfirmOutcome) => void;
  const { controller, setReady } = harness({ confirm: () => new Promise<ConfirmOutcome>((res) => { release = res; }) });
  await controller.run('open', { id: 'q1' });
  setReady(true);
  await controller.run('check');
  const first = controller.run('submit');
  await sleep(5);
  const second = await controller.run('submit');
  assert.equal(second.state, 'declined');
  assert.match(second.message, /current confirmation first/);
  release('confirmed');
  assert.equal((await first).state, 'submitted');
  controller.destroy();
});

test('cancellation: an aborted signal reaches confirm and yields declined', async () => {
  const { controller, setReady } = harness();
  await controller.run('open', { id: 'q1' });
  setReady(true);
  await controller.run('check');
  const ac = new AbortController();
  ac.abort();
  const r = await controller.run('submit', {}, { signal: ac.signal });
  assert.equal(r.state, 'declined');
  assert.equal(r.message, 'Cancelled. Nothing was sent.');
  controller.destroy();
});

test('UI and tool call the same function: the runtime tool returns the formatted run() result', async () => {
  const { mc, controller } = harness();
  controller.refresh();
  const tool = mc.tools.get('find-quests')!;
  const viaTool = parseResult((await tool.execute({})).content[0].text)!;
  const viaUi = await controller.run('find', {}, { viaUi: true });
  assert.deepEqual(viaTool, viaUi);
  controller.destroy();
});

test('a tool that unregisters itself mid-execution is aborted only after its result returns', async () => {
  const { mc, controller, state, setReady } = harness();
  await controller.run('open', { id: 'q1' });
  setReady(true);
  controller.refresh();
  const check = mc.tools.get('check-contribution')!;
  // Executing check makes submit available; simulate the app calling refresh() from its store subscription.
  const p = check.execute({}).then((r) => { controller.refresh(); return r; });
  const r = await p;
  assert.ok(parseResult(r.content[0].text));
  assert.ok(state.checked);
  await sleep(10);
  assert.ok(mc.tools.has('check-contribution'), 'check stays registered while still available');
  controller.destroy();
});

test('every verb is optional: a site with only approve registers only approve', () => {
  const { mc, controller } = harness({ operations: { approve: () => result('approved', 'ok') }, available: () => ({ approve: true }) });
  controller.refresh();
  assert.deepEqual([...mc.tools.keys()], ['approve-contribution']);
  assert.equal(VERBS.length, 5);
  controller.destroy();
});
