import type { ModelContext } from '@mcp-b/webmcp-types';
import { LIMITS, formatResult, result } from './envelope.ts';
import {
  TOOL_NAMES, VERBS,
  type Availability, type InputSchema, type QuestToolResult, type QuestToolsConfig, type QuestToolsController,
  type RackItem, type Verb,
} from './types.ts';

const DESCRIPTIONS: Record<Verb, string> = {
  find: 'Find quests that fit the volunteer\'s time and skills. Returns up to five with ids. Call this first.',
  open: 'Open one quest so the volunteer can do the work. Pass the id from find-quests. May return a URL to continue on a partner site. After this, check-contribution becomes available.',
  check: 'Check the open contribution for missing fields and wrong formats. Returns exactly what to fix, or confirms it is ready. When it passes, submit-contribution becomes available.',
  submit: 'Send the checked contribution for human review. Opens a confirm dialog and waits up to 90 seconds for the volunteer to click. Nothing is sent without that click.',
  approve: 'As the reviewer, approve one submitted contribution after reading it. Pass the id shown in the review queue.',
};

const SCHEMAS: Record<Verb, InputSchema> = {
  find: {
    type: 'object',
    properties: {
      minutesAvailable: { type: 'number', description: 'Minutes the volunteer has right now' },
      skills: { type: 'array', items: { type: 'string' }, description: 'What the volunteer can do, e.g. phone, photo, visit' },
      type: { type: 'string', description: 'Limit to one quest type' },
      remoteOnly: { type: 'boolean', description: 'Only quests that can be done from home' },
    },
  },
  open: { type: 'object', properties: { id: { type: 'string', description: 'Quest id from find-quests' } }, required: ['id'] },
  check: { type: 'object', properties: {} },
  submit: { type: 'object', properties: {} },
  approve: {
    type: 'object',
    properties: {
      contributionId: { type: 'string', description: 'Id from the review queue' },
      comment: { type: 'string', description: 'Optional short note to the volunteer' },
    },
    required: ['contributionId'],
  },
};

/** What a person reads in the rack. Short. The agent reads DESCRIPTIONS instead. */
const LABELS: Record<Verb, string> = {
  find: 'Finds quests near you that fit your time.',
  open: 'Opens one quest.',
  check: 'Checks your entry. Says what to fix.',
  submit: 'Sends it for review. Waits for your click.',
  approve: 'Approves one submission.',
};

const READ_ONLY: Partial<Record<Verb, true>> = { find: true, check: true };

const NEW_SETTLES_MS = 1400;
const REMOVE_AFTER_MS = 500;

export function runtimeDescription(present: boolean): string {
  if (!present) return 'No agent connected. Click the buttons instead.';
  const chrome = typeof navigator !== 'undefined' ? navigator.userAgent.match(/Chrome\/(\d+)/) : null;
  return chrome ? `Agent: Chrome ${chrome[1]}` : 'Agent: detected';
}

function assertBudgets(descriptions: Record<Verb, string>, schemas: Record<Verb, InputSchema>) {
  for (const v of VERBS) {
    if (TOOL_NAMES[v].length > LIMITS.name) throw new Error(`Tool name over ${LIMITS.name} chars: ${TOOL_NAMES[v]}`);
    if (descriptions[v].length > LIMITS.description) throw new Error(`Description over ${LIMITS.description} chars: ${v}`);
    for (const [k, p] of Object.entries(schemas[v].properties ?? {})) {
      if (k.length > LIMITS.name) throw new Error(`Parameter name over ${LIMITS.name} chars: ${k}`);
      if ((p.description?.length ?? 0) > LIMITS.paramDescription) throw new Error(`Parameter description over ${LIMITS.paramDescription} chars: ${v}.${k}`);
    }
  }
}

