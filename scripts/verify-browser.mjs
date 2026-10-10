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
const checks = [], requests = [], providerRequests = [], errors = [];
let browserVersion, context, liveCatalog;
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
  context = await chromium.launchPersistentContext(resolve(root, `.local/browser-profile/api-qa/run-${Date.now()}`), {
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
  const settleCatalog = () => popup.waitForFunction(() => !catalogRefreshing && document.querySelector('#explain-model option'), null, { timeout: 25000 });
  await settleCatalog();
  await check('实际 Edge 加载 MV3、旧配置迁移与至少 10 家厂家联动入口', async () => {
    assert.equal(await popup.locator('#explain-manufacturer option').count(), 11);
    assert.ok(await popup.locator('#explain-model option').count() >= 3);
    assert.equal(await popup.locator('#api-key').inputValue(), '');
    assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get(null)).qwenApiKey), undefined);
    assert.match(await popup.locator('#connection-msg').innerText(), /旧供应商/);
  });
  await check('厂家模型不限 3 款；DeepSeek 兼容入口；调用名与通用设置仍显示', async () => {
    const makers = await popup.locator('#explain-manufacturer option').evaluateAll(options => options.map(o => o.value).filter(v => v !== 'custom'));
    for (const maker of makers) {
      await popup.locator('#explain-manufacturer').selectOption(maker);
      assert.ok(await popup.locator('#explain-model optgroup').first().locator('option').count() > 3);
      assert.equal(await popup.locator('#api-base-url').inputValue(), await worker.evaluate(id => AIConfig.PROVIDER_ENDPOINTS[id], maker));
      assert.equal(await popup.locator('#api-base-url').evaluate(el => el.readOnly), true);
      assert.equal(await popup.locator('#api-key').inputValue(), '');
    }
    assert.equal(await popup.locator('#refresh-catalog').count(), 0);
    assert.equal(await popup.locator('#catalog-status').isVisible(), false);
    assert.equal(await popup.locator('#explain-custom-model').isVisible(), true);
    assert.equal(await popup.locator('#api-base-url').isVisible(), true);
    await popup.locator('#explain-manufacturer').selectOption('deepseek');
    await popup.locator('#explain-model').selectOption('deepseek-v4-flash');
    assert.match(await popup.locator('#explain-model-detail').innerText(), /退役/);
    assert.equal(await popup.locator('#explain-model option[value="deepseek-flash"]').count(), 1);
    assert.equal(await popup.locator('#explain-model option[value="deepseek-v4-pro"]').count(), 1);
    await popup.locator('.container').screenshot({ path: resolve(evidence, 'popup-deepseek.png') });
    await popup.locator('#explain-manufacturer').selectOption('openai');
    await popup.locator('#explain-model').selectOption('gpt-4.1-mini');
  });
  await check('每次打开自动联网，即使缓存刚更新；成功无提示并保留模型', async () => {
    const previous = await worker.evaluate(async () => (await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot.updatedAt);
    await popup.reload(); await popup.locator('#explain-model option').first().waitFor({ state: 'attached' }); await settleCatalog();
    assert.equal(await popup.locator('#catalog-status').isVisible(), false);
    const snapshot = await worker.evaluate(async () => (await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot);
    assert.equal(snapshot.providers.length, 10);
    assert.ok(snapshot.providers.every(p => p.models.length > 3));
    assert.notEqual(snapshot.updatedAt, previous);
    liveCatalog = { source: snapshot.source, updatedAt: snapshot.updatedAt,
      providers: snapshot.providers.map(p => ({ id: p.id, name: p.name, stale: p.stale,
        models: p.models.map(m => ({ id: m.id, name: m.name, created: m.created })) })) };
    assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
  });
  await check('旧后台未识别刷新消息时，设置页恢复刷新（模拟无回复，真实目录网络）', async () => {
    await popup.evaluate(() => {
      globalThis.qaSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (message, ...args) => message.type === 'REFRESH_MODEL_CATALOG'
        ? Promise.resolve(undefined) : qaSendMessage(message, ...args);
    });
    try {
      await popup.evaluate(() => refreshCatalog()); await settleCatalog();
      await popup.locator('.container').screenshot({ path: resolve(evidence, 'catalog-recovery.png') });
      assert.equal(await popup.locator('#catalog-status').isVisible(), false);
      assert.equal(await popup.evaluate(() => document.querySelector('#catalog-status').textContent), '');
      assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
    } finally {
      await popup.evaluate(() => { chrome.runtime.sendMessage = qaSendMessage; delete globalThis.qaSendMessage; });
    }
  });
  await check('后台消息通道断开时恢复；恢复网络失败可重试且保留缓存（模拟）', async () => {
    await popup.evaluate(() => {
      globalThis.qaSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
      globalThis.qaPageFetch = globalThis.fetch;
      chrome.runtime.sendMessage = (message, ...args) => message.type === 'REFRESH_MODEL_CATALOG'
        ? Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')) : qaSendMessage(message, ...args);
      globalThis.fetch = () => Promise.resolve(Response.json({ data: AIModelCatalog.BUILTIN.providers.flatMap(p =>
        p.models.map(m => ({ ...m, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }))) }));
    });
    try {
      await popup.evaluate(() => refreshCatalog()); await settleCatalog();
      assert.equal(await popup.locator('#catalog-status').isVisible(), false);
      const previous = await worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot));
      await popup.evaluate(() => { globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 503 })); });
      for (let retry = 0; retry < 2; retry++) {
        await popup.evaluate(() => refreshCatalog()); await settleCatalog();
        assert.equal(await popup.locator('#catalog-status').innerText(), '暂时无法获取模型，已保留已有列表。');
        assert.equal(await popup.locator('#catalog-status').isVisible(), true);
        assert.equal(await worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot)), previous);
        assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
      }
      await popup.locator('.container').screenshot({ path: resolve(evidence, 'catalog-recovery-error.png') });
    } finally {
      await popup.evaluate(() => {
        chrome.runtime.sendMessage = qaSendMessage; globalThis.fetch = qaPageFetch;
        delete globalThis.qaSendMessage; delete globalThis.qaPageFetch;
      });
    }
  });
  await check('目录刷新失败时保留缓存和当前选择（浏览器内模拟 503）', async () => {
    const original = await worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot));
    await worker.evaluate(() => {
      globalThis.qaOriginalFetch = globalThis.fetch;
      globalThis.fetch = (url, ...args) => url === AIModelCatalog.SOURCE
        ? Promise.resolve(new Response('{}', { status: 503 })) : qaOriginalFetch(url, ...args);
    });
    try {
      await popup.reload(); await popup.locator('#explain-model option').first().waitFor({ state: 'attached' }); await settleCatalog();
      assert.equal(await popup.locator('#catalog-status').innerText(), '暂时无法获取模型，已保留已有列表。');
      assert.equal(await popup.locator('#catalog-status').evaluate(el => getComputedStyle(el).color), 'rgb(185, 28, 28)');
      assert.equal(await popup.locator('#explain-model').inputValue(), 'gpt-4.1-mini');
      assert.equal(await worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot)), original);
    } finally { await worker.evaluate(() => { globalThis.fetch = qaOriginalFetch; delete globalThis.qaOriginalFetch; }); }
    await popup.reload(); await popup.locator('#explain-model option').first().waitFor({ state: 'attached' }); await settleCatalog();
    assert.equal(await popup.locator('#catalog-status').isVisible(), false);
    await popup.locator('.container').screenshot({ path: resolve(evidence, 'popup-auto-success.png') });
  });
  await check('刷新保留中途选择和输入；移除下架目录项；部分失败仅显示红字（模拟）', async () => {
    const removed = await worker.evaluate(async () => {
      const snapshot = (await chrome.storage.local.get('catalogSnapshot')).catalogSnapshot;
      const model = snapshot.providers[0].models.find(m => AIModelCatalog.nativeId(m) !== 'gpt-4.1-mini');
      const data = snapshot.providers.filter(p => p.id !== 'google').flatMap(p => p.models.filter(m => m.id !== model.id)
        .map(m => ({ ...m, architecture: { input_modalities: ['text'], output_modalities: ['text'] } })));
      globalThis.qaOriginalFetch = globalThis.fetch;
      globalThis.fetch = (url, ...args) => url === AIModelCatalog.SOURCE
        ? new Promise(resolve => { globalThis.qaReleaseCatalogFetch = () => resolve(Response.json({ data })); }) : qaOriginalFetch(url, ...args);
      return AIModelCatalog.nativeId(model);
    });
    let pending;
    try {
      pending = popup.evaluate(() => refreshCatalog());
      await popup.waitForFunction(() => catalogRefreshing);
      assert.equal(await popup.locator('#catalog-status').isVisible(), false);
      await popup.locator('#explain-manufacturer').selectOption('deepseek');
      await popup.locator('#explain-model').selectOption('deepseek-flash');
      await popup.locator('#explain-custom-model').fill('draft-model-not-yet-saved');
      await worker.evaluate(async () => {
        for (let retry = 0; retry < 200 && !globalThis.qaReleaseCatalogFetch; retry++) await new Promise(resolve => setTimeout(resolve, 10));
        qaReleaseCatalogFetch();
      });
      await pending; await settleCatalog();
      assert.equal(await popup.locator('#explain-manufacturer').inputValue(), 'deepseek');
      assert.equal(await popup.locator('#explain-model').inputValue(), 'deepseek-flash');
      assert.equal(await popup.locator('#explain-custom-model').inputValue(), 'draft-model-not-yet-saved');
      assert.equal(await popup.locator('#catalog-status').innerText(), '部分厂家的模型暂未更新，已保留已有列表。');
      assert.equal(await worker.evaluate(async id => (await chrome.storage.local.get('modelList')).modelList.includes(id), removed), false);
    } finally {
      await worker.evaluate(() => {
        globalThis.qaReleaseCatalogFetch?.(); globalThis.fetch = qaOriginalFetch;
        delete globalThis.qaOriginalFetch; delete globalThis.qaReleaseCatalogFetch;
      });
      if (pending) await pending;
    }
    await popup.reload(); await popup.locator('#explain-model option').first().waitFor({ state: 'attached' }); await settleCatalog();
  });
  await check('当前输入连接经实际 runtime 消息获取模型并持久保存', async () => {
    await popup.locator('#explain-manufacturer').selectOption('custom');
    assert.equal(await popup.locator('#api-base-url').evaluate(el => el.readOnly), false);
    await popup.locator('#api-base-url').fill(`${base}/custom/v1/chat/completions/`);
    await popup.locator('#api-key').fill('local-qa-only');
    await popup.locator('#fetch-models').click();
    await popup.locator('#connection-msg.success').waitFor();
    assert.ok(await popup.locator('#explain-model option').count() >= 3);
    const saved = await worker.evaluate(async () => chrome.storage.local.get(['apiBaseUrl', 'apiKey']));
    assert.equal(saved.apiBaseUrl, `${base}/custom/v1`); assert.equal(saved.apiKey, 'local-qa-only');
  });
  await check('异步查询期间切换厂家不覆盖新厂家连接或 Key（模拟延迟）', async () => {
    await popup.evaluate(() => {
      globalThis.qaSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (message, ...args) => message.type === 'LIST_MODELS'
        ? new Promise(resolve => { globalThis.qaReleaseModelList = () => resolve({ok:true,models:['race-only-model']}); })
        : qaSendMessage(message, ...args);
    });
    try {
      await popup.locator('#fetch-models').click();
      await popup.waitForFunction(() => Boolean(globalThis.qaReleaseModelList));
      await popup.locator('#explain-manufacturer').selectOption('deepseek');
      await popup.evaluate(() => qaReleaseModelList());
      await popup.locator('#connection-msg.error').waitFor();
      assert.match(await popup.locator('#connection-msg').innerText(), /连接已切换/);
      assert.equal(await popup.locator('#api-key').inputValue(), '');
      assert.equal(await popup.locator('#api-base-url').inputValue(), 'https://api.deepseek.com');
      assert.equal(await popup.locator('#explain-model option[value="race-only-model"]').count(), 0);
    } finally {
      await popup.evaluate(() => { chrome.runtime.sendMessage = qaSendMessage; delete globalThis.qaSendMessage; delete globalThis.qaReleaseModelList; });
    }
  });
  await check('不同厂家分别保存到解释/翻译，重开保留厂家、模型、连接和 Key', async () => {
    await popup.locator('#explain-manufacturer').selectOption('deepseek');
    await popup.locator('#explain-model').selectOption('deepseek-flash');
    await popup.locator('#api-key').fill('local-ds-only');
    await popup.locator('[data-tab="translate"]').click();
    await popup.locator('#translate-manufacturer').selectOption('google');
    await popup.locator('#translate-model').selectOption('gemini-3.8-flash');
    assert.equal(await popup.locator('#api-key').inputValue(), '');
    assert.equal(await popup.locator('#api-base-url').inputValue(), 'https://generativelanguage.googleapis.com/v1beta/openai');
    await popup.locator('#api-key').fill('local-google-only');
    await popup.locator('#save-btn').click(); await popup.locator('#status.success').waitFor();
    await popup.reload(); await popup.locator('#explain-manufacturer option').first().waitFor({ state: 'attached' });
    assert.equal(await popup.locator('#explain-manufacturer').inputValue(), 'deepseek');
    assert.equal(await popup.locator('#explain-model').inputValue(), 'deepseek-flash');
    assert.equal(await popup.locator('#translate-manufacturer').inputValue(), 'google');
    assert.equal(await popup.locator('#translate-model').inputValue(), 'gemini-3.8-flash');
    assert.equal(await popup.locator('#api-key').inputValue(), 'local-ds-only');
    assert.equal(await popup.locator('#api-base-url').inputValue(), 'https://api.deepseek.com');
    await popup.locator('[data-tab="translate"]').click();
    assert.equal(await popup.locator('#api-key').inputValue(), 'local-google-only');
    await popup.locator('[data-tab="explain"]').click();
    const saved = await worker.evaluate(async () => (await chrome.storage.local.get('providerConnections')).providerConnections);
    assert.equal(saved.deepseek.apiKey, 'local-ds-only'); assert.equal(saved.google.apiKey, 'local-google-only');
    assert.equal(saved.custom.apiKey, 'local-qa-only');
    await popup.locator('.container').screenshot({ path: resolve(evidence, 'popup-provider-autofill.png') });
  });
  await check('实际 Edge 端口按解释/翻译厂家发送独立连接，缺 Key 拦截（网络模拟）', async () => {
    await settleCatalog();
    await worker.evaluate(() => {
      globalThis.qaOriginalFetch = globalThis.fetch;
      globalThis.qaProviderRequests = [];
      globalThis.fetch = (url, options) => {
        if (url === AIModelCatalog.SOURCE) return qaOriginalFetch(url, options);
        const expectedKey = url.startsWith(AIConfig.PROVIDER_ENDPOINTS.deepseek) ? 'local-ds-only' : 'local-google-only';
        qaProviderRequests.push({ url, authenticated: options.headers.Authorization === `Bearer ${expectedKey}`, model: JSON.parse(options.body).model });
        return Promise.resolve(new Response('data: {"choices":[{"delta":{"content":"浏览器内模拟流式输出，验证两厂家的连接和路由。"}}]}\n\ndata: [DONE]\n', {headers:{'Content-Type':'text/event-stream'}}));
      };
    });
    const request = data => popup.evaluate(data => new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({name:'stream-provider-qa'}), messages = [];
      const timer = setTimeout(() => {port.disconnect();reject(new Error('流式消息超时'));}, 10000);
      port.onMessage.addListener(msg => {
        messages.push(msg);
        if (msg.type === 'done' || msg.type === 'error') {clearTimeout(timer);port.disconnect();resolve(messages);}
      });
      port.postMessage(data);
    }), data);
    try {
      for (const data of [
        {type:'STREAM_REQUEST',mode:'C',text:'浏览器验证解释'},
        {type:'STREAM_REQUEST',mode:'B',text:'browser translation'},
        {type:'STREAM_BATCH',promptType:'translate',text:'browser full page',batchId:'qa-provider'}
      ]) assert.equal((await request(data)).at(-1).type, 'done');
      providerRequests.push(...await worker.evaluate(() => qaProviderRequests));
      assert.deepEqual(providerRequests.map(r => [r.url,r.authenticated,r.model]), [
        ['https://api.deepseek.com/chat/completions',true,'deepseek-flash'],
        ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',true,'gemini-3.8-flash'],
        ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',true,'gemini-3.8-flash']
      ]);
      await worker.evaluate(async () => chrome.storage.local.set({explainManufacturer:'xai'}));
      assert.equal((await request({type:'STREAM_REQUEST',mode:'C',text:'缺 Key'}))[0].type, 'error');
      assert.equal(await worker.evaluate(() => qaProviderRequests.length), 3);
      await worker.evaluate(async () => chrome.storage.local.set({explainManufacturer:'deepseek'}));
    } finally {await worker.evaluate(() => {globalThis.fetch=qaOriginalFetch;delete globalThis.qaOriginalFetch;delete globalThis.qaProviderRequests;});}
  });
  await check('无效模型拒绝保存；新增/修改/删除模型同步到两标签', async () => {
    await popup.locator('[data-tab="translate"]').click();
    await popup.locator('#translate-manufacturer').selectOption('custom');
    await popup.locator('[data-tab="explain"]').click();
    await popup.locator('#explain-manufacturer').selectOption('custom');
    assert.equal(await popup.locator('#api-key').inputValue(), 'local-qa-only');
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
    await popup.locator('[data-tab="translate"]').click();
    await popup.locator('#translate-manufacturer').selectOption('custom');
    await popup.locator('#translate-model option[value="local/renamed-model"]').waitFor({ state: 'attached' });
    await popup.locator('[data-tab="explain"]').click();
    assert.equal(await popup.locator('#explain-model option[value="local/manual-model"]').count(), 0);
  });
  await check('解释/翻译独立保存、重新打开后仍保留；新端点不使用旧配置', async () => {
    await popup.locator('#explain-model').selectOption('local/renamed-model');
    await popup.locator('[data-tab="translate"]').click();
    await popup.locator('#translate-manufacturer').selectOption('custom');
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
    kind: 'Actual Edge extension, live public model directory, localhost and Worker-intercepted mock inference API, synthetic credentials', liveCatalog, checks, requests, providerRequests, errors,
    unverified: ['真实供应商/模型、账号权限、模型质量、原生扩展工具栏和右键菜单的鼠标操作'] };
  writeFileSync(resolve(evidence, 'browser-check.json'), JSON.stringify(report, null, 2) + '\n');
}
