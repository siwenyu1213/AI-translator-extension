// Actual config/background in Node VM and isolated Edge. All Keys are synthetic;
// non-local fetches are intercepted. Never sends test credentials to providers.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const vulnerable = process.argv.includes('--expect-vulnerable');
const ref = process.argv.includes('--ref') ? arg('--ref') : null;
assert.ok(!vulnerable || ref, 'Use an explicit baseline --ref');
const output = resolve(root, 'artifacts/qa/custom-endpoint-2026-10-11', vulnerable ? 'baseline' : 'fixed');
mkdirSync(output, { recursive: true });
let extension = root;
if (ref) {
  const commit = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
  extension = resolve(root, '.local/tmp/custom-endpoint-baseline', commit);
  for (const file of execFileSync('git', ['ls-tree', '-rz', '--name-only', commit], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)) {
    const path = resolve(extension, file); assert.ok(path.startsWith(extension + '/') || path.startsWith(extension + '\\'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, maxBuffer: 10 * 1024 * 1024 }));
  }
}
const sources = Object.fromEntries(['config.js', 'model-catalog.js', 'background.js'].map(file => [file, readFileSync(resolve(extension, file), 'utf8')]));
const key = 'endpoint-synthetic-only', model = 'gpt-4.1-mini', checks = [];
const clone = value => structuredClone(value);
const seed = entry => ({ apiConfigVersion: 1, modelCatalogVersion: 1, providerConfigVersion: 1,
  enabled: true, language: 'zh', targetLanguage: 'zh', modelList: [model], explainModel: model, translateModel: model,
  explainManufacturer: 'custom', translateManufacturer: 'custom', providerConnections: { custom: { apiKey: key, availableModels: [model], ...entry } } });