export function createQuestTools(config: QuestToolsConfig): QuestToolsController {
  if (config.protocol !== 'quest/1') throw new Error(`Unsupported protocol: ${String(config.protocol)}`);
  const descriptions = { ...DESCRIPTIONS, ...config.descriptions } as Record<Verb, string>;
  const schemas = { ...SCHEMAS, ...config.inputSchemas } as Record<Verb, InputSchema>;
  const labels = { ...LABELS, ...config.labels } as Record<Verb, string>;
  assertBudgets(descriptions, schemas);

  const mc: ModelContext | null = config.modelContext === undefined
    ? (typeof document !== 'undefined' ? (document.modelContext ?? null) : null)
    : config.modelContext;
  const timeoutMs = config.confirmTimeoutMs ?? 90_000;

  const controllers = new Map<Verb, AbortController>();
  const executing = new Set<Verb>();
  const deferredAbort = new Set<Verb>();
  const status = new Map<Verb, RackItem['status']>();
  const lockReason = new Map<Verb, string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  let confirming = false;
  let destroyed = false;
  // getRack() must return a stable reference when nothing changed, or a React
  // useSyncExternalStore(controller.subscribe, controller.getRack, controller.getRack) binding
  // re-renders forever. Cache it and invalidate only on emit().
  let rackCache: RackItem[] | null = null;

  const emit = () => { rackCache = null; listeners.forEach((l) => l()); };
  const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  function rack(): RackItem[] {
    if (!rackCache) {
      rackCache = VERBS.filter((v) => status.has(v)).map((v) => ({
        name: TOOL_NAMES[v], description: labels[v], status: status.get(v)!, reason: lockReason.get(v),
      }));
    }
    return rackCache;
  }

  // ---------- running a verb ----------

  async function run(verb: Verb, input: Record<string, unknown> = {}, opts: { viaUi?: boolean; signal?: AbortSignal } = {}): Promise<QuestToolResult> {
    const op = config.operations[verb];
    const name = TOOL_NAMES[verb];
    if (!op) return result('invalid', `This site does not support ${name}.`);
    const avail: Availability = config.available()[verb] ?? false;
    if (avail !== true) {
      return result('invalid', typeof avail === 'object' ? `${name} is locked. ${avail.locked}` : `${name} is not available right now.`);
    }
    const signal = opts.signal ?? new AbortController().signal;
    const ctx = { signal, viaUi: opts.viaUi ?? false };

    if (verb !== 'submit') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (op as any)(input, ctx);
    }

    // submit: check → confirm → check again → submit. The package owns this order; a site cannot skip it,
    // and a button click is not a substitute for the dialog: the person confirms the exact preview either way.
    const check = config.operations.check;
    if (!check) return result('invalid', 'This site cannot check contributions, so it cannot submit them.');
    const first = await check(input, ctx);
    if (!first.ok) return first;
    if (confirming) return result('declined', 'Finish or close the current confirmation first.');
    if (!first.confirm) return result('invalid', 'check-contribution returned no confirmation summary.');
    confirming = true;
    let outcome;
    try { outcome = await config.confirm(first.confirm, { signal, timeoutMs }); } finally { confirming = false; }
    if (outcome === 'declined') return result('declined', 'Kept editing. Nothing was sent.');
    if (outcome === 'timeout') return result('declined', `No response in ${Math.round(timeoutMs / 1000)} seconds. Nothing was sent.`);
    if (outcome === 'cancelled') return result('declined', 'Cancelled. Nothing was sent.');
    const again = await check(input, ctx);
    if (!again.ok) return again;
    // The person confirmed one exact preview. If the draft changed underneath, nothing is sent.
    if (JSON.stringify(again.confirm) !== JSON.stringify(first.confirm)) return result('declined', 'The form changed after you confirmed. Nothing was sent. Check again.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (config.operations.submit as any)(input, ctx);
  }

  // ---------- registration ----------

  function register(verb: Verb) {
    deferredAbort.delete(verb);
    if (controllers.has(verb)) { if (status.get(verb) === 'locked') { status.set(verb, 'available'); lockReason.delete(verb); } return; }
    const ac = new AbortController();
    controllers.set(verb, ac);
    lockReason.delete(verb);
    status.set(verb, 'new');
    later(() => { if (status.get(verb) === 'new') { status.set(verb, 'available'); emit(); } }, NEW_SETTLES_MS);
    if (mc) {
      const tool = {
        name: TOOL_NAMES[verb],
        description: descriptions[verb],
        inputSchema: schemas[verb],
        // Every result can carry text a person or another site typed: place names, notes, quotes, URLs.
        annotations: { readOnlyHint: READ_ONLY[verb] === true, untrustedContentHint: true },
        execute: async (input: Record<string, unknown>, exec?: { signal?: AbortSignal }) => {
          executing.add(verb);
          status.set(verb, 'executing'); emit();
          try {
            const r = await run(verb, input ?? {}, { signal: exec?.signal });
            return { content: [{ type: 'text' as const, text: formatResult(r) }] };
          } finally {
            executing.delete(verb);
            if (status.get(verb) === 'executing') status.set(verb, 'available');
            emit();
            // A tool may unregister itself by changing state. Abort only after the result has left the page.
            if (deferredAbort.has(verb)) { deferredAbort.delete(verb); later(() => { if (config.available()[verb] !== true) abortNow(verb); }, 50); }
          }
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mc.registerTool as any)(tool, { signal: ac.signal }).catch((e: unknown) => console.warn('registerTool failed', TOOL_NAMES[verb], e));
    }
  }

  function abortNow(verb: Verb) {
    const ac = controllers.get(verb);
    if (!ac) return;
    ac.abort();
    controllers.delete(verb);
    status.set(verb, 'removing'); emit();
    later(() => { if (status.get(verb) === 'removing') { status.delete(verb); emit(); } }, REMOVE_AFTER_MS);
  }

  function unregister(verb: Verb) {
    if (!controllers.has(verb)) return;
    if (executing.has(verb)) { deferredAbort.add(verb); return; }
    abortNow(verb);
  }

  function refresh() {
    if (destroyed) return;
    const avail = config.available();
    for (const v of VERBS) {
      const a = avail[v] ?? false;
      if (a === true) register(v);
      else {
        unregister(v);
        if (typeof a === 'object') {
          const st = status.get(v);
          if (st !== 'removing') { status.set(v, 'locked'); lockReason.set(v, a.locked); }
          else later(() => { if (!controllers.has(v) && typeof (config.available()[v]) === 'object') { status.set(v, 'locked'); lockReason.set(v, (config.available()[v] as { locked: string }).locked); emit(); } }, REMOVE_AFTER_MS + 10);
        } else if (status.get(v) === 'locked') { status.delete(v); lockReason.delete(v); }
      }
    }
    emit();
  }

  function destroy() {
    destroyed = true;
    for (const ac of controllers.values()) ac.abort();
    controllers.clear(); status.clear(); lockReason.clear();
    for (const t of timers) clearTimeout(t);
    timers.clear(); listeners.clear();
  }

  return {
    run,
    refresh,
    getRack: rack,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    registeredNames: () => [...controllers.keys()].map((v) => TOOL_NAMES[v]),
    hasRuntime: mc !== null,
    runtime: () => runtimeDescription(mc !== null),
    destroy,
  };
}
