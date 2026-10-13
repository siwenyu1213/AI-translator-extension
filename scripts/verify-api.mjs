// Node 内置 VM + 模拟网络：验证实际后台逻辑，不代表真实供应商验收。
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
let storage = {}, calls = [], storageWrites = [], responder;
const menus = [], tabMessages = [];
const changed = event();
const chrome = {
  runtime: { onInstalled: event(), onMessage: event(), onConnect: event() },
  contextMenus: { onClicked: event(), removeAll(fn) { menus.length=0;fn(); }, create(menu) { menus.push(menu); } },
  tabs: { sendMessage(id,message) { tabMessages.push({id,message});return Promise.resolve(); } },
  storage: { onChanged: changed, local: {
    async get() { return structuredClone(storage); },
    async set(values) { storageWrites.push(Object.keys(values)); Object.assign(storage, values); changed.listeners.forEach(fn => fn({}, 'local')); },
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
  const fixture = { ...JSON.parse(JSON.stringify(run('AIConfig.migrate({})'))),
    apiBaseUrl: 'https://gateway.example/v1', apiKey: 'test-only-key',
    explainModel: 'gpt-4.1-mini', translateModel: 'gpt-4o-mini', ...values };
  delete fixture.providerConfigVersion; delete fixture.providerConnections;
  delete fixture.explainManufacturer; delete fixture.translateManufacturer;
  context.fixture = fixture;
  storage = JSON.parse(JSON.stringify(run('AIConfig.migrate(fixture)')));
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
await check('安装创建原生选区菜单，菜单点击将选区发送至正确网页（模拟 chrome API）', () => {
  chrome.runtime.onInstalled.listeners[0]();
  const menu=menus.find(menu=>menu.id==='deepseek-explain');
  assert.equal(menu.title,'📖 说文：解释选中文字');
  assert.deepEqual(Array.from(menu.contexts),['selection']);
  chrome.contextMenus.onClicked.listeners[0]({menuItemId:menu.id,selectionText:'  原生菜单选区  '},{id:42});
  assert.equal(tabMessages[0].id,42);assert.equal(tabMessages[0].message.type,'TRIGGER_EXPLAIN');
  assert.equal(tabMessages[0].message.text,'原生菜单选区');
});
await check('配置字段顺序变化与重复读取不写 storage；已有配置值保持一致',async()=>{
  const normalized=JSON.parse(JSON.stringify(run('AIConfig.migrate({})')));
  storage=Object.fromEntries(Object.entries(normalized).reverse());storageWrites=[];
  await run('AIConfig.load()');await run('AIConfig.load()');
  assert.equal(storageWrites.length,0);assert.deepEqual(storage,Object.fromEntries(Object.entries(normalized).reverse()));
});
await check('配置归一化只写变化字段，保留目录/Key/未知字段，移除旧配置字段',async()=>{
  storage={...JSON.parse(JSON.stringify(run('AIConfig.migrate({})'))),explainReasoningEffort:'invalid',
    unrelatedPreference:{keep:true},qwenApiKey:'legacy-test-only'};storageWrites=[];
  const beforeCatalog=JSON.stringify(storage.catalogSnapshot);
  await run('AIConfig.load()');
  assert.deepEqual(storageWrites,[['explainReasoningEffort']]);
  assert.equal(storage.explainReasoningEffort,'high');assert.equal(JSON.stringify(storage.catalogSnapshot),beforeCatalog);
  assert.equal(storage.unrelatedPreference.keep,true);assert.equal(storage.qwenApiKey,undefined);
});
await check('接口模型按厂家与文本能力过滤，排除其他厂家/嵌入/图像/过期且保留新型号', () => {
  context.modelFixture = [
    {id:'deepseek-flash',name:'DeepSeek Flash',input_modalities:['text','image'],output_modalities:['text']},
    {id:'deepseek-flash'},{id:'deepseek-new-model'}, {id:'gpt-4.1'},
    {id:'deepseek-embedding'}, {id:'deepseek-image',output_modalities:['image']},
    {id:'deepseek-mixed',output_modalities:['text','image']},
    {id:'deepseek-expired',expiration_date:'2020-01-01'},null
  ];
  assert.deepEqual(Array.from(run("AIModelCatalog.interfaceModels(modelFixture,'deepseek')"),m=>m.id),['deepseek-flash','deepseek-new-model']);
  assert.equal(run("AIModelCatalog.interfaceModels([{id:'models/gemini-flash'}],'google')[0].id"),'models/gemini-flash');
  assert.equal(run("AIModelCatalog.interfaceModels([{id:'ft:gpt-4.1:org:custom'}],'openai').length"),1);
});
await check('厂家接口缓存保留名称与查询时间，不把其他厂家的 ID 带入显示列表', () => {
  const profile = run("AIConfig.normalizeConnections({deepseek:{apiKey:'test-only',availableModels:['deepseek-flash','gpt-4.1'],modelEntries:[{id:'deepseek-flash',name:'Flash name'},{id:'gpt-4.1'}],modelsCheckedAt:'2026-10-10T00:00:00Z'}}).deepseek");
  assert.equal(profile.modelEntries.length,1);assert.equal(profile.modelEntries[0].name,'Flash name');
  assert.equal(profile.modelsCheckedAt,'2026-10-10T00:00:00Z');
});
await check('10 家内置目录不限定 3 款、DeepSeek 历史兼容项及原生/网关 ID', () => {
  assert.equal(run('AIModelCatalog.BUILTIN.providers.length'), 10);
  assert.equal(run('AIModelCatalog.BUILTIN.providers.every(p => p.models.length > 3)'), true);
  assert.equal(run("AIModelCatalog.resolveId({id:'deepseek/deepseek-v4.1-flash'}, 'https://api.deepseek.com')"), 'deepseek-flash');
  assert.equal(run("AIModelCatalog.resolveId({id:'deepseek/deepseek-v4.1-flash'}, 'https://openrouter.ai/api/v1')"), 'deepseek/deepseek-v4.1-flash');
  assert.equal(run("AIModelCatalog.resolveId({id:'deepseek/deepseek-v4.1-flash'}, 'https://gateway.example/v1', ['deepseek/deepseek-v4.1-flash'])"), 'deepseek/deepseek-v4.1-flash');
  assert.equal(run("AIModelCatalog.COMPATIBILITY.some(m => m.nativeId === 'deepseek-v4-flash' && m.note.includes('退役'))"), true);
});
await check('公开目录刷新按时间排序，排除非文本/批量/过期/重复，缺厂家保留缓存', async () => {
  await config();
  const model = (id, created, extras = {}) => ({ id, name: id, created,
    architecture: { input_modalities: ['text'], output_modalities: ['text'] }, ...extras });
  responder = () => Response.json({ data: [
    model('openai/gpt-new-c', 100), model('openai/gpt-new-a', 300), model('openai/gpt-new-b', 200), model('openai/gpt-new-d', 50),
    model('deepseek/only-text-model', 50), null,
    model('openai/gpt-new-a', 300), model('openai/gpt-new-a:batch', 400),
    model('openai/image-new', 500, { architecture: { input_modalities: ['text'], output_modalities: ['text', 'image'] } }),
    model('openai/expired', 600, { expiration_date: '2020-01-01' })
  ] });
  const snapshot = await run('refreshModelCatalog()');
  assert.deepEqual(Array.from(snapshot.providers[0].models, m => m.id), ['openai/gpt-new-a', 'openai/gpt-new-b', 'openai/gpt-new-c', 'openai/gpt-new-d']);
  assert.equal(snapshot.providers[1].models.length, 1); assert.equal(snapshot.providers[1].stale, false);
  assert.equal(snapshot.providers[2].stale, true);
  context.qaSnapshot = snapshot;
  assert.equal(run('AIModelCatalog.normalizeSnapshot(qaSnapshot).providers[0].models.length'), 4);
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/models');
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(snapshot.providers.length, 10); assert.equal(storage.apiKey, 'test-only-key');
});
await check('目录失败不覆盖存储，损坏缓存回退且厂家归类不改变接口', async () => {
  await config(); responder = () => new Response('{}', { status: 503 });
  const previous = JSON.stringify(storage.catalogSnapshot);
  await assert.rejects(() => run('refreshModelCatalog()'));
  assert.equal(JSON.stringify(storage.catalogSnapshot), previous);
  assert.equal(run("AIModelCatalog.normalizeSnapshot({source:AIModelCatalog.SOURCE,updatedAt:new Date().toISOString(),providers:{}}).providers.length"), 10);
  for (const [id, maker] of [['gateway/DeepSeek-V4-Pro','deepseek'], ['anthropic/claude-sonnet-5.5','anthropic'], ['Qwen/foo','qwen'], ['local/model','custom']]) {
    context.modelId = id; assert.equal(run('AIModelCatalog.providerFor(modelId)'), maker);
  }
});
await check('目录网络、超时和非 JSON 提供具体原因，失败不覆盖缓存', async () => {
  await config();
  const previous = JSON.stringify(storage.catalogSnapshot);
  for (const [response, expected] of [
    [() => { throw new TypeError('Failed to fetch'); }, /无法连接.*openrouter.ai.*Failed to fetch/],
    [() => { const err = new Error('aborted'); err.name = 'TimeoutError'; throw err; }, /超时.*20 秒/],
    [() => new Response('<html>proxy error</html>'), /未返回有效 JSON/]
  ]) {
    responder = response;
    await assert.rejects(() => run('refreshModelCatalog()'), expected);
    assert.equal(JSON.stringify(storage.catalogSnapshot), previous);
  }
});
await check('v4→厂家目录升级保留已保存的 Key/连接/选定模型且仅追加一次', () => {
  const once = run("AIConfig.migrate({apiConfigVersion:1,apiBaseUrl:'https://saved.example/v1',apiKey:'saved-test',modelList:['local/model'],explainModel:'local/model',translateModel:'local/model'})");
  context.once = once;
  const twice = run('AIConfig.migrate(once)');
  assert.equal(once.apiKey, 'saved-test'); assert.equal(twice.explainModel, 'local/model');
  assert.equal(once.modelList.length, twice.modelList.length); assert.equal(twice.apiBaseUrl, 'https://saved.example/v1');
});
await check('旧配置移除专用模型与 Key，保留语言/触发方式及自定义模型', () => {
  const result = run("AIConfig.migrate({apiKey:'old-secret',qwenApiKey:'old-secret-2',modelList:['qwen3.7-flash','deepseek-flash','vendor/custom'],explainModel:'deepseek-flash',targetLanguage:'ja',triggerMode:'contextMenu'})");
  assert.equal(result.apiKey, ''); assert.equal(result.qwenApiKey, undefined);
  assert.equal(result.explainModel, 'gpt-4.1-mini'); assert.equal(result.targetLanguage, 'ja');
  assert.ok(result.modelList.includes('vendor/custom')); assert.ok(result.modelList.length >= 31);
});
await check('完整端点、尾斜杠、子路径归一化；拒绝非法协议与 URL 内凭据', () => {
  assert.equal(run("AIConfig.normalizeBaseUrl('https://example.org/custom/v1/chat/completions/')"), 'https://example.org/custom/v1');
  for (const url of ['file:///tmp', 'https://user:pass@example.org/v1', 'https://example.org/v1?key=secret', 'not-url']) {
    context.testUrl = url; assert.throws(() => run('AIConfig.normalizeBaseUrl(testUrl)'));
  }
});
await check('新版配置再次加载不改自定义模型或连接；删除全部模型保持空列表', () => {
  const result = run("AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,apiBaseUrl:'http://localhost:1234/v1',apiKey:'local-key',modelList:[],explainModel:'',translateModel:''})");
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
await check('模型查询拒绝列表外模型、无 Key 和无效 data；有效空列表成功返回', async () => {
  await config(); responder = () => Response.json({ data: [{ id: 'valid' }] });
  assert.equal((await run("validateModel('missing')")).ok, false);
  assert.equal((await run("validateModel('valid')")).ok, true);
  assert.equal((await run("listModels({apiBaseUrl:'https://example.org/v1',apiKey:''})")).ok, false);
  responder = () => Response.json({models:[]});assert.equal((await run('listModels()')).ok,false);
  responder = () => Response.json({data:[]});
  const empty=await run('listModels()');assert.equal(empty.ok,true);assert.equal(empty.models.length,0);
});
for (const status of [401, 403, 404, 429, 500]) {
  await check(`模型查询 HTTP ${status} 正确失败`, async () => {
    await config(); responder = () => new Response('{}', { status });
    const result = await run('listModels()'); assert.equal(result.ok, false); assert.ok(result.error);
    assert.equal(result.status,status);
    assert.equal(result.code,({401:'key_invalid',403:'forbidden',404:'unsupported',429:'rate_limit'})[status] || 'service');
    assert.equal(calls.length,status>=500 ? 2 : 1);
  });
}
await check('接口瞬时 503 自动重试一次并恢复，仍使用同一厂家地址与 Key',async()=>{
  await config();let count=0;
  responder=()=>++count===1 ? new Response('{}',{status:503}) : Response.json({data:[{id:'deepseek-flash'}]});
  assert.equal((await run('listModels()')).ok,true);assert.equal(calls.length,2);
  assert.equal(calls[0].url,calls[1].url);
  assert.equal(calls[0].options.headers.Authorization,calls[1].options.headers.Authorization);
  assert.equal(calls[0].options.signal,calls[1].options.signal);
});
await check('接口网络失败短暂重试，超时不重试，固定错误不回显凭据',async()=>{
  await config();responder=()=>{throw new Error('connection failed secret-test-token');};
  let result=await run('listModels()');assert.equal(result.code,'network');assert.equal(calls.length,2);
  assert.equal(JSON.stringify(result).includes('secret-test-token'),false);
  calls=[];responder=()=>{const error=new Error('secret-test-token');error.name='TimeoutError';throw error;};
  result=await run('listModels()');assert.equal(result.code,'timeout');assert.equal(calls.length,1);
  assert.equal(JSON.stringify(result).includes('secret-test-token'),false);
});
await check('鉴权失败不重试、不回显服务端正文；非 JSON 明确区分格式异常',async()=>{
  await config();responder=()=>new Response('secret-test-token',{status:401});
  let result=await run('listModels()');assert.equal(result.code,'key_invalid');assert.equal(calls.length,1);
  assert.equal(JSON.stringify(result).includes('secret-test-token'),false);
  responder=()=>new Response('<html>secret-test-token</html>');
  result=await run('listModels()');assert.equal(result.code,'format');
  assert.equal(JSON.stringify(result).includes('secret-test-token'),false);
});
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
await check('DeepSeek 关闭总开关时八条路由禁止思考，旧深度思考值归一化为关闭（模拟）', async () => {
  const routes = [{ mode: 'A' }, { mode: 'B' }, { mode: 'C' }, { mode: 'D' },
    { mode: undefined, promptType: 'explain' }, { mode: undefined, promptType: 'translate' },
    { mode: 'C', analysis: { category: 'sentence' }, explicitTask: 'interpret' },
    { mode: undefined, promptType: 'translate', batchItems: [{ id: 'off1', text: 'batch text' }] }];
  for (const apiBaseUrl of ['https://api.deepseek.com', 'https://api.deepseek.com/v1']) {
    for (const enabled of [false, true]) {
      await config({ apiBaseUrl, explainModel: 'deepseek-flash', translateModel: 'deepseek-flash',
        modelList: ['deepseek-flash'], explainThinkingEnabled: enabled, translateThinkingEnabled: enabled });
      await run('CACHE.clear()');
      for (const [index, route] of routes.entries()) {
        const output = route.batchItems ? '<<<DS_ITEM_off1>>>\n批量译文\n<<<DS_END_off1>>>' : content;
        const response = `data: ${JSON.stringify({ choices: [{ delta: { content: output } }] })}\n\ndata: [DONE]\n`;
        const messages = await stream(response, { text: '关闭思考路由-' + index, ...route });
        const body = JSON.parse(calls.at(-1).options.body);
        assert.equal(messages.at(-1).type, 'done');
        assert.deepEqual(body.thinking, { type: 'disabled' });
        assert.equal(body.reasoning_effort, undefined);
        assert.equal(storage.explainThinkingEnabled, false);
        assert.equal(storage.translateThinkingEnabled, false);
      }
      assert.equal(calls.length, routes.length);
    }
  }
});
await check('DeepSeek 两用途总开关与深度思考独立控制，所有生成路由遵循配置（模拟）', async () => {
  const routes = [{mode:'A',kind:'explain'}, {mode:'C',kind:'explain'}, {mode:'D',kind:'explain'},
    {mode:undefined,promptType:'explain',kind:'explain'},
    {mode:'C',analysis:{category:'sentence'},explicitTask:'interpret',kind:'explain'},
    {mode:'B',kind:'translate'}, {mode:undefined,promptType:'translate',kind:'translate'},
    {mode:undefined,promptType:'translate',batchItems:[{id:'on1',text:'batch'}],kind:'translate'}];
  for (const allowExplain of [false,true]) for (const allowTranslate of [false,true]) for (const deep of [false,true]) {
    await config({apiBaseUrl:'https://api.deepseek.com/v1',modelList:['deepseek-flash'],
      explainModel:'deepseek-flash',translateModel:'deepseek-flash',
      explainDeepSeekThinkingEnabled:allowExplain,translateDeepSeekThinkingEnabled:allowTranslate,
      explainThinkingEnabled:deep,translateThinkingEnabled:deep,
      explainReasoningEffort:'low',translateReasoningEffort:'medium'});
    for (const [index,route] of routes.entries()) {
      const output = route.batchItems ? '<<<DS_ITEM_on1>>>译文<<<DS_END_on1>>>' : content;
      const messages = await stream(`data: ${JSON.stringify({choices:[{delta:{content:output,reasoning_content:'模拟思考'}}]})}\n\ndata: [DONE]\n`,{text:'开关组合-'+index,...route});
      const body = JSON.parse(calls.at(-1).options.body);
      const allow = route.kind==='explain' ? allowExplain : allowTranslate;
      assert.deepEqual(body.thinking,{type:allow?'enabled':'disabled'});
      assert.equal(body.reasoning_effort,allow&&deep?(route.kind==='explain'?'low':'medium'):undefined);
      assert.equal(messages.at(-1).type,'done');
    }
    assert.equal(calls.length,routes.length);
  }
});
await check('切换 DeepSeek 总开关使已缓存的相同选区重新请求（模拟）', async () => {
  await config({apiBaseUrl:'https://api.deepseek.com',modelList:['deepseek-flash'],explainModel:'deepseek-flash'});
  await stream(sse); await stream(sse); assert.equal(calls.length,1);
  await chrome.storage.local.set({explainDeepSeekThinkingEnabled:true});
  await stream(sse); assert.equal(calls.length,2);
  assert.deepEqual(JSON.parse(calls[1].options.body).thinking,{type:'enabled'});
  await chrome.storage.local.set({explainDeepSeekThinkingEnabled:false});
  await stream(sse); assert.equal(calls.length,3);
  assert.deepEqual(JSON.parse(calls[2].options.body).thinking,{type:'disabled'});
});
await check('其他端点即使模型名含 DeepSeek 也不接收厂家专用关闭参数，原思考设置保持（模拟）', async () => {
  for (const apiBaseUrl of ['https://gateway.example/v1', 'https://api.deepseek.com.example/v1']) {
    for (const enabled of [false, true]) {
      await config({ apiBaseUrl, explainModel: 'deepseek-flash', modelList: ['deepseek-flash'],
        explainThinkingEnabled: enabled, explainReasoningEffort: 'low' });
      await run('CACHE.clear()');
      await stream(sse);
      const body = JSON.parse(calls[0].options.body);
      assert.equal(body.thinking, undefined);
      assert.equal(body.reasoning_effort, enabled ? 'low' : undefined);
    }
  }
});
await check('配置和目标语言更改清缓存，缓存不混用不同端点', async () => {
  await config(); await stream(sse); await stream(sse); assert.equal(calls.length, 1);
  await chrome.storage.local.set({ providerConnections: { custom: { ...storage.providerConnections.custom, apiBaseUrl: 'https://other.example/v1' } }, targetLanguage: 'ja' });
  await stream(sse); assert.equal(calls.length, 2); assert.equal(calls[1].url, 'https://other.example/v1/chat/completions');
});
await check('10 家官方地址固定；自定义保留地址；不借用全局 Key', () => {
  assert.equal(run('Object.keys(AIConfig.PROVIDER_ENDPOINTS).length'), 10);
  const connection = run("AIConfig.connectionFor({providerConfigVersion:1,explainManufacturer:'deepseek',apiKey:'legacy-only',providerConnections:{deepseek:{apiBaseUrl:'https://wrong.example/v1'}}})");
  assert.equal(connection.apiBaseUrl, 'https://api.deepseek.com'); assert.equal(connection.apiKey, '');
  assert.equal(run("AIConfig.connectionFor({providerConfigVersion:1,explainManufacturer:'custom',providerConnections:{custom:{apiBaseUrl:'http://localhost:1234/v1',apiKey:'custom-only'}}}).apiBaseUrl"), 'http://localhost:1234/v1');
});
await check('原网关配置迁移为自定义；重载保持显式厂家和 Key', async () => {
  await config(); assert.equal(storage.explainManufacturer, 'custom');
  assert.equal(storage.providerConnections.custom.apiKey, 'test-only-key');
  await run('AIConfig.load()'); assert.equal(storage.explainManufacturer, 'custom');
  assert.equal(storage.translateManufacturer, 'custom');
  assert.equal(storage.providerConnections.custom.apiBaseUrl, 'https://gateway.example/v1');
});
await check('解释走 DeepSeek，B 与全文走 Gemini；各自地址、Key、模型准确（模拟）', async () => {
  await config();
  await chrome.storage.local.set({ explainManufacturer: 'deepseek', translateManufacturer: 'google',
    explainModel: 'deepseek-flash', translateModel: 'gemini-3.8-flash',
    modelList: ['deepseek-flash', 'gemini-3.8-flash'],
    providerConnections: { deepseek: { apiKey: 'ds-test-only' }, google: { apiKey: 'google-test-only' } } });
  for (const [request, provider, key, model] of [
    [{mode:'C'}, 'deepseek', 'ds-test-only', 'deepseek-flash'],
    [{mode:'B'}, 'google', 'google-test-only', 'gemini-3.8-flash'],
    [{mode:undefined,promptType:'translate',text:'全文'}, 'google', 'google-test-only', 'gemini-3.8-flash']
  ]) {
    await stream(sse, request);
    assert.equal(calls.at(-1).url, run(`AIConfig.PROVIDER_ENDPOINTS['${provider}']`) + '/chat/completions');
    assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer ' + key);
    assert.equal(JSON.parse(calls.at(-1).options.body).model, model);
  }
});
await check('切换到未配置厂家阻止请求；另一厂家 Key 不外发（模拟）', async () => {
  await config(); await chrome.storage.local.set({ explainManufacturer: 'xai' });
  const messages = await stream(sse);
  assert.equal(calls.length, 0); assert.equal(messages[0].type, 'error');
  assert.match(messages[0].error, /所选厂家/);
});
await check('空模型保持空，不回填其他厂家预设；接口列表外模型阻止发请求', async () => {
  await config();
  await chrome.storage.local.set({explainModel:''});
  await run('AIConfig.load()');assert.equal(storage.explainModel,'');
  await chrome.storage.local.set({explainManufacturer:'deepseek',explainModel:'deepseek-old',modelList:['deepseek-old'],
    providerConnections:{deepseek:{apiKey:'test-only',availableModels:['deepseek-flash'],modelsCheckedAt:'2026-10-10T00:00:00Z'}}});
  const messages=await stream(sse);assert.equal(calls.length,0);assert.match(messages[0].error,/当前厂家/);
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
async function batchStream(data, items = [{id:'b0',text:'First paragraph'}, {id:'b1',text:'Second paragraph'}]) {
  responder = () => new Response(data, {headers:{'Content-Type':'text/event-stream'}});
  const messages=[];
  context.testPort={onDisconnect:event(),postMessage:message=>messages.push(message),disconnect(){}};
  context.testBatch={items,context:{title:'Batch QA'},batchId:'batch-qa'};
  await run('handleTranslateBatchRequest(testPort,testBatch)');
  return messages;
}
const batchOutput='<<<DS_ITEM_b1>>>第二段译文<<<DS_END_b1>>>\n<<<DS_ITEM_b0>>>第一段译文<<<DS_END_b0>>>';
const batchSse=`data: ${JSON.stringify({choices:[{delta:{content:batchOutput}}]})}\n\ndata: [DONE]\n`;
await check('批量翻译使用所选 Gemini 连接与最小参数，乱序标记按 ID 返回（模拟）',async()=>{
  await config();await chrome.storage.local.set({translateManufacturer:'google',translateModel:'gemini-qa',modelList:['gpt-4.1-mini','gemini-qa'],
    providerConnections:{google:{apiKey:'google-test-only'}}});
  const messages=await batchStream(batchSse);
  assert.equal(calls[0].url,run('AIConfig.PROVIDER_ENDPOINTS.google')+'/chat/completions');
  assert.equal(calls[0].options.headers.Authorization,'Bearer google-test-only');
  const body=JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(body).sort(),['messages','model','stream']);assert.equal(body.model,'gemini-qa');
  assert.match(body.messages[1].content,/网页标题：Batch QA/);
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).items)),[{id:'b0',text:'第一段译文'},{id:'b1',text:'第二段译文'}]);
  assert.equal(messages.some(message=>message.type==='token'),false);
});
await check('批量缓存复用同一连接，目标语言改变后失效（模拟）',async()=>{
  await config();await batchStream(batchSse);assert.equal(calls.length,1);
  await batchStream(batchSse);assert.equal(calls.length,1);
  await chrome.storage.local.set({targetLanguage:'ja'});await batchStream(batchSse);assert.equal(calls.length,2);
});
await check('批量缺项/重复/未知 ID 或截断只报错，不缓存无效译文（模拟）',async()=>{
  for(const output of ['<<<DS_ITEM_b0>>>只有第一段<<<DS_END_b0>>>',batchOutput+batchOutput,
    batchOutput+'<<<DS_ITEM_other>>>其他<<<DS_END_other>>>']){
    await config();const data=`data: ${JSON.stringify({choices:[{delta:{content:output}}]})}\n\ndata: [DONE]\n`;
    const messages=await batchStream(data);assert.equal(messages.at(-1).type,'error');assert.equal(run('CACHE.size'),0);
  }
  await config();assert.equal((await batchStream('data: {"error":{"message":"batch failed"}}\n')).at(-1).type,'error');
});
await check('批量重复或不安全输入 ID、未配置厂家不发网络请求（模拟）',async()=>{
  for(const items of [[{id:'bad-id',text:'Text'}],[{id:'b0',text:'Text'},{id:'b0',text:'Other'}],[]]){
    await config();assert.equal((await batchStream(batchSse,items)).at(-1).type,'error');assert.equal(calls.length,0);
  }
  await config();await chrome.storage.local.set({translateManufacturer:'xai'});
  assert.equal((await batchStream(batchSse)).at(-1).type,'error');assert.equal(calls.length,0);
});
await check('长内容与思考输出分成最多 2048 字符消息，完整文本不丢失（模拟）',async()=>{
  await config();const long='流'.repeat(7000),reasoning='思'.repeat(5000);
  const messages=await stream(`data: ${JSON.stringify({choices:[{delta:{content:long,reasoning_content:reasoning}}]})}\n\ndata: [DONE]\n`);
  assert.equal(messages.filter(m=>m.type==='token').map(m=>m.token).join(''),long);
  assert.equal(messages.filter(m=>m.type==='reasoning-token').map(m=>m.token).join(''),reasoning);
  assert.ok(messages.filter(m=>m.token).every(m=>m.token.length<=2048));assert.equal(messages.at(-1).type,'done');
});
await check('生成短暂 503 退避后恢复；退避期间取消立即停止，不继续请求（模拟）',async()=>{
  await config();let attempts=0;
  responder=()=>++attempts===1 ? new Response('{}',{status:503}) : new Response(sse);
  context.testPort={onDisconnect:event(),postMessage(){},disconnect(){}};
  await run("handleStreamRequest(testPort,{mode:'C',text:'生成重试'})");assert.equal(attempts,2);
  attempts=0;responder=()=>{attempts++;return new Response('{}',{status:503});};
  context.retryController=new AbortController();
  const pending=run("fetchWithRetry('https://qa.example',{signal:retryController.signal})");
  const rejected=assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,20));
  context.retryController.abort();await rejected;assert.equal(attempts,1);
});
const report = { date: new Date().toISOString(), tool: process.version, kind: 'offline simulation of actual worker code',
  passed: checks.filter(x => x.status === 'passed').length, failed: checks.filter(x => x.status === 'failed').length, checks,
  unverified: ['真实供应商 API、账号权限、真实模型质量、浏览器交互'] };
const reportPath = resolve(root, 'artifacts/qa/api-simulation.json');
mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
checks.forEach(c => console.log(`${c.status.toUpperCase()}: ${c.name}${c.error ? ': ' + c.error : ''}`));
if (report.failed) process.exitCode = 1;
