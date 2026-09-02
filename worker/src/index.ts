export { Store } from './store.ts';

interface Env {
  STORE: DurableObjectNamespace;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS: string;
}

/** Is this browser origin allowed to call the API? Same origin, the configured list, and localhost only while we are on localhost. */
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // not a browser cross-origin call
  const self = new URL(request.url);
  const allowed = [self.origin, ...env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)];
  if (allowed.includes(origin)) return true;
  return self.hostname === 'localhost' && /^http:\/\/localhost(:\d+)?$/.test(origin);
}

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-session',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

const BLOCKED_HOSTS = /(^|\.)(wikidata|wikipedia|wikimedia)\.org$/i;
const MAX_HOPS = 3;
const MAX_BODY_BYTES = 64_000;

/** Hosts we never fetch: IP literals of any shape, loopback, private, link-local, and single-label names. */
function hostForbidden(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') || h === 'localhost') return true;
  if (/^[\d.]+$/.test(h) || h.includes(':')) return true; // IPv4 or IPv6 literal, in any notation
  if (/\.(local|internal|localhost|home|lan|arpa)$/.test(h)) return true;
  return false;
}

function sourceProblem(u: URL): string | null {
  if (u.protocol !== 'https:') return 'Use an https link.';
  if (BLOCKED_HOSTS.test(u.hostname)) return 'A Wikimedia page cannot be its own source.';
  if (hostForbidden(u.hostname)) return 'Not a public host.';
  if (u.username || u.password) return 'Links with credentials are not accepted.';
  return null;
}

/** Read at most `limit` bytes of a body, then stop. */
async function readPrefix(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(value); total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let o = 0; for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(buf);
}

/** Is this a source a reviewer can open? https, public host, reachable, not a Wikimedia page (circular).
 *  Every redirect hop is checked with the same rules. Returns the page title so the volunteer can confirm the page they meant. */
async function urlCheck(raw: string, headers: Record<string, string>): Promise<Response> {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json' } });
  let u: URL;
  try { u = new URL(raw); } catch { return json({ ok: false, reason: 'Not a URL.' }); }
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const problem = sourceProblem(u);
      if (problem) return json({ ok: false, reason: hop ? `The link redirects to a page we cannot accept. ${problem}` : problem });
      const res = await fetch(u.toString(), { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Quest/0.1 (source check)', accept: 'text/html,*/*' } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return json({ ok: false, reason: `The page returned ${res.status} without a destination.` });
        u = new URL(loc, u);
        continue;
      }
      const type = res.headers.get('content-type') ?? '';
      let title = '';
      if (type.includes('text/html')) {
        const text = await readPrefix(res, MAX_BODY_BYTES);
        title = text.match(/<title[^>]*>([^<]{1,200})/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
      } else {
        await res.body?.cancel().catch(() => {});
      }
      return json({ ok: res.ok, status: res.status, contentType: type.split(';')[0], title, finalUrl: u.toString(), reason: res.ok ? undefined : `The page returned ${res.status}.` });
    }
    return json({ ok: false, reason: 'Too many redirects.' });
  } catch (e) {
    return json({ ok: false, reason: `Could not reach the page. ${(e as Error).name === 'TimeoutError' ? 'It took over 6 seconds.' : ''}`.trim() });
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!originAllowed(request, env)) return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers: { 'content-type': 'application/json' } });
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/api/urlcheck') return urlCheck(url.searchParams.get('url') ?? '', headers);
    const stub = env.STORE.get(env.STORE.idFromName('main'));
    const res = await stub.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
