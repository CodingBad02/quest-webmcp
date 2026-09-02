import { DurableObject } from 'cloudflare:workers';
import type { ExchangeResponse, Handoff, StoredContribution, StoredState } from './shapes.ts';

const MAX_HANDOFF_TTL = 15 * 60;
const MAX_BODY = 3_000_000; // one downscaled photo as a data URL fits

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (status: number, error: string) => json({ error }, status);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const token = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
};

// eslint-disable-next-line no-control-regex
const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/** One instance holds everything. Durable Object storage is strongly consistent, so the reviewer sees a submission the moment it lands. */
export class Store extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    const session = request.headers.get('x-session') ?? '';
    const m = (re: RegExp) => path.match(re);
    let r: RegExpMatchArray | null;

    if (request.method === 'GET' && path === '/contributions') return this.list(url.searchParams.get('state'));
    if (request.method === 'GET' && (r = m(/^\/contributions\/([\w-]+)$/))) {
      const c = await this.ctx.storage.get<StoredContribution>(`c:${r[1]}`);
      return c ? json(c) : fail(404, 'No such contribution.');
    }
    if (request.method === 'PUT' && (r = m(/^\/contributions\/([\w-]+)$/))) return this.upsert(r[1], await this.body(request), session);
    if (request.method === 'POST' && (r = m(/^\/contributions\/([\w-]+)\/review$/))) return this.review(r[1], await this.body(request), session);
    if (request.method === 'POST' && path === '/handoffs') return this.issueHandoff(await this.body(request), session);
    if (request.method === 'POST' && path === '/handoffs/exchange') return this.exchange(await this.body(request), request.headers.get('origin') ?? '');
    return fail(404, 'No such route.');
  }

  private async body(request: Request): Promise<Record<string, unknown>> {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('Body too large.');
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  private async list(state: string | null) {
    const map = await this.ctx.storage.list<StoredContribution>({ prefix: 'c:' });
    const all = [...map.values()].filter((c) => !state || c.state === state).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return json(all);
  }

  /** Create or update a contribution. Only the owning session may write. */
  private async upsert(id: string, b: Record<string, unknown>, session: string) {
    if (!session) return fail(401, 'Missing session.');
    const key = `c:${id}`;
    const existing = await this.ctx.storage.get<StoredContribution>(key);
    if (existing && existing.ownerSession !== session) return fail(403, 'Not your contribution.');
    if (existing && !['open', 'rejected'].includes(existing.state) && b.state !== existing.state) return fail(409, `Cannot change a ${existing.state} contribution.`);
    const quest = (b.quest ?? existing?.quest) as StoredContribution['quest'] | undefined;
    if (!quest?.id || !quest.type) return fail(400, 'quest.id and quest.type are required.');
    const state = (b.state as StoredState) ?? existing?.state ?? 'open';
    if (!['open', 'submitted'].includes(state)) return fail(400, 'A volunteer may set state to open or submitted only.');
    const now = new Date().toISOString();
    const c: StoredContribution = {
      id,
      quest: { ...quest, title: str(quest.title, 120), placeName: str(quest.placeName, 80), license: str(quest.license, 60) || 'Open Database License (ODbL)' },
      ownerSession: session,
      volunteerName: str(b.volunteerName ?? existing?.volunteerName, 40) || 'A volunteer',
      payload: (b.payload as Record<string, unknown>) ?? existing?.payload ?? {},
      state,
      via: str(b.via ?? existing?.via, 80) || undefined,
      createdAt: existing?.createdAt ?? now,
      submittedAt: state === 'submitted' ? now : existing?.submittedAt,
    };
    await this.ctx.storage.put(key, c);
    return json(c, existing ? 200 : 201);
  }

  /** Approve or send back. A different session than the owner. Only submitted contributions. */
  private async review(id: string, b: Record<string, unknown>, session: string) {
    if (!session) return fail(401, 'Missing session.');
    const key = `c:${id}`;
    const c = await this.ctx.storage.get<StoredContribution>(key);
    if (!c) return fail(404, 'No such contribution.');
    if (c.ownerSession === session) return fail(403, 'You cannot review your own contribution.');
    if (c.state !== 'submitted') return fail(409, `Only a submitted contribution can be reviewed. This one is ${c.state}.`);
    const decision = b.decision;
    if (decision !== 'approved' && decision !== 'rejected' && decision !== 'stale') return fail(400, 'decision must be approved, rejected, or stale.');
    const next: StoredContribution = {
      ...c,
      state: decision,
      reviewedAt: new Date().toISOString(),
      reviewerName: str(b.reviewerName, 40) || 'A reviewer',
      reviewComment: str(b.comment, 300) || undefined,
    };
    await this.ctx.storage.put(key, next);
    return json(next);
  }

  /** Mint a short-lived, single-use capability bound to one contribution, one origin, one action. */
  private async issueHandoff(b: Record<string, unknown>, session: string) {
    if (!session) return fail(401, 'Missing session.');
    const c = await this.ctx.storage.get<StoredContribution>(`c:${b.contributionId}`);
    if (!c) return fail(404, 'No such contribution.');
    if (c.ownerSession !== session) return fail(403, 'Not your contribution.');
    let target: string;
    try { target = new URL(String(b.targetOrigin)).origin; } catch { return fail(400, 'targetOrigin must be a URL.'); }
    const ttl = Math.min(Number(b.ttlSeconds) || 300, MAX_HANDOFF_TTL);
    const t = token();
    const h: Handoff = { hash: await sha256(t), contributionId: c.id, targetOrigin: target, action: 'contribute', expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), used: false };
    await this.ctx.storage.put(`h:${h.hash}`, h);
    return json({ handoff: t, expiresAt: h.expiresAt }, 201);
  }

  /** The receiving origin trades the token for canonical state. Once. Before expiry. From the bound origin only. */
  private async exchange(b: Record<string, unknown>, origin: string) {
    const t = String(b.handoff ?? '');
    if (!t) return fail(400, 'handoff is required.');
    const key = `h:${await sha256(t)}`;
    const h = await this.ctx.storage.get<Handoff>(key);
    if (!h) return fail(404, 'Unknown handoff.');
    if (h.used) return fail(410, 'This handoff was already used.');
    if (Date.parse(h.expiresAt) < Date.now()) return fail(410, 'This handoff expired. Ask your agent to reopen the quest from Quest.');
    if (origin !== h.targetOrigin) return fail(403, 'This handoff is for a different site.');
    const c = await this.ctx.storage.get<StoredContribution>(`c:${h.contributionId}`);
    if (!c) return fail(404, 'The contribution behind this handoff is gone.');
    await this.ctx.storage.put(key, { ...h, used: true });
    const res: ExchangeResponse = { contribution: c, session: c.ownerSession, expiresAt: h.expiresAt };
    return json(res);
  }
}
