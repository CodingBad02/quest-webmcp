/**
 * WebMCP tool registry. Wraps document.modelContext.
 * Chrome 152 exposes registerTool / getTools / executeTool / toolchange only.
 * Unregister = abort the AbortController passed at registration.
 */
import { useSyncExternalStore } from 'react';

export interface ToolResult { content: { type: 'text'; text: string }[] }

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

interface ModelContext {
  registerTool(tool: ToolDef, opts?: { signal: AbortSignal }): Promise<void>;
  getTools(): Promise<{ name: string; description: string }[]>;
  executeTool(tool: unknown, input: string): Promise<string>;
  addEventListener(type: 'toolchange', cb: () => void): void;
}

export const hasWebMCP = typeof document !== 'undefined' && 'modelContext' in document;
const mc = () => (document as unknown as { modelContext: ModelContext }).modelContext;

export type RackStatus = 'available' | 'new' | 'executing' | 'removing';
export interface RackItem { name: string; description: string; status: RackStatus; since: number }

const controllers = new Map<string, AbortController>();
const executing = new Set<string>();
const deferredAbort = new Set<string>();
let rack: RackItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setRack(next: RackItem[]) { rack = next; emit(); }

export function text(t: string): ToolResult {
  return { content: [{ type: 'text', text: t.length > 1500 ? t.slice(0, 1497) + '...' : t }] };
}

export function registerTool(def: ToolDef) {
  deferredAbort.delete(def.name);
  if (controllers.has(def.name)) return;
  const wrapped: ToolDef = {
    ...def,
    execute: async (input) => {
      executing.add(def.name);
      setRack(rack.map((r) => (r.name === def.name ? { ...r, status: 'executing' } : r)));
      try {
        return await def.execute(input ?? {});
      } finally {
        executing.delete(def.name);
        setRack(rack.map((r) => (r.name === def.name && r.status === 'executing' ? { ...r, status: 'available' } : r)));
        // A tool may unregister itself by changing state. Abort only after the result has left the page.
        if (deferredAbort.has(def.name)) { deferredAbort.delete(def.name); setTimeout(() => abortNow(def.name), 50); }
      }
    },
  };
  const ac = new AbortController();
  controllers.set(def.name, ac);
  if (hasWebMCP) mc().registerTool(wrapped, { signal: ac.signal }).catch((e) => console.warn('registerTool failed', def.name, e));
  setRack([...rack.filter((r) => r.name !== def.name), { name: def.name, description: def.description, status: 'new', since: Date.now() }]);
  setTimeout(() => setRack(rack.map((r) => (r.name === def.name && r.status === 'new' ? { ...r, status: 'available' } : r))), 1400);
}

function abortNow(name: string) {
  const ac = controllers.get(name);
  if (!ac) return;
  ac.abort();
  controllers.delete(name);
  setRack(rack.map((r) => (r.name === name ? { ...r, status: 'removing' } : r)));
  setTimeout(() => setRack(rack.filter((r) => r.name !== name)), 500);
}

export function unregisterTool(name: string) {
  if (!controllers.has(name)) return;
  if (executing.has(name)) { deferredAbort.add(name); return; }
  abortNow(name);
}

/** Make the registered set exactly `names`. Order preserved from `defs`. */
export function syncTools(defs: ToolDef[], names: string[]) {
  for (const n of [...controllers.keys()]) if (!names.includes(n)) unregisterTool(n);
  for (const d of defs) if (names.includes(d.name)) registerTool(d);
}

export function useRack() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => rack, () => rack);
}

export function registeredNames() { return [...controllers.keys()]; }