const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); }, emit(...args) { this.listeners.forEach(fn => fn(...args)); } });
function bodyFor(url, options) {
  if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: model }] }), { headers: { 'Content-Type': 'application/json' } });
  const prompt = JSON.parse(options.body).messages[1].content;
  const ids = [...prompt.matchAll(/<<<DS_ITEM_([A-Za-z0-9_]+)>>>/g)].map(m => m[1]);
  const content = ids.length ? ids.map(id => `<<<DS_ITEM_${id}>>>Synthetic translation<<<DS_END_${id}>>>`).join('\n') : 'Synthetic response';
  return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
}
function offline(raw) {
  let storage = clone(raw); const calls = [], messages = [];
  const chrome = { runtime: { onInstalled: event(), onConnect: event(), onMessage: event() }, contextMenus: { onClicked: event() },
    storage: { onChanged: event(), local: {
      async get() { return clone(storage); },
      async set(values) { const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { oldValue: storage[k], newValue: v }])); Object.assign(storage, clone(values)); chrome.storage.onChanged.emit(changes, 'local'); },
      async remove(keys) { const changes = Object.fromEntries(keys.filter(k => Object.hasOwn(storage, k)).map(k => [k, { oldValue: storage[k] }])); keys.forEach(k => delete storage[k]); if (Object.keys(changes).length) chrome.storage.onChanged.emit(changes, 'local'); }
    } } };
  const context = vm.createContext({ chrome, URL, AbortController, AbortSignal, TextDecoder, TextEncoder, setTimeout, clearTimeout, console,
    fetch: async (url, options = {}) => { calls.push({ url, syntheticKeyAttached: options.headers?.Authorization === `Bearer ${key}` }); return bodyFor(url, options); } });
  context.importScripts = name => vm.runInContext(sources[name], context, { filename: name });
  vm.runInContext(sources['background.js'], context, { filename: 'background.js' });
  context.qaPort = { onDisconnect: event(), postMessage(message) { messages.push(message); }, disconnect() {} };
  return { calls, messages, run(code) { return vm.runInContext(code, context); }, storage() { return storage; }, context };
}
async function check(phase, name, fn) {
  try { const evidence = await fn(); checks.push({ phase, name, status: 'passed', evidence }); console.log(`${vulnerable ? 'EXPECTED BASELINE' : 'PASSED'}: ${phase}: ${name}`); }
  catch (error) { checks.push({ phase, name, status: 'failed', error: error.message }); throw error; }
}
const invalid = [['absent', undefined], ['null', null], ['empty', ''], ['whitespace', '   '], ['zero', 0], ['false', false], ['object', {}], ['number', 1], ['array', []]];
const requests = [
  ['explain', { mode: 'C', text: 'synthetic selection' }], ['floating-translate', { mode: 'B', text: 'synthetic sentence' }],
  ['fullpage-single', { promptType: 'translate', text: 'synthetic paragraph' }],
  ['fullpage-batch', { promptType: 'translate', text: '', batchItems: [{ id: 't1', text: 'First' }, { id: 't2', text: 'Second' }] }]
];
let context, server, version, profile;
try {
  for (const [label, value] of invalid) {
    await check('Node VM', `normalize custom address: ${label}`, async () => {
      const h = offline(seed({ apiBaseUrl: value })); h.context.qaRaw = seed({ apiBaseUrl: value });
      const normalized = h.run('AIConfig.migrate(qaRaw)');
      const endpoint = normalized.providerConnections.custom.apiBaseUrl;
      if (!vulnerable) assert.equal(endpoint, '');
      else if (['absent', 'null', 'empty', 'zero', 'false'].includes(label)) assert.equal(endpoint, 'https://api.openai.com/v1');
      return { endpoint, keyPreserved: normalized.providerConnections.custom.apiKey === key };
    });
    for (const [route, request] of requests) await check('Node VM', `${route} rejects invalid custom address: ${label}`, async () => {
      const h = offline(seed({ apiBaseUrl: value })); h.context.qaRequest = request;
      await h.run('handleStreamRequest(qaPort,qaRequest)');
      const forward = vulnerable && ['absent', 'null', 'empty', 'zero', 'false', 'array'].includes(label);
      assert.equal(h.calls.length, forward ? 1 : 0);
      if (forward) { assert.equal(h.calls[0].url, 'https://api.openai.com/v1/chat/completions'); assert.equal(h.calls[0].syntheticKeyAttached, true); }
      else { assert.ok(h.messages.some(m => m.type === 'error')); assert.ok(!h.messages.some(m => m.type === 'done')); }
      return { calls: h.calls, blocked: !forward };
    });
  }
  await check('Node VM', 'raw model-list draft rejects missing address before fetch', async () => {
    const h = offline(seed({})); h.context.qaConnection = { apiKey: key };
    const result = await h.run('listModels(qaConnection)'); assert.equal(result.ok, false); assert.equal(result.code, 'address'); assert.equal(h.calls.length, 0); return { code: result.code, requests: 0 };
  });
  await check('Node VM', 'stored model-list connection rejects missing address', async () => {
    const h = offline(seed({})); let result;
    try { result = await h.run('listModels()'); } catch (e) { result = { ok: false, error: e.message }; }
    assert.equal(h.calls.length, vulnerable ? 1 : 0); assert.equal(result.ok, vulnerable);
    return { calls: h.calls, blocked: !result.ok };
  });
  for (const manufacturer of ['custom', undefined]) await check('Node VM', `v4 global Key without address cannot acquire a guessed endpoint: ${manufacturer || 'inferred'}`, async () => {
    const raw = { apiConfigVersion: 1, modelCatalogVersion: 1, modelList: [model], explainModel: model, translateModel: model, apiKey: key,
      explainManufacturer: manufacturer, translateManufacturer: manufacturer };
    const h = offline(raw); await h.run("handleStreamRequest(qaPort,{mode:'C',text:'synthetic'})");
    assert.equal(h.calls.length, vulnerable ? 1 : 0); if (!vulnerable) assert.equal(h.storage().providerConnections.custom.apiBaseUrl, '');
    return { calls: h.calls, blocked: !h.calls.length };
  });
  await check('Node VM', 'legacy v3 Key without address stays unusable', async () => {
    const h = offline({ apiKey: key, modelList: [model], explainModel: model });
    await h.run("handleStreamRequest(qaPort,{mode:'C',text:'synthetic'})"); assert.equal(h.calls.length, 0); return { requests: 0 };
  });
  await check('Node VM', 'custom connection never borrows the global Key', async () => {
    const raw = seed({ apiBaseUrl: 'https://explicit.synthetic.example/v1', apiKey: '' }); raw.apiKey = key;
    const h = offline(raw); await h.run("handleStreamRequest(qaPort,{mode:'C',text:'synthetic'})"); assert.equal(h.calls.length, 0); return { requests: 0 };
  });
  for (const [provider, address] of Object.entries(offline({}).run('AIConfig.PROVIDER_ENDPOINTS'))) await check('Node VM', `official provider keeps its own address: ${provider}`, async () => {
    const raw = seed({}); raw.explainManufacturer = provider; raw.providerConnections = { [provider]: { apiKey: key, apiBaseUrl: 'https://wrong.synthetic.example/v1', availableModels: [model] } };
    const h = offline(raw); await h.run("handleStreamRequest(qaPort,{mode:'C',text:'synthetic'})"); assert.equal(h.calls[0]?.url, address + '/chat/completions'); return { destination: h.calls[0].url, syntheticKeyAttached: h.calls[0].syntheticKeyAttached };
  });
  for (const address of ['http://127.0.0.1:12345/v1', 'https://explicit.synthetic.example/custom/v1', 'https://api.openai.com/v1']) await check('Node VM', `explicit custom address remains allowed: ${address}`, async () => {
    const h = offline(seed({ apiBaseUrl: address })); await h.run("handleStreamRequest(qaPort,{mode:'C',text:'synthetic'})"); assert.equal(h.calls[0]?.url, address + '/chat/completions'); return { destination: h.calls[0].url, keyPreserved: true };
  });
  if (!process.argv.includes('--node-only')) {
    const { chromium } = createRequire(import.meta.url)(process.argv.includes('--playwright') ? arg('--playwright') : 'playwright');
    server = createServer(async (req, res) => {
      let raw = ''; for await (const chunk of req) raw += chunk;
      if (req.url.endsWith('/models')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: model }] })); return; }
      if (req.url.endsWith('/chat/completions')) { const response = bodyFor(req.url, { body: raw }); res.setHeader('Content-Type', 'text/event-stream'); res.end(await response.text()); return; }
      res.writeHead(404); res.end('{}');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
    profile = resolve(root, '.local/browser-profile/custom-endpoint', `run-${Date.now()}`); mkdirSync(profile, { recursive: true });
    context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run'], ignoreDefaultArgs: ['--disable-extensions'] });
    version = context.browser().version(); const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    // Intercept all Worker fetches before seeding/opening the popup. Only localhost
    // requests use native fetch; provider/public-directory replies are synthetic.
    await worker.evaluate(({ key, model }) => {
      const original = fetch; globalThis.qaCalls = [];
      globalThis.fetch = async (url, options = {}) => {
        const address = String(url), auth = options.headers?.Authorization;
        qaCalls.push({ url: address, syntheticKeyAttached: auth === `Bearer ${key}` });
        if (auth && auth !== `Bearer ${key}`) throw Error('Unexpected test credential');
        if (new URL(address).hostname === '127.0.0.1') return original(url, options);
        if (address.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: model }] }), { headers: { 'Content-Type': 'application/json' } });
        return new Response('data: {"choices":[{"delta":{"content":"Synthetic response"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
      };
    }, { key, model });
    // Also intercept popup fallback fetches; never permit synthetic Key egress.
    const fallbackRequests = [];
    await context.route('https://**/*', route => {
      const request = route.request();
      if (request.headers().authorization === `Bearer ${key}`) fallbackRequests.push({ url: request.url(), syntheticKeyAttached: true });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: model }] }) });
    });
    const id = new URL(worker.url()).host; let popup; const errors = [];
    async function open(raw) {
      if (popup) await popup.close();
      await worker.evaluate(async raw => { await chrome.storage.local.clear(); await chrome.storage.local.set(raw); qaCalls.length = 0; }, raw);
      popup = await context.newPage(); popup.on('pageerror', e => errors.push(e.message)); await popup.goto(`chrome-extension://${id}/popup.html`);
      await popup.waitForFunction(() => document.querySelector('#explain-manufacturer').value === 'custom');
      await popup.waitForTimeout(250);
    }
    const calls = () => worker.evaluate(() => qaCalls.filter(c => c.syntheticKeyAttached));
    async function stream(request) {
      return popup.evaluate(request => new Promise((resolve, reject) => {
        const messages = [], port = chrome.runtime.connect({ name: `stream-endpoint-${Date.now()}` });
        const timeout = setTimeout(() => reject(Error('Port did not complete')), 5000);
        port.onMessage.addListener(msg => { messages.push(msg); if (msg.type === 'done' || msg.type === 'error') { clearTimeout(timeout); port.disconnect(); resolve(messages); } });
        port.postMessage(request.batchItems ? { type: 'STREAM_TRANSLATE_BATCH', items: request.batchItems } :
          { type: request.promptType ? 'STREAM_BATCH' : 'STREAM_REQUEST', ...request });
      }), request);
    }
    await check('Edge', 'popup opening with a saved custom Key cannot guess an address or query OpenAI', async () => {
      await open(seed({})); const captured = await calls(); assert.equal(captured.some(c => c.url === 'https://api.openai.com/v1/models'), vulnerable);
      await popup.locator('#custom-connection-button').click(); const value = await popup.locator('#api-base-url').inputValue(); assert.equal(value, vulnerable ? 'https://api.openai.com/v1' : '');
      await popup.locator('#custom-cancel').click(); if (!vulnerable) { assert.ok((await popup.locator('#catalog-status').textContent()).includes('自定义接口地址')); assert.equal(await popup.locator('#explain-model').isDisabled(), true); }
      await popup.screenshot({ path: resolve(output, 'missing-address.png') }); return { addressField: value, requests: captured };
    });
    await check('Edge', 'popup communication fallback blocks a missing-address query before fetch', async () => {
      fallbackRequests.length = 0;
      const result = await popup.evaluate(async () => {
        const original = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = msg => msg.type === 'LIST_MODELS' ? Promise.resolve(undefined) : original(msg);
        try { return await requestProviderModels(providerConnection('custom')); }
        finally { chrome.runtime.sendMessage = original; }
      });
      assert.equal(result.ok, vulnerable); assert.equal(fallbackRequests.length, vulnerable ? 1 : 0);
      if (!vulnerable) assert.equal(result.code, 'address');
      return { ok: result.ok, code: result.code, interceptedRequests: fallbackRequests.slice(), injected: 'LIST_MODELS no response' };
    });
    for (const [route, request] of requests) await check('Edge', `actual runtime port blocks missing address: ${route}`, async () => {
      await worker.evaluate(() => { qaCalls.length = 0; }); const messages = await stream(request); const captured = await calls();
      assert.equal(captured.some(c => c.url.endsWith('/chat/completions')), vulnerable);
      if (!vulnerable) assert.ok(messages.some(m => m.type === 'error' && m.error.includes('自定义接口地址')));
      return { requests: captured, error: messages.find(m => m.type === 'error')?.error, blocked: !captured.length };
    });
    await check('Edge', 'LIST_MODELS runtime message blocks the stored missing-address connection', async () => {
      await worker.evaluate(() => { qaCalls.length = 0; }); const result = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'LIST_MODELS' }));
      const captured = await calls(); assert.equal(result.ok, vulnerable); assert.equal(captured.length, vulnerable ? 1 : 0); return { requests: captured, ok: result.ok };
    });
    if (!vulnerable) {
      await check('Edge', 'saving a Key without an address preserves blank address and sends no request', async () => {
        await popup.locator('#rewrite-key').click(); await popup.locator('#api-key').fill(key); await worker.evaluate(() => { qaCalls.length = 0; }); await popup.locator('#save-key').click();
        await popup.waitForFunction(() => document.querySelector('#key-editor').hidden); await popup.waitForTimeout(100);
        const captured = await calls(); assert.equal(captured.length, 0);
        const stored = await worker.evaluate(async () => { const s = await chrome.storage.local.get('providerConnections'); return { endpoint: s.providerConnections.custom.apiBaseUrl, preserved: s.providerConnections.custom.apiKey === 'endpoint-synthetic-only' }; });
        assert.equal(stored.endpoint, ''); assert.equal(stored.preserved, true); return { ...stored, requests: 0 };
      });
      await check('Edge', 'popup save/reopen does not repair missing address into an official endpoint', async () => {
        await popup.locator('#save-btn').click(); await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
        await popup.reload(); await popup.waitForFunction(() => document.querySelector('#explain-manufacturer').value === 'custom');
        assert.equal(await popup.evaluate(() => providerConnection('custom').apiBaseUrl), ''); return { address: '' };
      });
      await check('Edge', 'explicit localhost address restores models and generation with the same saved Key', async () => {
        await popup.locator('#custom-connection-button').click(); await popup.locator('#api-base-url').fill(base + '/v1'); await popup.locator('#custom-save').click();
        await popup.waitForFunction(model => [...document.querySelector('#explain-model').options].some(o => o.value === model), model);
        await popup.locator('#explain-model').selectOption(model); await popup.locator('#save-btn').click();
        await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
        const messages = await stream({ mode: 'C', text: 'explicit custom endpoint' }); assert.ok(messages.some(m => m.type === 'done'));
        const captured = await calls(); assert.ok(captured.some(c => c.url === base + '/v1/chat/completions'));
        assert.ok(captured.every(c => new URL(c.url).hostname === '127.0.0.1')); return { onlyLocal: true, completed: true };
      });
      await check('Edge', 'partial v4 global config missing its address stays blocked after migration', async () => {
        await open({ apiConfigVersion: 1, modelCatalogVersion: 1, apiKey: key, modelList: [model], explainModel: model, translateModel: model, explainManufacturer: 'custom', translateManufacturer: 'custom' });
        const messages = await stream({ mode: 'C', text: 'legacy endpoint' }); assert.equal((await calls()).length, 0); assert.ok(messages.some(m => m.type === 'error')); return { blocked: true, requests: 0 };
      });
    }
    await check('Edge', 'no popup JavaScript errors', async () => { assert.deepEqual(errors, []); return { errors }; });
  }
} finally {
  if (context) await context.close(); if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ date: new Date().toISOString(), timezone: 'Asia/Shanghai',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), ref,
    expected: vulnerable ? 'known fallback defect reproduced with synthetic fetch interception' : 'missing address blocked before credentials enter fetch',
    node: process.version, browser: version, profile: profile ? relative(root, profile) : null, browserClosed: true, serverClosed: true,
    checks, boundary: 'Node VM simulation plus actual isolated Edge runtime/UI; synthetic credentials only. All non-local fetches intercepted. No real supplier generation tested.' }, null, 2) + '\n');
}
