import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const { chromium } = createRequire(import.meta.url)(process.argv.includes('--playwright') ? arg('--playwright') : 'playwright');
const output = resolve(root, process.argv.includes('--output') ? arg('--output') : 'artifacts/qa/tooltip-header-2026-10-13');
const profile = resolve(root, '.local/browser-profile/tooltip-position', `run-${Date.now()}`);
mkdirSync(output, { recursive: true }); mkdirSync(profile, { recursive: true });
const checks = [], errors = [];
let context, worker, page, version, sequence = 0, slow = false, readingSample = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const long = '## Answer\n\n' + Array.from({ length: 30 }, (_, i) => `Paragraph ${i} explains the synthetic selection in detail.\n\n`).join('');
const readingAnswer = '意外发现美好事物的机缘。\n\n## 在这句话中\n\n指不经意间获得有价值的发现。\n\n- **词义**：偶然遇见美好。\n- 使用 `serendipity` 描述这种机缘。\n\n| 词语 | 含义 |\n| --- | --- |\n| discovery | 发现 |';
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/sample/')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>Floating result QA</title><style>body{margin:0;height:2400px;font:16px Arial}#word{position:absolute;top:300px;left:40px;width:600px}#outside{position:absolute;top:0}</style><button id="outside">Outside</button><p id="word">The bank offers loans. Another sentence spans several lines for a multiline selection.</p>'); return;
  }
  if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); res.end('{}'); return; }
  for await (const chunk of req) { /* Drain synthetic request without saving credentials. */ }
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
  const send = content => res.write('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n');
  const streaming = slow;
  send(streaming ? 'First response.\n\n' : readingSample ? readingAnswer : long);
  if (streaming) { await sleep(900); if (!res.destroyed) send(long); await sleep(600); }
  if (!res.destroyed) res.end('data: [DONE]\n\n');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
