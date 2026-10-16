// 实际 Edge 扩展、隔离配置、合成网页和本机 SSE；不使用真实供应商凭据。
// node scripts/verify-fullpage-toolbar.mjs --playwright <已有包目录> [--edge <msedge.exe>]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const { chromium } = createRequire(import.meta.url)(arg('--playwright'));
const output = resolve(root, 'artifacts/qa/fullpage-toolbar-buttons');
const profile = resolve(root, '.local/browser-profile/fullpage-toolbar', `run-${Date.now()}`);
mkdirSync(output, {recursive: true});
const checks = [], errors = [], pending = [];
let context, worker, page, tabId, browserVersion, requestCount = 0, hold = true;
const server = createServer(async (req, res) => {
  if (req.url === '/sample') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><title>Toolbar synthetic sample</title><style>body{margin:100px 24px;font:18px Arial}p{line-height:1.8}button{width:190px;min-width:190px;flex:1;text-align:left;line-height:30px}</style></head><body><p id="first">First synthetic paragraph.</p><p id="second">Second synthetic paragraph with a <a href="#sample">preserved link</a>.</p></body></html>');
    return;
  }
  if (req.url.endsWith('/models')) {
    res.setHeader('Content-Type', 'application/json');
    res.end('{"data":[{"id":"qa-toolbar"}]}'); return;
  }
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); res.end('{}'); return; }
  requestCount++;
  const body = JSON.parse(raw);
  const items = [...(body.messages[1]?.content || '').matchAll(/<<<DS_ITEM_([A-Za-z0-9_]+)>>>([\s\S]*?)<<<DS_END_\1>>>/g)];
  const answer = items.length ? items.map(item => `<<<DS_ITEM_${item[1]}>>>模拟译文：${item[2].trim()}<<<DS_END_${item[1]}>>>`).join('\n') : '模拟译文。';
  const complete = () => {
    if (res.destroyed) return;
    res.writeHead(200, {'Content-Type': 'text/event-stream'});
    res.end(`data: ${JSON.stringify({choices: [{delta: {content: answer}}]})}\n\ndata: [DONE]\n\n`);
  };
  if (hold) pending.push(complete); else complete();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const release = () => { hold = false; pending.splice(0).forEach(complete => complete()); };
