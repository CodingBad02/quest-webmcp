import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-features=WebMCP'] });
const page = await browser.newPage();
await page.goto('file:///private/tmp/claude-501/-Users-manjunathanr-Personal-Community-WebMCP/4f94352a-94f0-47ee-9a7a-c0de0a487ac6/scratchpad/probe.html');
const out = await page.evaluate(async () => {
  const out = {}; const mc = document.modelContext;
  let changes = 0; mc.addEventListener('toolchange', (e) => { changes++; out.eventType = e.constructor.name; });
  const ac = new AbortController();
  await mc.registerTool({ name: 'hello', description: 'Say hello', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    annotations: { readOnlyHint: true },
    async execute(input, ctx) { out.execInputType = typeof input; out.execInput = input; out.ctxKeys = ctx ? Object.getOwnPropertyNames(Object.getPrototypeOf(ctx)).concat(Object.keys(ctx)) : null; return { content: [{ type: 'text', text: 'hi ' + (input && input.name) }] }; }
  }, { signal: ac.signal });
  await new Promise(r => setTimeout(r, 50));
  const tools = await mc.getTools();
  out.toolsLen = tools.length; out.toolProto = Object.getOwnPropertyNames(Object.getPrototypeOf(tools[0]));
  out.tool0 = { name: tools[0].name, description: tools[0].description, inputSchema: tools[0].inputSchema, annotations: tools[0].annotations, origin: tools[0].origin };
  try { const r = await mc.executeTool(tools[0], JSON.stringify({ name: 'quest' })); out.execResult = r; out.execResultType = typeof r; } catch (e) { out.execErr = String(e); }
  try { const r2 = await mc.executeTool(tools[0], { name: 'obj' }); out.execObjResult = r2; } catch (e) { out.execObjErr = String(e); }
  try { const r3 = await mc.executeTool(tools[0], JSON.stringify({})); out.execMissingRequired = r3; } catch (e) { out.execMissingErr = String(e); }
  // long execute
  const ac2 = new AbortController();
  await mc.registerTool({ name: 'slow', description: 'slow', inputSchema: { type: 'object', properties: {} }, async execute() { await new Promise(r => setTimeout(r, 4000)); return { content: [{ type: 'text', text: 'slow done' }] }; } }, { signal: ac2.signal });
  const t2 = (await mc.getTools()).find(t => t.name === 'slow');
  const t0 = Date.now(); try { const r = await mc.executeTool(t2, '{}'); out.slow = { ms: Date.now() - t0, r }; } catch (e) { out.slowErr = String(e); }
  // duplicate name
  try { await mc.registerTool({ name: 'hello', description: 'dup', inputSchema: { type: 'object', properties: {} }, async execute() { return { content: [] }; } }); out.dupOk = true; out.toolsAfterDup = (await mc.getTools()).map(t => t.name); } catch (e) { out.dupErr = String(e); }
  out.changes = changes;
  return out;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
