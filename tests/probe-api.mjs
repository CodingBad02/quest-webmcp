import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-features=WebMCP'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
await page.goto('file:///private/tmp/claude-501/-Users-manjunathanr-Personal-Community-WebMCP/4f94352a-94f0-47ee-9a7a-c0de0a487ac6/scratchpad/probe.html'); console.log(await page.textContent('body'));
const out = await page.evaluate(async () => {
  const out = {};
  const mc = document.modelContext;
  out.hasMC = !!mc;
  if (!mc) return out;
  out.proto = Object.getOwnPropertyNames(Object.getPrototypeOf(mc));
  out.navKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(navigator)).filter(k => /model|context|tool/i.test(k));
  out.winKeys = Object.getOwnPropertyNames(window).filter(k => /model|context|tool|mcp/i.test(k));
  const ac = new AbortController();
  try {
    const r1 = await mc.registerTool({
      name: 'hello', description: 'Say hello', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      annotations: { readOnlyHint: true },
      async execute(input, ctx) { return { content: [{ type: 'text', text: 'hi ' + JSON.stringify(input) + ' ctxKeys=' + Object.keys(ctx || {}).join(',') }] }; }
    }, { signal: ac.signal });
    out.registerReturn = String(r1);
  } catch (e) { out.registerErr = String(e); }
  try { const t = await mc.getTools(); out.getTools = JSON.stringify(t).slice(0, 500); out.getToolsType = Object.prototype.toString.call(t); } catch (e) { out.getToolsErr = String(e); }
  for (const arg of ['hello', { name: 'hello' }]) {
    try { const r = await mc.executeTool(arg, JSON.stringify({ name: 'quest' })); out['executeTool_' + typeof arg] = JSON.stringify(r).slice(0, 300); } catch (e) { out['executeErr_' + typeof arg] = String(e); }
  }
  try { ac.abort(); const t2 = await mc.getTools(); out.afterAbort = JSON.stringify(t2).slice(0, 200); } catch (e) { out.afterAbortErr = String(e); }
  out.unregisterType = typeof mc.unregisterTool;
  out.provideContextType = typeof mc.provideContext;
  return out;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
