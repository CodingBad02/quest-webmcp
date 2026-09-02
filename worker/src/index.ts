export { Store } from './store.ts';

interface Env {
  STORE: DurableObjectNamespace;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS: string;
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const self = new URL(request.url).origin;
  const allowed = [self, ...env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)];
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'access-control-allow-origin': ok ? origin : self,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-session',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

const BLOCKED_HOSTS = /(^|\.)(wikidata|wikipedia|wikimedia)\.org$/i;

/** Is this a source a reviewer can open? https, public host, reachable, not a Wikimedia page (circular).
 *  Returns the page title so the volunteer can confirm it is the page they meant. */
async function urlCheck(raw: string, headers: Record<string, string>): Promise<Response> {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json' } });
  let u: URL;
  try { u = new URL(raw); } catch { return json({ ok: false, reason: 'Not a URL.' }); }
  if (u.protocol !== 'https:') return json({ ok: false, reason: 'Use an https link.' });
  if (BLOCKED_HOSTS.test(u.hostname)) return json({ ok: false, reason: 'A Wikimedia page cannot be its own source.' });
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || !u.hostname.includes('.')) return json({ ok: false, reason: 'Not a public host.' });
  try {
    const res = await fetch(u.toString(), { redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Quest/0.1 (source check)', accept: 'text/html,*/*' } });
    const type = res.headers.get('content-type') ?? '';
    let title = '';
    if (type.includes('text/html')) {
      const text = (await res.text()).slice(0, 200_000);
      title = text.match(/<title[^>]*>([^<]{1,200})/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
    }
    return json({ ok: res.ok, status: res.status, contentType: type.split(';')[0], title, finalUrl: res.url, reason: res.ok ? undefined : `The page returned ${res.status}.` });
  } catch (e) {
    return json({ ok: false, reason: `Could not reach the page. ${(e as Error).name === 'TimeoutError' ? 'It took over 6 seconds.' : ''}`.trim() });
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/api/urlcheck') return urlCheck(url.searchParams.get('url') ?? '', headers);
    const stub = env.STORE.get(env.STORE.idFromName('main'));
    const res = await stub.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