async function fresh({ width = 1000, height = 600, top = 300, left = 40, textWidth = 600, multiline = false, stream = false, text = '' } = {}) {
  slow = stream;
  await worker.evaluate(() => CACHE.clear());
  if (page) await page.close();
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height }); await page.goto(`${base}/sample/${sequence++}`);
  await page.waitForFunction(() => typeof chrome !== 'undefined' && !!document.querySelector('#word'));
  await page.evaluate(({ top, left, textWidth, multiline, text }) => {
    const el = document.querySelector('#word'); Object.assign(el.style, { top: `${top}px`, left: `${left}px`, width: `${textWidth}px` });
    if (text) el.textContent = text;
    const range = document.createRange(); range.setStart(el.firstChild, multiline ? 0 : 4); range.setEnd(el.firstChild, multiline ? el.textContent.length : 8);
    window.qaSourceRange = range.cloneRange();
    getSelection().removeAllRanges(); getSelection().addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
  }, { top, left, textWidth, multiline, text });
  await page.locator('#deepseek-explain-tooltip.ds-visible').waitFor();
  if (!stream) await done();
  await sleep(120);
}
const done = () => page.waitForFunction(() => document.querySelector('.ds-actions')?.style.display === 'flex');
async function geometry() {
  return page.evaluate(() => {
    const r = document.querySelector('#deepseek-explain-tooltip').getBoundingClientRect();
    const s = document.querySelector('#word').getBoundingClientRect();
    const selection = window.qaSourceRange?.getBoundingClientRect() || s;
    const pack = r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
    return { tip: pack(r), source: pack(selection), width: innerWidth, height: innerHeight };
  });
}
function fits(g) { assert.ok(g.tip.left >= 9 && g.tip.top >= 9 && g.tip.right <= g.width - 9 && g.tip.bottom <= g.height - 9, JSON.stringify(g)); }
function avoids(g) { fits(g); assert.ok(g.tip.right <= g.source.left || g.tip.left >= g.source.right || g.tip.bottom <= g.source.top || g.tip.top >= g.source.bottom, JSON.stringify(g)); }
async function check(name, fn) {
  try { const evidence = await fn(); checks.push({ name, status: 'passed', evidence }); console.log('PASSED: ' + name); }
  catch (e) { checks.push({ name, status: 'failed', error: e.message }); throw e; }
}
async function drag(dx, dy) {
  const box = await page.locator('.ds-drag-handle').boundingBox();
  await page.mouse.move(box.x + 14, box.y + 12); await page.mouse.down();
  await page.mouse.move(box.x + 14 + dx, box.y + 12 + dy, { steps: 8 }); await page.mouse.up(); await sleep(130);
}
try {
  context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--no-first-run'], ignoreDefaultArgs: ['--disable-extensions'] });
  version = context.browser().version();
  await context.route('**/*', route => route.request().url().startsWith(base) || !route.request().url().startsWith('http') ? route.continue() : route.abort());
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(base => {
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => String(url).startsWith(base) ? nativeFetch(url, init) : Promise.reject(new Error('QA blocks external requests'));
  }, base);
  await worker.evaluate(async base => {
    await chrome.storage.local.clear(); await chrome.storage.local.set(AIConfig.migrate({ apiConfigVersion: 1, modelCatalogVersion: 1, providerConfigVersion: 1,
      enabled: true, triggerMode: 'auto', usePageContext: true, language: 'zh', targetLanguage: 'zh', explainManufacturer: 'custom', translateManufacturer: 'custom',
      explainModel: 'qa-explain', translateModel: 'qa-explain', modelList: ['qa-explain'], providerConnections: { custom: {
        apiBaseUrl: base + '/v1', apiKey: 'position-synthetic-only', availableModels: ['qa-explain'], modelEntries: [], modelsCheckedAt: '2026-10-12' } } }));
  }, base);
  for (const [name, options] of [
    ['Middle selection avoids growing answer', {}], ['Top selection uses bottom', { top: 30 }], ['Bottom selection uses top', { top: 550 }],
    ['Right edge stays visible', { left: 910, textWidth: 80 }], ['Multiline selection uses a side', { top: 170, textWidth: 260, multiline: true }],
    ['375px narrow viewport avoids selection with reduced height', { width: 375, height: 600, left: 15, textWidth: 340 }],
    ['Short landscape viewport', { width: 850, height: 375, top: 155, textWidth: 600 }]
  ]) await check(name, async () => { await fresh(options); const g = await geometry(); avoids(g); await page.screenshot({ path: resolve(output, `${checks.length}.png`) }); return g; });
  await check('Drag preserves selected text and moves result', async () => {
    // 新阅读字号与品牌头部更高；将样本上移，留出35px自由拖动空间。
    await fresh({ top: 30 }); const before = await geometry(), selected = await page.evaluate(() => getSelection().toString());
    await drag(180, 35); const after = await geometry(); fits(after);
    assert.ok(Math.abs(after.tip.left - before.tip.left - 180) < 2, JSON.stringify({before,after})); assert.ok(Math.abs(after.tip.top - before.tip.top - 35) < 2, JSON.stringify({before,after}));
    assert.equal(await page.evaluate(() => getSelection().toString()), selected); return { before, after, selected };
  });
  await check('Drag clamps to viewport and releases outside header', async () => {
    await drag(2000, 2000); fits(await geometry()); await drag(-2000, -2000); const g = await geometry(); fits(g);
    assert.equal(await page.locator('#deepseek-explain-tooltip').evaluate(el => el.classList.contains('ds-dragging')), false); return g;
  });
  await check('Manual position survives scrolling and window resizing', async () => {
    await fresh({ top: 80 }); await drag(200, 20); const before = await geometry();
    await page.evaluate(() => scrollTo(0, 120)); await sleep(150); const scrolled = await geometry();
    assert.ok(Math.abs(scrolled.tip.top - before.tip.top) < 2); assert.ok(Math.abs(scrolled.tip.left - before.tip.left) < 2);
    await page.setViewportSize({ width: 500, height: 400 }); await sleep(150); const resized = await geometry(); fits(resized); return { before, scrolled, resized };
  });
  await check('Drag during stream persists through growth and completion', async () => {
    await fresh({ top: 30, stream: true }); avoids(await geometry()); await drag(200, 10); const before = await geometry(); await done(); await sleep(150);
    const after = await geometry(); fits(after); assert.ok(Math.abs(after.tip.left - before.tip.left) < 2); assert.ok(Math.abs(after.tip.top - before.tip.top) < 2); return { before, after };
  });
  await check('Header has no move controls or drag label and a click does not expand it', async () => {
    await fresh({ top: 30 }); const initial = await geometry();
    await page.locator('.ds-drag-handle').click();
    const header = page.locator('.ds-header');
    assert.equal(await page.locator('.ds-move-controls, .ds-drag-hint, [data-ds-move]').count(), 0);
    assert.equal((await header.textContent()).includes('拖动'), false);
    assert.equal(await header.locator('button').count(), 1);
    assert.equal(await page.locator('.ds-drag-handle').evaluate(el => el.tagName), 'SPAN');
    const after = await geometry(); assert.ok(Math.abs(after.tip.left - initial.tip.left) < 2); assert.ok(Math.abs(after.tip.top - initial.tip.top) < 2);
    await header.screenshot({ path: resolve(output, 'header.png') });
    return { headerText: (await header.textContent()).trim(), initial, after };
  });
  await check('Cursor is normal on hover and grabbing only while left button is held', async () => {
    const cursor = selector => page.locator(selector).evaluate(el => getComputedStyle(el).cursor);
    const box = await page.locator('.ds-drag-handle').boundingBox();
    await page.mouse.move(box.x + 14, box.y + 12);
    for (const selector of ['.ds-header', '.ds-drag-handle', '.ds-brand', '.ds-drag-handle svg']) assert.equal(await cursor(selector), 'default');
    assert.equal(await cursor('.ds-close'), 'pointer');
    await page.mouse.down(); assert.equal(await cursor('.ds-header'), 'grabbing'); assert.equal(await cursor('.ds-brand'), 'grabbing');
    await page.mouse.move(box.x + 100, box.y + 35); assert.equal(await cursor('.ds-header'), 'grabbing');
    await page.mouse.up(); assert.equal(await cursor('.ds-header'), 'default'); assert.equal(await cursor('.ds-brand'), 'default');
    const g = await geometry(); fits(g);
    await page.screenshot({ path: resolve(output, 'dragged.png') });
    return { hover: 'default', pressedBeforeMotion: 'grabbing', moving: 'grabbing', released: 'default', close: 'pointer', geometry: g };
  });
  await check('Right button on header does not activate dragging', async () => {
    const before = await geometry(), box = await page.locator('.ds-drag-handle').boundingBox();
    await page.mouse.move(box.x + 14, box.y + 12); await page.mouse.down({ button: 'right' });
    assert.equal(await page.locator('.ds-header').evaluate(el => getComputedStyle(el).cursor), 'default');
    assert.equal(await page.locator('#deepseek-explain-tooltip').evaluate(el => el.classList.contains('ds-dragging')), false);
    await page.mouse.up({ button: 'right' }); const after = await geometry();
    assert.ok(Math.abs(after.tip.left - before.tip.left) < 2); assert.ok(Math.abs(after.tip.top - before.tip.top) < 2);
    return { before, after, cursor: 'default' };
  });
  await check('Escape during drag releases capture and prevents reopening', async () => {
    await fresh({ top: 30 }); const box = await page.locator('.ds-drag-handle').boundingBox();
    await page.mouse.move(box.x + 14, box.y + 12); await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 60);
    await page.keyboard.press('Escape'); await page.mouse.up(); await sleep(350);
    assert.equal(await page.locator('#deepseek-explain-tooltip').evaluate(el => el.classList.contains('ds-hidden') && !el.classList.contains('ds-dragging')), true);
    return { hiddenAfterRelease: true };
  });
  await check('New selection discards previous manual position', async () => {
    await fresh({ top: 30 }); await drag(200, 20); await page.keyboard.press('Escape'); await sleep(320);
    await page.evaluate(() => { const el = document.querySelector('#word'), r = document.createRange(); r.setStart(el.firstChild, 9); r.setEnd(el.firstChild, 15); window.qaSourceRange = r.cloneRange(); getSelection().removeAllRanges(); getSelection().addRange(r); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); });
    await done(); await sleep(150); const g = await geometry(); avoids(g); assert.ok(g.tip.left < 200); return g;
  });
  await check('词条32px/正文18px，三配色与长中英文窄屏换行、按钮可达', async () => {
    readingSample = true;
    const states = [];
    for (const theme of ['cobalt', 'playful', 'vellum']) {
      await worker.evaluate(theme => chrome.storage.local.set({ uiTheme: theme }), theme);
      for (const width of [260, 375, 1000]) {
        await fresh({ width, height: 850, top: 30, left: 15, textWidth: Math.min(width - 30, 600), multiline: true, text: width === 1000 ? 'serendipity' : '在不经意间发现美好事物，也是一种难得的机缘。'.repeat(3) });
        await page.evaluate(() => document.fonts.ready);
        const g = await geometry(); fits(g);
        const type = await page.evaluate(() => {
          const tip = document.querySelector('#deepseek-explain-tooltip'), quote = tip.querySelector('.ds-quote'), body = tip.querySelector('.ds-body'), actions = tip.querySelector('.ds-actions');
          const bounds = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
          return { quote: getComputedStyle(quote).fontSize, body: getComputedStyle(body).fontSize, heading: getComputedStyle(body.querySelector('h2')).fontSize, code: getComputedStyle(body.querySelector('code')).fontSize, quoteFits: quote.scrollWidth <= quote.clientWidth + 1, bodyFits: body.scrollWidth <= body.clientWidth + 1, bounds: bounds(tip), actions: bounds(actions), hostFont: getComputedStyle(document.body).fontFamily };
        });
        assert.equal(type.quote, '32px'); assert.equal(type.body, '18px'); assert.equal(type.heading, '23px'); assert.equal(type.code, '15px');
        assert.ok(type.quoteFits && type.bodyFits, JSON.stringify(type)); assert.equal(type.hostFont, 'Arial');
        assert.ok(type.actions.top >= type.bounds.top && type.actions.bottom <= type.bounds.bottom, JSON.stringify(type));
        await page.locator('.ds-body').evaluate(el => el.scrollTo(0, el.scrollHeight));
        await page.locator('#deepseek-explain-tooltip').screenshot({ path: resolve(output, `${theme}-${width}.png`) });
        states.push({ theme, width, ...type });
      }
    }
    await worker.evaluate(() => chrome.storage.local.set({ uiTheme: 'cobalt' }));
    await fresh({ top: 30, height: 850, multiline: true, text: 'serendipity' }); await page.evaluate(() => document.fonts.ready);
    await page.locator('#deepseek-explain-tooltip').screenshot({ path: resolve(output, 'result.png') });
    readingSample = false;
    return states;
  });
  await check('Close button and outside click still dismiss', async () => {
    await page.locator('.ds-close').click(); await page.locator('#deepseek-explain-tooltip.ds-hidden').waitFor();
    await fresh(); await page.locator('#outside').click(); await page.locator('#deepseek-explain-tooltip.ds-hidden').waitFor();
    assert.deepEqual(errors, []); return { errors };
  });
} finally {
  if (context) await context.close(); server.closeAllConnections(); await new Promise(r => server.close(r));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ date: new Date().toISOString(), timezone: 'Asia/Shanghai', node: process.version,
    browser: version, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
    profile: relative(root, profile), closed: true, checks, boundary: 'Actual isolated Edge extension and pointer events; synthetic page/Key/local SSE. No real supplier tested.' }, null, 2) + '\n');
}
