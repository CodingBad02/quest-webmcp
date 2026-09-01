import type { QuestEvent } from '../types';

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('quest-events') : null;

export function broadcast(msg: QuestEvent) { channel?.postMessage(msg); }

export function onQuestEvent(handler: (msg: QuestEvent) => void) {
  if (!channel) return () => {};
  const cb = (e: MessageEvent<QuestEvent>) => handler(e.data);
  channel.addEventListener('message', cb);
  return () => channel.removeEventListener('message', cb);
}
