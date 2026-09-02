import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-features=WebMCP'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => { if (/sky:|three|webgl/i.test(m.text())) console.log('[console]', m.text()); });
await p.goto('http://localhost:5173/'); await p.waitForSelector('.cards .card', { timeout: 20000 }); await p.waitForTimeout(1500);
console.log('canvas count:', await p.$$eval('.sky-root canvas', e => e.length), '| svg fallback:', await p.$$eval('.sky-root svg', e => e.length));
await p.screenshot({ path: 'test-results/dev-hero.png', clip: { x: 0, y: 0, width: 1440, height: 530 } });
await b.close();
