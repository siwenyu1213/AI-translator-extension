// Node 内置 VM + 模拟网络：验证实际后台逻辑，不代表真实供应商验收。
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
let storage = {}, calls = [], responder;
const changed = event();
const chrome = {
  runtime: { onInstalled: event(), onMessage: event(), onConnect: event() },
  contextMenus: { onClicked: event() },
  storage: { onChanged: changed, local: {
    async get() { return structuredClone(storage); },
    async set(values) { Object.assign(storage, values); changed.listeners.forEach(fn => fn({}, 'local')); },
    async remove(keys) { keys.forEach(key => delete storage[key]); }
  } }
};
const context = vm.createContext({ chrome, URL, AbortController, AbortSignal,
  TextDecoder, TextEncoder, setTimeout, clearTimeout, console,
  fetch: async (url, options) => { calls.push({ url, options }); return responder(url, options); }
});
context.importScripts = name => vm.runInContext(readFileSync(resolve(root, name), 'utf8'), context);
vm.runInContext(readFileSync(resolve(root, 'background.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
async function check(name, fn) {
  try { await fn(); checks.push({ name, status: 'passed' }); }
  catch (err) { checks.push({ name, status: 'failed', error: err.message }); }
}
async function config(values = {}) {
  storage = { ...JSON.parse(JSON.stringify(run('AIConfig.migrate({})'))),
    apiBaseUrl: 'https://gateway.example/v1', apiKey: 'test-only-key',
    explainModel: 'gpt-4.1-mini', translateModel: 'gpt-4o-mini', ...values };
  calls = [];
  changed.listeners.forEach(fn => fn({}, 'local'));
}
async function stream(data, request = {}) {
  responder = () => new Response(data, { headers: { 'Content-Type': 'text/event-stream' } });
  const messages = [];
  const port = { onDisconnect: event(), postMessage(msg) { messages.push(msg); }, disconnect() {} };
  context.testPort = port;
  context.testRequest = { mode: 'C', text: '测试文本', ...request };
  await run('handleStreamRequest(testPort, testRequest)');
  return messages;
}
const content = '这是流式文本，长度足以验证完整结果与缓存。';
const sse = `data:${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\ndata: [DONE]`;
await check('旧配置移除专用模型与 Key，保留语言/触发方式及自定义模型', () => {
  const result = run("AIConfig.migrate({apiKey:'old-secret',qwenApiKey:'old-secret-2',modelList:['qwen3.7-flash','deepseek-flash','vendor/custom'],explainModel:'deepseek-flash',targetLanguage:'ja',triggerMode:'contextMenu'})");
  assert.equal(result.apiKey, ''); assert.equal(result.qwenApiKey, undefined);
  assert.equal(result.explainModel, 'gpt-4.1-mini'); assert.equal(result.targetLanguage, 'ja');
  assert.ok(result.modelList.includes('vendor/custom')); assert.equal(result.modelList.length, 11);
});
await check('完整端点、尾斜杠、子路径归一化；拒绝非法协议与 URL 内凭据', () => {
  assert.equal(run("AIConfig.normalizeBaseUrl('https://example.org/custom/v1/chat/completions/')"), 'https://example.org/custom/v1');
  for (const url of ['file:///tmp', 'https://user:pass@example.org/v1', 'https://example.org/v1?key=secret', 'not-url']) {
    context.testUrl = url; assert.throws(() => run('AIConfig.normalizeBaseUrl(testUrl)'));
  }
});
await check('新版配置再次加载不改自定义模型或连接；删除全部模型保持空列表', () => {
  const result = run("AIConfig.migrate({apiConfigVersion:1,apiBaseUrl:'http://localhost:1234/v1',apiKey:'local-key',modelList:[],explainModel:'',translateModel:''})");
  assert.equal(result.apiKey, 'local-key'); assert.equal(result.modelList.length, 0);
  assert.equal(result.explainModel, '');
});
await check('发现模型用当前草稿端点和 Bearer，去重且保留网关模型调用名', async () => {
  await config(); responder = () => Response.json({ data: [{ id: 'vendor/model' }, { id: 'vendor/model' }, { id: 'gpt-x' }] });
  context.draft = { apiBaseUrl: 'https://draft.example/api/v1/chat/completions', apiKey: 'draft-only' };
  const result = await run('listModels(draft)');
  assert.equal(result.ok, true); assert.equal(result.models.length, 2);
  assert.equal(calls[0].url, 'https://draft.example/api/v1/models');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer draft-only');
});
await check('模型查询拒绝列表外模型、无 Key、无效 data 和空模型列表', async () => {
  await config(); responder = () => Response.json({ data: [{ id: 'valid' }] });
  assert.equal((await run("validateModel('missing')")).ok, false);
  assert.equal((await run("validateModel('valid')")).ok, true);
  assert.equal((await run("listModels({apiBaseUrl:'https://example.org/v1',apiKey:''})")).ok, false);
  for (const data of [{ models: [] }, { data: [] }]) {
    responder = () => Response.json(data); assert.equal((await run('listModels()')).ok, false);
  }
});
for (const status of [401, 403, 404, 429, 500]) {
  await check(`模型查询 HTTP ${status} 正确失败`, async () => {
    await config(); responder = () => new Response('{}', { status });
    const result = await run('listModels()'); assert.equal(result.ok, false); assert.ok(result.error);
  });
}
await check('解释请求使用配置端点、完整模型 ID、最小参数并解析无空格 data 和 EOF', async () => {
  await config(); const messages = await stream(sse);
  assert.equal(calls[0].url, 'https://gateway.example/v1/chat/completions');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(body).sort(), ['messages', 'model', 'stream']);
  assert.equal(body.model, 'gpt-4.1-mini');
  assert.equal(messages[0].token, content); assert.equal(messages.at(-1).type, 'done');
});
await check('全文翻译与 B 分类使用独立翻译模型，思考开启只发送 reasoning_effort', async () => {
  await config({ translateThinkingEnabled: true, translateReasoningEffort: 'low' });
  await stream(sse, { mode: 'B' });
  let body = JSON.parse(calls[0].options.body); assert.equal(body.model, 'gpt-4o-mini'); assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.thinking, undefined);
  await stream(sse, { mode: undefined, promptType: 'translate', text: 'full page' });
  assert.equal(JSON.parse(calls[1].options.body).model, 'gpt-4o-mini');
});
await check('配置和目标语言更改清缓存，缓存不混用不同端点', async () => {
  await config(); await stream(sse); await stream(sse); assert.equal(calls.length, 1);
  await chrome.storage.local.set({ apiBaseUrl: 'https://other.example/v1', targetLanguage: 'ja' });
  await stream(sse); assert.equal(calls.length, 2); assert.equal(calls[1].url, 'https://other.example/v1/chat/completions');
});
for (const [name, data] of [
  ['流内错误', 'data: {"error":{"message":"quota unavailable"}}\n'],
  ['空输出', 'data: [DONE]\n'],
  ['无效 JSON', 'data: not-json\n'],
  ['意外截断', 'data: {"choices":[{"delta":{"content":"partial"}}]}\n'],
  ['长度截断', 'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n']
]) await check(`${name} 报错且不发送 done`, async () => {
  await config(); const messages = await stream(data);
  assert.equal(messages.at(-1).type, 'error'); assert.ok(!messages.some(msg => msg.type === 'done'));
});
await check('finish_reason 终止且无 DONE 的兼容流正常完成', async () => {
  await config(); const messages = await stream(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}`);
  assert.equal(messages.at(-1).type, 'done');
});
await check('禁用、缺 Key 与无选定模型不发网络请求', async () => {
  for (const values of [{ enabled: false }, { apiKey: '' }, { modelList: [], explainModel: '' }]) {
    await config(values); const messages = await stream(sse); assert.equal(messages.at(-1).type, 'error'); assert.equal(calls.length, 0);
  }
});
const report = { date: new Date().toISOString(), tool: process.version, kind: 'offline simulation of actual worker code',
  passed: checks.filter(x => x.status === 'passed').length, failed: checks.filter(x => x.status === 'failed').length, checks,
  unverified: ['真实供应商 API、账号权限、真实模型质量、浏览器交互'] };
const reportPath = resolve(root, 'artifacts/qa/api-simulation.json');
mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
checks.forEach(c => console.log(`${c.status.toUpperCase()}: ${c.name}${c.error ? ': ' + c.error : ''}`));
if (report.failed) process.exitCode = 1;
