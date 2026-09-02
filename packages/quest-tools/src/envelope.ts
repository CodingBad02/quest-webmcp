import { PROTOCOL, type QuestState, type QuestToolResult } from './types.ts';

export const LIMITS = { name: 30, description: 500, paramDescription: 150, output: 1500 } as const;

export function result(state: QuestState, message: string, extra: Partial<Omit<QuestToolResult, 'protocol' | 'state' | 'message'>> = {}): QuestToolResult {
  const ok = extra.ok ?? !['invalid', 'declined', 'rejected', 'stale'].includes(state);
  return { protocol: PROTOCOL, ok, state, message, ...extra };
}

const MARK = `${PROTOCOL} `;

/** Human message first, then one machine line: `quest/1 {"ok":true,...}`. Always under 1,500 characters. */
export function formatResult(r: QuestToolResult): string {
  const { message, protocol: _p, ...rest } = r;
  let tail = `\n\n${MARK}${JSON.stringify(rest)}`;
  if (tail.length > LIMITS.output - 40) {
    // The machine line itself is oversized (a huge id or url). Keep the state and ok; drop the rest.
    tail = `\n\n${MARK}${JSON.stringify({ ok: rest.ok, state: rest.state })}`;
  }
  const room = LIMITS.output - tail.length;
  const msg = message.length > room ? `${message.slice(0, room - 1)}…` : message;
  return (msg + tail).slice(0, LIMITS.output);
}

export function parseResult(text: string): QuestToolResult | null {
  const i = text.lastIndexOf(`\n${MARK}`);
  if (i < 0) return null;
  try {
    const rest = JSON.parse(text.slice(i + 1 + MARK.length)) as Omit<QuestToolResult, 'protocol' | 'message'>;
    return { protocol: PROTOCOL, message: text.slice(0, i).trimEnd(), ...rest };
  } catch {
    return null;
  }
}

/** External text is untrusted. Strip control characters and cap it. */
export function safeText(s: unknown, max = 120): string {
  // eslint-disable-next-line no-control-regex
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
