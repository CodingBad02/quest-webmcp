// End-to-end check in real Chrome with WebMCP enabled.
// Calls tools through document.modelContext.executeTool, the same path a browser agent uses.
// Usage: node tests/e2e.mjs [baseUrl]   (default http://localhost:4173)
// The store and Survey are fixed at http://localhost:8787 (Quest's defaults when no VITE_STORE_URL
// / VITE_SURVEY_URL is set — see src/state/storeClient.ts), matching how the preview is built for this test.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const STORE = 'http://localhost:8787';
const SURVEY_ORIGIN = 'http://localhost:8787';
const SHOTS = 'test-results';
mkdirSync(SHOTS, { recursive: true });

// A 1x1 transparent PNG, for the Survey photo field.
const PNG_PATH = `${SHOTS}/tiny.png`;
writeFileSync(PNG_PATH, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const toolNames = (page) => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
const call = (page, name, args = {}) => page.evaluate(async ([name, args]) => {
  const t = (await document.modelContext.getTools()).find((x) => x.name === name);
  if (!t) return `__NO_TOOL__ ${name}`;
  const r = await document.modelContext.executeTool(t, JSON.stringify(args));
  return JSON.parse(r).content[0].text;
}, [name, args]);
const rackNames = (page) => page.$$eval('.qt-rack-list .qt-tool:not([data-state="locked"]):not([data-state="removing"]) .qt-tool-name', (els) => els.map((e) => e.textContent).sort());
const rackRow = (page, name) => page.$$eval('.qt-rack-list .qt-tool', (els, name) => {
  const el = els.find((e) => e.querySelector('.qt-tool-name')?.textContent === name);
  return el ? { state: el.dataset.state, desc: el.querySelector('.qt-tool-desc')?.textContent ?? '' } : null;
}, name);
const envelope = (text) => JSON.parse(text.slice(text.lastIndexOf('quest/1 ') + 8));

/** Poll the reviewer queue's DOM until `id` shows up as a pending item, or the timeout passes.
 *  The store is shared, so "some tool is registered" is not proof our own item arrived — this is. */
async function waitForPendingId(page, id, timeoutMs = 5000) {
  const start = Date.now();
  let ids = await page.$$eval('.review-head code', (els) => els.map((e) => e.textContent)).catch(() => []);
  while (!ids.includes(id) && Date.now() - start < timeoutMs) {
    await page.waitForTimeout(250);
    ids = await page.$$eval('.review-head code', (els) => els.map((e) => e.textContent)).catch(() => []);
  }
  return ids;
}

/** Poll the sky's data-approved count until it reaches `expected`, or the timeout passes. Never
 *  throws: a quest that Overpass returned outside the sky panel's fixed slice (buildCampaigns,
 *  a pre-existing v1 cap) never lights a star, so this degrades to a clear FAIL, not a crash. */
async function waitForApprovedCount(page, expected, timeoutMs = 5000) {
  const start = Date.now();
  let val = Number(await page.$eval('.sky-root', (e) => e.dataset.approved));
  while (val !== expected && Date.now() - start < timeoutMs) {
    await page.waitForTimeout(200);
    val = Number(await page.$eval('.sky-root', (e) => e.dataset.approved));
  }
  return val;
}


const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-features=WebMCP'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const vol = await ctx.newPage();
vol.on('pageerror', (e) => console.log('[vol pageerror]', e.message));
vol.on('console', (m) => { if (m.type() === 'error') console.log('[vol console.error]', m.text()); });

await vol.goto(BASE);
await vol.evaluate(() => localStorage.clear());
await vol.reload();
await vol.waitForSelector('.cards .card', { timeout: 20000 });
await vol.screenshot({ path: `${SHOTS}/01-quests.png` });

const hasMC = await vol.evaluate(() => 'modelContext' in document);
check('0. document.modelContext present', hasMC);

let names = await toolNames(vol);
check('1. Fresh load registers find-quests and open-quest only', JSON.stringify(names) === JSON.stringify(['find-quests', 'open-quest']), names.join(','));
check('2. Rack matches registered tools', JSON.stringify(await rackNames(vol)) === JSON.stringify(names), (await rackNames(vol)).join(','));

await vol.fill('#name', 'Priya');
const found = await call(vol, 'find-quests', { minutesAvailable: 20, skills: ['phone'], type: 'verify-hours' });
check('3. find-quests returns a ranked list under 1500 chars', found.startsWith('Found') && found.length < 1500, found.split('\n')[1]?.slice(0, 80));
const id = found.match(/id=(\S+)/)?.[1];

const opened = await call(vol, 'open-quest', { id });
await vol.waitForSelector('.workspace');
names = await toolNames(vol);
check('4. open-quest adds check-contribution', names.includes('check-contribution') && !names.includes('submit-contribution'), opened.slice(0, 60));
const openedEnvelope = envelope(opened);
check('4b. open-quest machine line reports state open with a questId', openedEnvelope.state === 'open' && Boolean(openedEnvelope.questId), JSON.stringify(openedEnvelope));
await vol.screenshot({ path: `${SHOTS}/02-workspace.png` });

const notReady = await call(vol, 'check-contribution');
check('5. check on an empty form returns actionable errors', notReady.startsWith('Not ready') && /opening_hours/.test(notReady), notReady.split('\n')[1]);

// Human does the work.
await vol.fill('#oh', 'Mo-Sa 09:00-21:00; Su 10:00-18:00');
await vol.selectOption('#vb', 'phone');
await vol.fill('#note', 'Called at 4 pm. Manager confirmed. Closed second Saturday.');
const ready = await call(vol, 'check-contribution');
await vol.waitForSelector('.qt-tool-name:text("submit-contribution")');
names = await toolNames(vol);
check('6. check passes and submit-contribution appears', ready.startsWith('Ready') && names.includes('submit-contribution'), names.join(','));
await vol.waitForTimeout(700);
await vol.screenshot({ path: `${SHOTS}/03-checked-rack.png` });

// Agent calls submit. Tool waits for the human click.
const submitPromise = call(vol, 'submit-contribution');
await vol.waitForSelector('dialog.qt-confirm[open]', { timeout: 5000 });
await vol.screenshot({ path: `${SHOTS}/04-confirm.png` });
await vol.waitForTimeout(800);
const stillPending = await Promise.race([submitPromise.then(() => 'resolved'), vol.waitForTimeout(300).then(() => 'pending')]);
check('7a. submit waits for the human click', stillPending === 'pending');
await vol.click('dialog.qt-confirm .qt-btn-primary');
const submitted = await submitPromise; await vol.waitForTimeout(300);
names = await toolNames(vol);
check('7b. submit succeeds after the click and unregisters check/submit (written to the store)', submitted.startsWith('Submitted') && !names.includes('submit-contribution') && !names.includes('check-contribution'), submitted.slice(0, 70));
await vol.screenshot({ path: `${SHOTS}/05-submitted.png` });

// Reviewer tab. The store is shared and long-lived, so other sessions may already have
// contributions sitting in it — every assertion below is scoped to our own contributionId,
// never to "the queue" being some exact size, so leftover data can't make this flaky.
const cid = envelope(submitted).contributionId;
const rev = await ctx.newPage();
rev.on('pageerror', (e) => console.log('[rev pageerror]', e.message));
await rev.goto(`${BASE}/?role=reviewer`);
await rev.waitForSelector('.review');
await rev.fill('#rname', 'Tom');
const revTools = await toolNames(rev);
check('8a. reviewer tab registers approve-contribution only', JSON.stringify(revTools) === JSON.stringify(['approve-contribution']), revTools.join(','));
await rev.screenshot({ path: `${SHOTS}/06-review-queue.png` });
const pendingBefore = await rev.$$eval('.review-head code', (els) => els.map((e) => e.textContent));
const approvedBeforeHours = Number(await vol.$eval('.sky-root', (e) => e.dataset.approved));
const approved = await call(rev, 'approve-contribution', { contributionId: cid, comment: 'Clear note. Thanks.' });
check('8b. approve-contribution approves by id, through the store', approved.startsWith('Approved'), approved.slice(0, 60));
await rev.waitForTimeout(200);
const pendingAfter = await rev.$$eval('.review-head code', (els) => els.map((e) => e.textContent)).catch(() => []);
check('8c. approve-contribution removes our item from the reviewer queue', pendingBefore.includes(cid) && !pendingAfter.includes(cid), `before=${pendingBefore.length} after=${pendingAfter.length}`);

await vol.bringToFront();
const approvedCount1 = await waitForApprovedCount(vol, approvedBeforeHours + 1, 5000);
const wsState = await vol.$eval('.workspace', (e) => e.dataset.state);
check('8d. volunteer tab lights an approved (outlined) star and shows approved via BroadcastChannel', approvedCount1 === approvedBeforeHours + 1 && wsState === 'approved', `approved=${approvedCount1} state=${wsState}`);
await vol.waitForTimeout(600);
await vol.screenshot({ path: `${SHOTS}/07-approved.png` });

// Offline fallback.
const off = await ctx.newPage();
await off.route('**overpass-api.de/**', (r) => r.abort());
await off.evaluate(() => localStorage.removeItem('quest.overpass.v1')).catch(() => {});
await off.goto(BASE);
await off.evaluate(() => localStorage.removeItem('quest.overpass.v1'));
await off.reload();
await off.waitForSelector('.cards .card', { timeout: 20000 });
const src = await off.$eval('.pill[title="Where quests come from"]', (e) => e.textContent);
check('9. Overpass blocked: quests load from the offline copy', /offline/.test(src), src);
await off.close();

// ---------- Cross-site proof: Quest -> Survey -> Quest (SPEC.md P0 Cross-site proof) ----------

const foundAP = await call(vol, 'find-quests', { type: 'access-photo' });
const apId = foundAP.match(/id=(\S+)/)?.[1];
const openedAP = await call(vol, 'open-quest', { id: apId });
await vol.waitForSelector('.workspace');
const apEnvelope = envelope(openedAP);
check('10. open-quest on an access-photo quest returns a Survey URL and handoff', Boolean(apEnvelope.next?.url?.startsWith(SURVEY_ORIGIN)) && Boolean(apEnvelope.next?.handoff), JSON.stringify(apEnvelope.next));
const checkRow = await rackRow(vol, 'check-contribution');
check("10b. Quest's rack shows check-contribution locked with the Survey message", checkRow?.state === 'locked' && checkRow.desc === 'This quest continues on Survey.', JSON.stringify(checkRow));

const survey = await ctx.newPage();
survey.on('pageerror', (e) => console.log('[survey pageerror]', e.message));
survey.on('console', (m) => { if (m.type() === 'error') console.log('[survey console.error]', m.text()); });
await survey.goto(apEnvelope.next.url);
await survey.waitForSelector('.survey-card');
const surveyTools = await toolNames(survey);
check('11a. Survey lists check-contribution only (submit locked until checked)', JSON.stringify(surveyTools) === JSON.stringify(['check-contribution']), surveyTools.join(','));
const handoffVisible = await survey.isVisible('.qt-handoff');
const handoffText = await survey.$eval('#handoff-text', (e) => e.textContent).catch(() => '');
check('11b. .qt-handoff is visible with "Carried from Quest"', handoffVisible && /Carried from Quest/.test(handoffText ?? ''), handoffText ?? '(missing)');

const invalidSurvey = await call(survey, 'check-contribution');
check('12a. check-contribution on the empty Survey form reports the two missing fields', invalidSurvey.startsWith('Not ready') && /wheelchair/.test(invalidSurvey) && /photo/.test(invalidSurvey), invalidSurvey.split('\n').slice(0, 3).join(' | '));

await survey.selectOption('#wheelchair', 'yes');
await survey.setInputFiles('#photo', PNG_PATH);
await survey.waitForTimeout(300); // the photo field downscales the file asynchronously
const readySurvey = await call(survey, 'check-contribution');
check('12b. check-contribution passes once wheelchair and photo are set', readySurvey.startsWith('Ready'), readySurvey.split('\n')[0]);
const surveyToolsAfter = await toolNames(survey);
check('12c. submit-contribution appears on Survey', surveyToolsAfter.includes('submit-contribution'), surveyToolsAfter.join(','));

const surveySubmitPromise = call(survey, 'submit-contribution');
await survey.waitForSelector('dialog.qt-confirm[open]', { timeout: 5000 });
await survey.waitForTimeout(500);
const stillPendingSurvey = await Promise.race([surveySubmitPromise.then(() => 'resolved'), survey.waitForTimeout(300).then(() => 'pending')]);
check('13a. submit-contribution on Survey waits for the click', stillPendingSurvey === 'pending');
await survey.click('dialog.qt-confirm .qt-btn-primary');
const submittedSurvey = await surveySubmitPromise;
const submittedApEnvelope = envelope(submittedSurvey);
check('13b. submit-contribution on Survey succeeds with a contributionId', submittedSurvey.startsWith('Submitted') && Boolean(submittedApEnvelope.contributionId), submittedSurvey.slice(0, 70));

const contribRes = await fetch(`${STORE}/api/contributions/${submittedApEnvelope.contributionId}`);
const contribData = await contribRes.json();
check('13c. GET /api/contributions/:id reports state submitted, via the Survey origin', contribData.state === 'submitted' && contribData.via === SURVEY_ORIGIN, JSON.stringify({ state: contribData.state, via: contribData.via }));

const pendingIds14 = await waitForPendingId(rev, submittedApEnvelope.contributionId, 5000);
const revTools14 = await toolNames(rev);
check('14a. approve-contribution registers on the reviewer tab within 5s of the cross-site submission', pendingIds14.includes(submittedApEnvelope.contributionId) && revTools14.includes('approve-contribution'), `pending=${pendingIds14.length} tools=${revTools14.join(',')}`);
const approvedBefore = Number(await vol.$eval('.sky-root', (e) => e.dataset.approved));
const approvedAP = await call(rev, 'approve-contribution', { contributionId: submittedApEnvelope.contributionId, comment: 'Clear photo. Thanks.' });
check('14b. approve-contribution approves the Survey submission', approvedAP.startsWith('Approved'), approvedAP.slice(0, 70));

await vol.bringToFront();
const approvedAfter = await waitForApprovedCount(vol, approvedBefore + 1, 6000);
check('14c. volunteer tab sky reports one more approved star within 5s', approvedAfter === approvedBefore + 1, `before=${approvedBefore} after=${approvedAfter}`);
await vol.waitForTimeout(600);
await vol.screenshot({ path: `${SHOTS}/08-cross-site-approved.png` });

const exchangeAgain = await fetch(`${STORE}/api/handoffs/exchange`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: SURVEY_ORIGIN },
  body: JSON.stringify({ handoff: apEnvelope.next.handoff }),
});
check('15. Exchanging the same handoff a second time returns 410', exchangeAgain.status === 410, String(exchangeAgain.status));