async function check(name, fn) {
  try { await fn(); checks.push({name, status: 'passed'}); console.log('PASSED: ' + name); }
  catch (error) { checks.push({name, status: 'failed', error: error.message}); throw error; }
}
const trigger = () => worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'TRIGGER_FULLPAGE_TRANSLATE'}), tabId);
const progress = () => worker.evaluate(async id => (await chrome.scripting.executeScript({target: {tabId: id}, func: () => window.__dsFullPageTranslator.progress}))[0].result, tabId);
const waitPanel = expanded => page.waitForFunction(expanded => { const panel = document.querySelector('#ds-tb-panel'); return getComputedStyle(panel).opacity === (expanded ? '1' : '0') && (expanded ? panel.getBoundingClientRect().height > 0 : panel.getBoundingClientRect().height < 1); }, expanded);
async function checkButtonLayout() {
  const buttons = await page.locator('#ds-tb-panel button').evaluateAll(elements => elements.map(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const box = el.getBoundingClientRect(), text = range.getBoundingClientRect();
    return {width: box.width, height: box.height, dx: Math.abs(text.x + text.width / 2 - box.x - box.width / 2), dy: Math.abs(text.y + text.height / 2 - box.y - box.height / 2)};
  }));
  for (const button of buttons) {
    assert.ok(button.width < 90 && button.height === 26);
    assert.ok(button.dx < 1 && button.dy < 2);
  }
}
const waitDone = () => page.waitForFunction(() => {
  const [done, total] = document.querySelector('#ds-tb-progress').textContent.split('/').map(Number);
  return total > 0 && done === total;
});
try {
  context = await chromium.launchPersistentContext(profile, {
    ...(process.argv.includes('--edge') ? {executablePath: arg('--edge')} : {channel: 'msedge'}),
    headless: true, viewport: {width: 1000, height: 800},
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--no-first-run'],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  browserVersion = context.browser().version();
  await context.route('**/*', route => !route.request().url().startsWith('http') || route.request().url().startsWith(base) ? route.continue() : route.abort());
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(base => {
    const nativeFetch = fetch;
    globalThis.fetch = (url, init) => String(url).startsWith(base) ? nativeFetch(url, init) : Promise.reject(Error('QA blocks external network'));
  }, base);
  await worker.evaluate(async base => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(AIConfig.migrate({
      apiConfigVersion: 1, modelCatalogVersion: 1, providerConfigVersion: 1, modelList: ['qa-toolbar'],
      enabled: true, triggerMode: 'contextMenu', translateManufacturer: 'custom', explainManufacturer: 'custom',
      translateModel: 'qa-toolbar', explainModel: 'qa-toolbar', targetLanguage: 'zh',
      providerConnections: {custom: {apiBaseUrl: base + '/v1', apiKey: 'synthetic-toolbar-only', availableModels: ['qa-toolbar']}}
    }));
  }, base);
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/sample');
  tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, page.url());
  await check('启动默认展开，保留原文/取消按钮，任务实际进入后台请求', async () => {
    await trigger(); await page.locator('#ds-tb-toggle').waitFor();
    await page.waitForFunction(() => document.querySelector('#ds-tb-progress').textContent.startsWith('0 / ') && document.querySelector('#ds-tb-progress').textContent !== '0 / 0');
    const deadline = Date.now() + 10000;
    while (!requestCount && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(requestCount > 0);
    assert.equal(await page.locator('#ds-tb-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#ds-tb-show-original').isVisible(), true);
    assert.equal(await page.locator('#ds-tb-cancel').isVisible(), true);
    assert.equal(await page.locator('#ds-tb-toggle').textContent(), '');
    const panel = await page.locator('#ds-tb-panel').boundingBox();
    const toggle = await page.locator('#ds-tb-toggle').boundingBox();
    assert.ok(toggle.y >= panel.y + panel.height);
    assert.ok(Math.abs(toggle.x + toggle.width / 2 - 500) < 1);
    await checkButtonLayout();
  });
  await check('方框箭头位于进度栏下方，收起后仅留居中箭头且焦点保留', async () => {
    await page.locator('#ds-tb-toggle').click();
    await waitPanel(false);
    assert.equal(await page.locator('#ds-tb-toggle').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ds-tb-toggle');
    const bounds = await page.locator('#ds-translate-toolbar').boundingBox();
    assert.ok(bounds.height <= 25 && Math.abs(bounds.x + bounds.width / 2 - 500) < 1);
    await page.screenshot({path: resolve(output, 'hidden-running.png')});
  });
  await check('隐藏时继续写入译文及完成计数，工具栏文字不参与翻译', async () => {
    release(); await waitDone();
    assert.match(await page.locator('#first').textContent(), /模拟译文/);
    await waitPanel(false);
    const value = await progress(); assert.equal(value.total, 3); assert.equal(value.failed, 0);
  });
  await check('Enter 重新打开，进度保留，原文/译文切换仍有效', async () => {
    const before = requestCount;
    await page.keyboard.press('Enter');
    await waitPanel(true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ds-tb-toggle');
    assert.equal(requestCount, before);
    await page.locator('#ds-tb-show-original').click();
    assert.equal(await page.locator('#first').textContent(), 'First synthetic paragraph.');
    await page.locator('#ds-tb-show-original').click();
    assert.match(await page.locator('#first').textContent(), /模拟译文/);
    await page.screenshot({path: resolve(output, 'expanded-complete.png')});
  });
  await check('隐藏期间动态新增文字继续翻译，恢复后显示最新计数', async () => {
    await page.locator('#ds-tb-toggle').click();
    await page.evaluate(() => { const p = document.createElement('p'); p.id = 'dynamic'; p.textContent = 'Dynamic synthetic paragraph.'; document.body.append(p); });
    await page.waitForFunction(() => document.querySelector('#dynamic').textContent.includes('模拟译文'));
    await waitDone(); assert.equal((await progress()).total, 4);
    await page.locator('#ds-tb-toggle').click();
    assert.equal(await page.locator('#ds-tb-progress').textContent(), '4 / 4');
  });
  await check('隐藏后再次触发全文翻译仅打开当前进度，不重启任务', async () => {
    await page.locator('#ds-tb-toggle').click();
    const before = requestCount;
    await trigger(); await page.locator('#ds-tb-toggle').waitFor();
    assert.equal(requestCount, before); assert.equal((await progress()).total, 4);
    assert.equal(await page.locator('#ds-translate-toolbar').count(), 1);
  });
  await check('反复隐藏/打开和 Space 键操作，计数及节点保持', async () => {
    const before = requestCount;
    for (let i = 0; i < 5; i++) {
      await page.locator('#ds-tb-toggle').focus(); await page.keyboard.press('Space');
      await waitPanel(false);
      await page.keyboard.press('Space');
      await waitPanel(true);
    }
    assert.equal(requestCount, before); assert.equal((await progress()).total, 4);
  });
  await check('隐藏时三主题同步，恢复按钮及展开控件在 260px/390px 可点击', async () => {
    for (const theme of ['cobalt', 'playful', 'vellum']) {
      await page.locator('#ds-tb-toggle').click();
      await worker.evaluate(theme => chrome.storage.local.set({uiTheme: theme}), theme);
      await page.waitForFunction(theme => document.querySelector('#ds-translate-toolbar').dataset.lcTheme === theme, theme);
      for (const width of [260, 390]) {
        await page.setViewportSize({width, height: 800});
        const bounds = await page.locator('#ds-tb-toggle').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.height === 20);
      }
      await page.mouse.move(10, 700);
      await page.screenshot({path: resolve(output, `${theme}-hidden-narrow.png`), animations: 'disabled'});
      const colors = await page.locator('#ds-tb-toggle').evaluate(el => ({ink: getComputedStyle(el).color, surface: getComputedStyle(el).backgroundColor}));
      assert.deepEqual(colors, {
        cobalt: {ink: 'rgb(17, 17, 17)', surface: 'rgb(253, 250, 231)'},
        playful: {ink: 'rgb(26, 26, 26)', surface: 'rgb(247, 222, 198)'},
        vellum: {ink: 'rgb(232, 216, 92)', surface: 'rgb(52, 63, 128)'}
      }[theme]);
      await page.locator('#ds-tb-toggle').click();
      for (const width of [260, 390]) {
        await page.setViewportSize({width, height: 800});
        const bounds = await page.locator('#ds-tb-toggle').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      }
      await page.screenshot({path: resolve(output, `${theme}-expanded-narrow.png`), animations: 'disabled'});
      await checkButtonLayout();
    }
  });
  await check('取消移除整个进度入口、恢复原文；重新启动默认展开', async () => {
    await page.locator('#ds-tb-cancel').click();
    assert.equal(await page.locator('#ds-translate-toolbar').count(), 0);
    assert.equal(await page.locator('#first').textContent(), 'First synthetic paragraph.');
    assert.equal(await page.locator('#dynamic').textContent(), 'Dynamic synthetic paragraph.');
    await trigger(); await page.locator('#ds-tb-toggle').waitFor(); await waitDone();
    assert.equal(await page.locator('#ds-tb-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#ds-tb-cancel').click();
  });
  await check('桌面宽度为视口三分之一且居中，减少动画偏好即时收起', async () => {
    await trigger(); await waitPanel(true);
    for (const width of [1000, 1440, 1920]) {
      await page.setViewportSize({width, height: 800});
      const bounds = await page.locator('#ds-tb-panel').boundingBox();
      assert.ok(Math.abs(bounds.width - width / 3) < 1);
      assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 1);
      if (width === 1440) {
        await page.screenshot({path: resolve(output, 'desktop-centered.png'), animations: 'disabled'});
        await page.locator('#ds-translate-toolbar').screenshot({path: resolve(output, 'toolbar-detail.png'), animations: 'disabled'});
      }
    }
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.locator('#ds-tb-toggle').click(); await waitPanel(false);
    assert.equal(await page.locator('#ds-tb-panel').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    assert.equal(await page.locator('#ds-tb-panel').getAttribute('inert'), '');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'ds-tb-cancel');
    await page.locator('#ds-tb-toggle').click(); await waitPanel(true);
    await page.locator('#ds-tb-cancel').click();
  });
  await check('没有页面脚本异常', async () => assert.deepEqual(errors, []));
} finally {
  release(); await context?.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({
    timestamp: new Date().toISOString(), baseline: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    pendingFiles: execFileSync('git', ['status', '--short'], {cwd: root, encoding: 'utf8'}).trim(),
    browserVersion, node: process.version, playwright: createRequire(import.meta.url)(resolve(arg('--playwright'), 'package.json')).version,
    profile: relative(root, profile), checks, errors, requestCount,
    limitations: ['真实模型未验证；本机合成 SSE 仅验证交互和请求通路', '使用扩展消息触发，未鼠标点击原生右键菜单']
  }, null, 2) + '\n');
}
