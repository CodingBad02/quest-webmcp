// End-to-end check in real Chrome with WebMCP enabled.
// Calls tools through document.modelContext.executeTool, the same path a browser agent uses.
// Usage: node tests/e2e.mjs [baseUrl]   (default http://localhost:4173)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = 'test-results';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const toolNames = (page) => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
const call = (page, name, args = {}) => page.evaluate(async ([name, args]) => {
  const t = (await document.modelContext.getTools()).find((x) => x.name === name);
  if (!t) return `__NO_TOOL__ ${name}`;
  const r = await document.modelContext.executeTool(t, JSON.stringify(args));
  return JSON.parse(r).content[0].text;
}, [name, args]);
const rackNames = (page) => page.$$eval('.rack-list .tool:not(.tool-locked):not(.tool-removing):not(.tool-empty) .tool-name', (els) => els.map((e) => e.textContent).sort());

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
await vol.screenshot({ path: `${SHOTS}/02-workspace.png` });

const notReady = await call(vol, 'check-contribution');
check('5. check on an empty form returns actionable errors', notReady.startsWith('Not ready') && /opening_hours/.test(notReady), notReady.split('\n')[1]);

// Human does the work.
await vol.fill('#oh', 'Mo-Sa 09:00-21:00; Su 10:00-18:00');
await vol.selectOption('#vb', 'phone');
await vol.fill('#note', 'Called at 4 pm. Manager confirmed. Closed second Saturday.');
const ready = await call(vol, 'check-contribution');
await vol.waitForSelector('.tool-name:text("submit-contribution")');
names = await toolNames(vol);
check('6. check passes and submit-contribution appears', ready.startsWith('Ready') && names.includes('submit-contribution'), names.join(','));
await vol.waitForTimeout(700);
await vol.screenshot({ path: `${SHOTS}/03-checked-rack.png` });

// Agent calls submit. Tool waits for the human click.
const submitPromise = call(vol, 'submit-contribution');
await vol.waitForSelector('dialog.confirm[open]', { timeout: 5000 });
await vol.screenshot({ path: `${SHOTS}/04-confirm.png` });
await vol.waitForTimeout(800);
const stillPending = await Promise.race([submitPromise.then(() => 'resolved'), vol.waitForTimeout(300).then(() => 'pending')]);
check('7a. submit waits for the human click', stillPending === 'pending');
await vol.click('dialog.confirm .btn.primary');
const submitted = await submitPromise; await vol.waitForTimeout(300);
names = await toolNames(vol);
check('7b. submit succeeds after the click and unregisters check/submit', submitted.startsWith('Submitted') && !names.includes('submit-contribution') && !names.includes('check-contribution'), submitted.slice(0, 70));
await vol.screenshot({ path: `${SHOTS}/05-submitted.png` });

// Reviewer tab.
const rev = await ctx.newPage();
rev.on('pageerror', (e) => console.log('[rev pageerror]', e.message));
await rev.goto(`${BASE}/?role=reviewer`);
await rev.waitForSelector('.review');
await rev.fill('#rname', 'Tom');
const revTools = await toolNames(rev);
check('8a. reviewer tab registers approve-contribution only', JSON.stringify(revTools) === JSON.stringify(['approve-contribution']), revTools.join(','));
await rev.screenshot({ path: `${SHOTS}/06-review-queue.png` });
const cid = await rev.$eval('.review-head code', (e) => e.textContent);
const approved = await call(rev, 'approve-contribution', { contributionId: cid, comment: 'Clear note. Thanks.' });
check('8b. approve-contribution approves by id', approved.startsWith('Approved'), approved.slice(0, 60));
const revToolsAfter = await toolNames(rev);
check('8c. approve-contribution unregisters when the queue empties', revToolsAfter.length === 0);

await vol.bringToFront();
await vol.waitForSelector('.sky-root[data-lit="1"]', { timeout: 5000 });
const litCount = Number(await vol.$eval('.sky-root', (e) => e.dataset.lit));
const wsState = await vol.$eval('.workspace', (e) => e.dataset.state);
check('8d. volunteer tab lights a star and shows approved via BroadcastChannel', litCount === 1 && wsState === 'approved', `lit=${litCount} state=${wsState}`);
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

// Dark mode shot.
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const dp = await dark.newPage(); await dp.goto(BASE); await dp.waitForSelector('.cards .card, .empty'); await dp.screenshot({ path: `${SHOTS}/08-dark.png` });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
