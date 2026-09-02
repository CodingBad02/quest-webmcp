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

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const stub = env.STORE.get(env.STORE.idFromName('main'));
    const res = await stub.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
