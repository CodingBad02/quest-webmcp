// Live health check for the deployed Quest, Survey, and store endpoints. No browser: plain fetch only.
// Usage: node tests/live.mjs [questUrl] [storeUrl]
import assert from 'node:assert/strict';

const QUEST_URL = (process.argv[2] ?? 'https://gatherlight.netlify.app').replace(/\/$/, '');
const STORE_URL = (process.argv[3] ?? 'https://quest-store.quest-store.workers.dev').replace(/\/$/, '');
const ALLOWED_ORIGIN = new URL(QUEST_URL).origin;
const EVIL_ORIGIN = 'https://evil.example';

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, reason: e.message });
    console.log(`✗ ${name} — ${e.message}`);
  }
}

function findScriptSrc(html) {
  const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  return m ? m[1] : null;
}

await check('Quest index responds 200 and contains <title>Quest', async () => {
  const res = await fetch(`${QUEST_URL}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Quest/);
});

await check('Quest serves its JS bundle', async () => {
  const res = await fetch(`${QUEST_URL}/`);
  const html = await res.text();
  const src = findScriptSrc(html);
  assert.ok(src, 'no <script type="module" src="..."> found in index.html');
  const jsUrl = new URL(src, `${QUEST_URL}/`).toString();
  const jsRes = await fetch(jsUrl);
  assert.equal(jsRes.status, 200, `bundle at ${jsUrl}`);
});

await check('Survey index at storeUrl responds 200 and contains Survey', async () => {
  const res = await fetch(`${STORE_URL}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Survey/);
});

await check('Survey id.html responds 200', async () => {
  const res = await fetch(`${STORE_URL}/id.html`);
  assert.equal(res.status, 200);
});

await check('Store: GET /api/contributions?state=submitted with the allowed Origin returns 200 JSON array', async () => {
  const res = await fetch(`${STORE_URL}/api/contributions?state=submitted`, { headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'response body is not an array');
});

// worker/src/index.ts's originAllowed() treats a request with no Origin header as a non-browser
// call and always allows it; only a mismatched Origin is rejected. A plain fetch never sends an
// Origin header of its own accord, so this call carries none, same as curl or a server-to-server call.
await check('Store: GET /api/contributions without an Origin header returns 200 (no Origin = not a browser cross-origin call)', async () => {
  const res = await fetch(`${STORE_URL}/api/contributions?state=submitted`);
  assert.equal(res.status, 200);
});

await check('Store: GET /api/contributions with a disallowed Origin returns 403', async () => {
  const res = await fetch(`${STORE_URL}/api/contributions?state=submitted`, { headers: { Origin: EVIL_ORIGIN } });
  assert.equal(res.status, 403);
});

// worker/src/index.ts routes /api/urlcheck off a `url` query parameter, not a JSON body.
await check('Store: GET /api/urlcheck?url=... with the allowed Origin returns 200 with ok:true', async () => {
  const res = await fetch(`${STORE_URL}/api/urlcheck?url=${encodeURIComponent('https://example.com/')}`, { headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true, JSON.stringify(body));
});

await check('Store: CORS preflight OPTIONS /api/contributions with the allowed Origin returns Access-Control-Allow-Origin', async () => {
  const res = await fetch(`${STORE_URL}/api/contributions`, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'GET' },
  });
  const allow = res.headers.get('access-control-allow-origin');
  assert.equal(allow, ALLOWED_ORIGIN, `got header: ${allow}`);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
