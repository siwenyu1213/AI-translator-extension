// 可选 Edge 验收工具。使用外部已有 Playwright，不给扩展添加 npm 依赖。
// node scripts/verify-browser.mjs --playwright <已有包目录> [--edge <msedge.exe>]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv.includes('--playwright') ? arg('--playwright') : 'playwright');
const evidence = resolve(root, 'artifacts/qa');
mkdirSync(evidence, { recursive: true });
const checks = [], requests = [], errors = [];
let browserVersion, context;
const server = createServer(async (req, res) => {
  if (req.url === '/sample') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><title>Extension QA fixture</title></head><body><h1>Browser acceptance fixture</h1><p id="word">ubiquitous</p><p id="paragraph">This is a longer English paragraph used to verify full page translation and preserve original text.</p></body></html>');
    return;
  }
  let payload = ''; for await (const chunk of req) payload += chunk;
  const authenticated = req.headers.authorization === 'Bearer local-qa-only';
  requests.push({ path: req.url, method: req.method, authenticated,
    model: payload ? JSON.parse(payload).model : undefined,
    parameters: payload ? Object.keys(JSON.parse(payload)) : [] });
  if (!authenticated) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":{"message":"invalid test key"}}'); return; }
  if (req.url.endsWith('/models')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [{ id: 'mock-chat' }, { id: 'gateway/model-large' }, { id: 'mock-chat' }] }));
    return;
  }
  if (req.url.endsWith('/chat/completions')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
    for (const token of ['这是', '本机模拟接口的', '流式翻译结果。']) {
      res.write(`data:${JSON.stringify({ choices: [{ delta: { content: token } }] })}\r\n\r\n`);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    res.end('data: [DONE]'); return;
  }
  res.writeHead(404); res.end('{}');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function check(name, fn) {
  try { await fn(); checks.push({ name, status: 'passed' }); console.log('PASSED: ' + name); }
  catch (err) { checks.push({ name, status: 'failed', error: err.message }); throw err; }
}
try {
  context = await chromium.launchPersistentContext(resolve(root, '.local/browser-profile/api-qa'), {
    ...(process.argv.includes('--edge') ? { executablePath: arg('--edge') } : { channel: 'msedge' }),
    headless: true, viewport: { width: 900, height: 1200 },
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--no-first-run'],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  browserVersion = context.browser()?.version();
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 20000 });
  const extensionId = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 1200 });
  popup.on('pageerror', err => errors.push(err.message));
  // Seed only synthetic legacy keys to exercise actual extension storage migration.
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ apiKey: 'legacy-test-only', qwenApiKey: 'legacy-test-only',
      explainModel: 'deepseek-flash', translateModel: 'qwen3.7-flash',
      modelList: ['deepseek-flash', 'qwen3.7-flash', 'retained/custom'], targetLanguage: 'zh' });
  });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.locator('#explain-model option').first().waitFor({ state: 'attached' });
  await check('实际 Edge 加载 MV3 设置页、旧配置迁移和 10 个预设', async () => {
    assert.equal(await popup.locator('#explain-model option').count(), 11);
    assert.equal(await popup.locator('#api-key').inputValue(), '');
    assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get(null)).qwenApiKey), undefined);
    assert.match(await popup.locator('#connection-msg').innerText(), /旧供应商/);
  });
  await check('当前输入连接经实际 runtime 消息获取模型并持久保存', async () => {
    await popup.locator('#api-base-url').fill(`${base}/custom/v1/chat/completions/`);
    await popup.locator('#api-key').fill('local-qa-only');
    await popup.locator('#fetch-models').click();
    await popup.locator('#connection-msg.success').waitFor();
    assert.equal(await popup.locator('#explain-model option').count(), 13);
    const saved = await worker.evaluate(async () => chrome.storage.local.get(['apiBaseUrl', 'apiKey']));
    assert.equal(saved.apiBaseUrl, `${base}/custom/v1`); assert.equal(saved.apiKey, 'local-qa-only');
  });
  await check('无效模型拒绝保存；新增/修改/删除模型同步到两标签', async () => {
    await popup.locator('#explain-custom-new').click();
    await popup.locator('#explain-custom-model').fill('missing-model');
    await popup.locator('#explain-custom-add').click();
    await popup.locator('#explain-model-msg.error').waitFor();
    assert.equal(await popup.locator('#explain-model option[value="missing-model"]').count(), 0);
    await popup.locator('#explain-custom-model').fill('mock-chat');
    await popup.locator('#explain-custom-add').click();
    await popup.locator('#explain-model-msg.success').waitFor();
    await popup.locator('#explain-custom-delete').click();
    await popup.locator('#translate-model option[value="mock-chat"]').waitFor({ state: 'detached' });
    await popup.locator('#explain-custom-new').click();
    await popup.locator('#verify-model').uncheck();
    await popup.locator('#explain-custom-model').fill('local/manual-model');
    await popup.locator('#explain-custom-add').click();
    await popup.locator('#explain-model-msg.success').waitFor();
    assert.equal(await popup.locator('#explain-model').inputValue(), 'local/manual-model');
    await popup.locator('#explain-custom-model').fill('local/renamed-model');
    await popup.locator('#explain-custom-add').click();
    await popup.locator('#translate-model option[value="local/renamed-model"]').waitFor({ state: 'attached' });
    assert.equal(await popup.locator('#explain-model option[value="local/manual-model"]').count(), 0);
  });
  await check('解释/翻译独立保存、重新打开后仍保留；新端点不使用旧配置', async () => {
    await popup.locator('#explain-model').selectOption('local/renamed-model');
    await popup.locator('[data-tab="translate"]').click();
    await popup.locator('#translate-model').selectOption('gateway/model-large');
    await popup.locator('#api-base-url').fill(`${base}/other/v1`);
    await popup.locator('#save-btn').click();
    await popup.locator('#status.success').waitFor();
    await popup.reload();
    await popup.locator('#explain-model option').first().waitFor({ state: 'attached' });
    assert.equal(await popup.locator('#explain-model').inputValue(), 'local/renamed-model');
    assert.equal(await popup.locator('#translate-model').inputValue(), 'gateway/model-large');
    assert.equal(await popup.locator('#api-base-url').inputValue(), `${base}/other/v1`);
    await popup.evaluate(() => window.scrollTo(0, 0));
    await popup.screenshot({ path: resolve(evidence, 'popup-explain.png'), fullPage: true });
    await popup.locator('[data-tab="translate"]').click();
    await popup.evaluate(() => window.scrollTo(0, 0));
    await popup.screenshot({ path: resolve(evidence, 'popup-translate.png'), fullPage: true });
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${base}/sample`);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, `${base}/sample`);
  await check('实际内容脚本划词 → Worker → HTTP SSE → 卡片完整文本和模型 ID', async () => {
    await page.evaluate(() => {
      const p = document.querySelector('#word'), range = document.createRange(); range.selectNodeContents(p);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
    await page.locator('.ds-body').filter({ hasText: '流式翻译结果。' }).waitFor();
    await page.locator('.ds-model-tag').filter({ hasText: 'local/renamed-model' }).waitFor();
    assert.ok(requests.some(req => req.path === '/other/v1/chat/completions' && req.model === 'local/renamed-model' && req.authenticated));
    await page.screenshot({ path: resolve(evidence, 'selection-stream.png') });
    await page.keyboard.press('Escape');
    await page.locator('#deepseek-explain-tooltip.ds-visible').waitFor({ state: 'detached' });
  });
  await check('实际按需注入全文脚本，独立翻译模型与原文恢复', async () => {
    await worker.evaluate(async id => chrome.tabs.sendMessage(id, { type: 'TRIGGER_FULLPAGE_TRANSLATE' }), tabId);
    await page.locator('#paragraph').filter({ hasText: '流式翻译结果。' }).waitFor();
    assert.ok(requests.some(req => req.model === 'gateway/model-large' && req.path === '/other/v1/chat/completions'));
    await page.screenshot({ path: resolve(evidence, 'fullpage-stream.png') });
    await page.locator('#ds-tb-show-original').click();
    await page.locator('#paragraph').filter({ hasText: 'This is a longer English paragraph' }).waitFor();
    await page.locator('#ds-tb-show-original').click();
    await page.locator('#paragraph').filter({ hasText: '流式翻译结果。' }).waitFor();
    await page.locator('#ds-tb-cancel').click();
    await page.locator('#paragraph').filter({ hasText: 'This is a longer English paragraph' }).waitFor();
  });
  await check('错误凭据提示且获取失败不覆盖已存连接；无相关页面异常', async () => {
    await popup.locator('#api-key').fill('invalid-test-only');
    await popup.locator('#fetch-models').click();
    await popup.locator('#connection-msg.error').waitFor();
    assert.match(await popup.locator('#connection-msg').innerText(), /API Key 无效/);
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('apiKey')).apiKey), 'local-qa-only');
    assert.deepEqual(errors, []);
  });
} catch (err) {
  console.error(err.message);
  if (!checks.some(check => check.status === 'failed')) checks.push({ name: 'Browser setup or unhandled operation', status: 'failed', error: err.message });
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  const report = { date: new Date().toISOString(), node: process.version, browserVersion,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    kind: 'Actual Edge extension with localhost mock API and synthetic credentials', checks, requests, errors,
    unverified: ['真实供应商/模型、账号权限、模型质量、原生扩展工具栏和右键菜单的鼠标操作'] };
  writeFileSync(resolve(evidence, 'browser-check.json'), JSON.stringify(report, null, 2) + '\n');
}
