// Store contract check. Usage: node worker/test/smoke.mjs [baseUrl]   (default http://localhost:8787)
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'http://localhost:8787';
const api = async (method, path, { body, session, origin } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(session ? { 'x-session': session } : {}), ...(origin ? { origin } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const vol = `s_${Math.random().toString(36).slice(2)}`;
const rev = `s_${Math.random().toString(36).slice(2)}`;
const id = `c_${Date.now().toString(36)}`;
const quest = { id: 'q1', type: 'access-photo', title: 'Step-free entry: Test Cafe', placeName: 'Test Cafe', osmRef: 'node/1', osmVersion: 3, license: 'Open Database License (ODbL)' };

let r = await api('PUT', `/contributions/${id}`, { body: { quest, volunteerName: 'Priya' } });
assert.equal(r.status, 401, 'write without session is refused');

r = await api('PUT', `/contributions/${id}`, { body: { quest, volunteerName: 'Priya' }, session: vol });
assert.equal(r.status, 201); assert.equal(r.data.state, 'open');

r = await api('PUT', `/contributions/${id}`, { body: { state: 'submitted' }, session: rev });
assert.equal(r.status, 403, 'another session cannot write my draft');

r = await api('POST', '/handoffs', { body: { contributionId: id, targetOrigin: 'http://localhost:8787', ttlSeconds: 60 }, session: vol });
assert.equal(r.status, 201); const token = r.data.handoff; assert.ok(token.length > 20);

r = await api('POST', '/handoffs/exchange', { body: { handoff: token }, origin: 'https://evil.example' });
assert.equal(r.status, 403, 'wrong origin cannot exchange');

r = await api('POST', '/handoffs/exchange', { body: { handoff: token }, origin: 'http://localhost:8787' });
assert.equal(r.status, 200); assert.equal(r.data.contribution.id, id);
assert.equal(r.data.contribution.ownerSession, undefined, 'the credential never leaves the store');
const grant = r.data.grant; assert.ok(grant && grant !== vol, 'exchange mints a scoped grant, not the owner session');

r = await api('PUT', `/contributions/${id}`, { body: { payload: { wheelchair: 'limited' } }, session: grant });
assert.equal(r.status, 200, 'the grant can write this contribution');
r = await api('PUT', `/contributions/c_other_${id}`, { body: { quest, volunteerName: 'X' }, session: grant });
assert.equal(r.status, 403, 'the grant cannot create another contribution');

r = await api('POST', '/handoffs/exchange', { body: { handoff: token }, origin: 'http://localhost:8787' });
assert.equal(r.status, 410, 'a handoff is single use');

r = await api('PUT', `/contributions/${id}`, { body: { state: 'submitted', payload: { wheelchair: 'yes' }, via: 'http://localhost:8787' }, session: vol });
assert.equal(r.status, 200); assert.equal(r.data.state, 'submitted');
r = await api('PUT', `/contributions/${id}`, { body: { state: 'submitted', payload: { wheelchair: 'no' } }, session: vol });
assert.equal(r.status, 409, 'a submitted contribution is frozen');
r = await api('GET', `/contributions/${id}`);
assert.equal(r.data.payload.wheelchair, 'yes'); assert.equal(r.data.ownerSession, undefined);

r = await api('POST', `/contributions/${id}/review`, { body: { decision: 'approved', reviewerName: 'Tom' }, session: vol });
assert.equal(r.status, 403, 'self-review is refused');

r = await api('GET', '/contributions?state=submitted');
assert.ok(r.data.some((c) => c.id === id), 'submitted contribution is listed for review');

r = await api('POST', `/contributions/${id}/review`, { body: { decision: 'approved', reviewerName: 'Tom' }, session: rev });
assert.equal(r.status, 200); assert.equal(r.data.state, 'approved'); assert.equal(r.data.reviewerName, 'Tom');

r = await api('PUT', `/contributions/${id}`, { body: { state: 'open' }, session: vol });
assert.equal(r.status, 409, 'an approved contribution cannot be reopened');

r = await api('POST', '/handoffs', { body: { contributionId: id, targetOrigin: 'http://localhost:8787', action: 'stage' }, session: rev });
assert.equal(r.status, 201, 'a reviewer can mint a stage handoff for an approved contribution');
r = await api('POST', '/handoffs/exchange', { body: { handoff: r.data.handoff }, origin: 'http://localhost:8787' });
assert.equal(r.status, 200); assert.equal(r.data.action, 'stage'); assert.equal(r.data.grant, undefined, 'stage grants no write capability');

r = await fetch(`${BASE}/api/urlcheck?url=${encodeURIComponent('https://en.wikipedia.org/wiki/Bengaluru')}`).then((x) => x.json());
assert.equal(r.ok, false, 'a Wikimedia page is refused as a source'); assert.match(r.reason, /own source/);
r = await fetch(`${BASE}/api/urlcheck?url=${encodeURIComponent('http://example.com')}`).then((x) => x.json());
assert.equal(r.ok, false, 'http is refused');
for (const bad of ['https://169.254.169.254/latest', 'https://127.0.0.1/', 'https://[::1]/', 'https://0x7f000001/', 'https://intranet/', 'https://printer.local/']) {
  r = await fetch(`${BASE}/api/urlcheck?url=${encodeURIComponent(bad)}`).then((x) => x.json());
  assert.equal(r.ok, false, `${bad} is refused`); assert.match(r.reason, /public host/);
}
r = await fetch(`${BASE}/api/contributions`, { headers: { origin: 'https://evil.example' } });
assert.equal(r.status, 403, 'an unknown browser origin is refused');
r = await fetch(`${BASE}/api/urlcheck?url=${encodeURIComponent('https://example.com/')}`).then((x) => x.json());
assert.equal(r.ok, true, 'a reachable https page passes'); assert.match(r.title, /Example Domain/);

console.log('store smoke: all checks passed');