// ---------- Wikidata adapter: cite-claim (SPEC.md P0-last Wikidata) ----------

await vol.bringToFront();
const foundCite = await call(vol, 'find-quests', { type: 'cite-claim' });
check('16. find-quests returns a cite-claim quest', foundCite.startsWith('Found') && /\[cite-claim\]/.test(foundCite), foundCite.split('\n')[1]?.slice(0, 80));
const citeId = foundCite.match(/id=(\S+)/)?.[1];

const openedCite = await call(vol, 'open-quest', { id: citeId });
await vol.waitForSelector('#sourceUrl');
const openedCiteEnvelope = envelope(openedCite);
check('17. open-quest opens the cite-claim workspace', openedCiteEnvelope.state === 'open' && openedCiteEnvelope.questId === citeId, JSON.stringify(openedCiteEnvelope));

const invalidCite = await call(vol, 'check-contribution');
check('18. check-contribution on the empty cite-claim form reports three errors', invalidCite.startsWith('Not ready') && /source_url/.test(invalidCite) && /quote/.test(invalidCite) && /confirmed/.test(invalidCite), invalidCite.split('\n').slice(0, 4).join(' | '));

await vol.fill('#sourceUrl', 'https://example.com/');
await vol.fill('#quote', 'The page states the figure clearly in its history section.');
await vol.check('#confirmed');
await vol.screenshot({ path: `${SHOTS}/11-cite-claim-workspace.png` });
const readyCite = await call(vol, 'check-contribution');
check('19. check-contribution passes for a valid source (live urlcheck + Wikidata claim check)', readyCite.startsWith('Ready'), readyCite.split('\n')[0]);
const namesCite = await toolNames(vol);
check('20. submit-contribution appears for the cite-claim quest', namesCite.includes('submit-contribution'), namesCite.join(','));

const citeSubmitPromise = call(vol, 'submit-contribution');
await vol.waitForSelector('dialog.qt-confirm[open]', { timeout: 5000 });
await vol.click('dialog.qt-confirm .qt-btn-primary');
const submittedCite = await citeSubmitPromise;
const submittedCiteEnvelope = envelope(submittedCite);
check('21. submit-contribution succeeds for the cite-claim quest', submittedCite.startsWith('Submitted') && Boolean(submittedCiteEnvelope.contributionId), submittedCite.slice(0, 70));

await rev.bringToFront();
const pendingIdsCite = await waitForPendingId(rev, submittedCiteEnvelope.contributionId, 5000);
check('22. the cite-claim submission reaches the reviewer queue', pendingIdsCite.includes(submittedCiteEnvelope.contributionId), `pending=${pendingIdsCite.length}`);
const approvedCite = await call(rev, 'approve-contribution', { contributionId: submittedCiteEnvelope.contributionId, comment: 'Reliable source. Thanks.' });
check('23. approve-contribution approves the cite-claim submission', approvedCite.startsWith('Approved'), approvedCite.slice(0, 70));

await vol.bringToFront();
await vol.click('.back');
await vol.waitForSelector('.kg-svg', { timeout: 5000 });
await vol.waitForTimeout(400);
const kgApproved = await vol.$$eval('.kg-claim[data-state="approved"]', (els) => els.length);
check('24. the volunteer home knowledge graph shows an approved edge', kgApproved >= 1, `approved edges=${kgApproved}`);
await vol.locator('.kg-svg').scrollIntoViewIfNeeded();
await vol.screenshot({ path: `${SHOTS}/10-knowledge-graph.png` });

// Dark mode shot.
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const dp = await dark.newPage(); await dp.goto(BASE); await dp.waitForSelector('.cards .card, .empty'); await dp.screenshot({ path: `${SHOTS}/09-dark.png` });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
