// ========== 说文 · LingoClarify — Service Worker ==========
// 文件职责：右键菜单与消息分发、流式 API 代理、DeepSeek 思考参数、请求缓存和笔记下载。

const CACHE = new Map();
const CACHE_MAX = 100;
const MAX_STREAM_CHARS = 2048;
let cacheRevision = 0;

importScripts('model-catalog.js');
importScripts('config.js');
importScripts('selection.js');
importScripts('selection-prompts.js');

// ═══════════════════════════════════════════
// 右键菜单：安装/更新时创建（精简为两项）
// ═══════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  // 先清除旧菜单再重建，避免扩展更新/浏览器升级时重复 create 同 id 报错
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'deepseek-explain',
      title: '📖 说文：解释选中文字',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'deepseek-fullpage',
      title: '🌐 说文：全文翻译',
      contexts: ['page']
    });
  });
});

// ═══════════════════════════════════════════
// 右键菜单点击分发
// ═══════════════════════════════════════════

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'deepseek-explain' && info.selectionText && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_EXPLAIN',
      text: info.selectionText.trim()
    }).catch(() => {});
  }
  if (info.menuItemId === 'deepseek-fullpage' && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_FULLPAGE_TRANSLATE'
    }).catch(() => {});
  }
});

// ═══════════════════════════════════════════
// 消息路由
// ═══════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REFRESH_MODEL_CATALOG') {
    refreshModelCatalog()
      .then(snapshot => sendResponse({ ok: true, snapshot }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'DOWNLOAD') {
    handleDownload(message.text, message.explanation)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: '下载失败，请重试' }));
    return true;
  }
  // 全文翻译注入
  if (message.type === 'INJECT_FULLPAGE_TRANSLATE') {
    injectFullPageTranslator(sender);
    return false;
  }
  if (message.type === 'LIST_MODELS') {
    listModels(message.connection)
      .then(sendResponse)
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  // 查询模型列表不代表已经完成一次生成请求。
  if (message.type === 'VALIDATE_MODEL') {
    validateModel(message.model, message.connection)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message || '模型检测失败' }));
    return true; // 异步响应
  }
});

let catalogRefresh = null;
function refreshModelCatalog() {
  if (!catalogRefresh) catalogRefresh = (async () => {
    const stored = await chrome.storage.local.get('catalogSnapshot');
    // 公开目录不带用户 Key、地址或任何网页数据。
    const snapshot = await AIModelCatalog.refresh(stored.catalogSnapshot);
    await chrome.storage.local.set({ catalogSnapshot: snapshot });
    return snapshot;
  })().finally(() => { catalogRefresh = null; });
  return catalogRefresh;
}

// ═══════════════════════════════════════════
// 全文翻译脚本注入
// ═══════════════════════════════════════════

async function injectFullPageTranslator(sender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-fullpage.js']
    });
  } catch (err) {
    console.error('[AI] 全文翻译注入失败:', err);
  }
}

// ═══════════════════════════════════════════
// 流式连接入口：explain 和 translate 共用
// ═══════════════════════════════════════════

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('stream-')) return;

  port.onMessage.addListener((msg) => {
    if (msg.type === 'STREAM_REQUEST') {
      handleStreamRequest(port, msg);
    }
    // 全文翻译批量流式请求
    if (msg.type === 'STREAM_BATCH') {
      handleStreamRequest(port, {
        promptType: msg.promptType || 'translate',
        text: msg.text,
        context: msg.context,
        batchId: msg.batchId
      });
    }
    if (msg.type === 'STREAM_TRANSLATE_BATCH') {
      handleTranslateBatchRequest(port, msg);
    }
  });
});

// ═══════════════════════════════════════════
// 统一流式处理器
// ═══════════════════════════════════════════

async function handleStreamRequest(rawPort, request) {
  const controller = new AbortController();
  let closed = false;
  // Listen before configuration/storage awaits, including migration and cache reads.
  rawPort.onDisconnect.addListener(() => { closed = true; controller.abort(); });
  const port = {
    postMessage(message) {
      if (closed) return false;
      try { rawPort.postMessage(message); return true; }
      catch { closed = true; controller.abort(); return false; }
    },
    disconnect() {
      if (closed) return;
      closed = true;
      controller.abort();
      try { rawPort.disconnect(); } catch {}
    }
  };
  try {
    await performStreamRequest(port, request, controller);
  } catch (error) {
    if (!controller.signal.aborted) port.postMessage({ type: 'error', error: error.message || '请求失败', batchId: request.batchId });
  } finally { port.disconnect(); }
}

async function performStreamRequest(port, { promptType, text, context, batchId, mode, batchItems, analysis, explicitTask }, controller) {
  const config = await getConfig();
  controller.signal.throwIfAborted();
  if (config.enabled === false) {
    port.postMessage({ type: 'error', error: '扩展已禁用', batchId });
    port.disconnect();
    return;
  }

  let prompt, systemPrompt, model, thinkingEnabled, reasoningEffort;

  // 🆕 四分类模式（来自智能解释的本地分类）
  if (mode) {
    if (mode === 'B') {
      // 浮层翻译原意及文中含义 → 使用翻译标签的模型
      model = config.translateModel;
      thinkingEnabled = config.translateThinkingEnabled || false;
      reasoningEffort = config.translateReasoningEffort || 'high';
    } else {
      model = config.explainModel;
      thinkingEnabled = config.explainThinkingEnabled || false;
      reasoningEffort = config.explainReasoningEffort || 'high';
    }
    systemPrompt = SELECTION_SYSTEM_PROMPT;

    if (analysis && !batchItems) {
      prompt = buildSelectionPrompt(text, context, analysis, mode, config, explicitTask);
    } else if (mode === 'A') {
      prompt = buildTranslateExplainPrompt(text, context);
    } else if (mode === 'B') {
      prompt = buildPureTranslatePrompt(text, config.targetLanguage || 'zh', context);
    } else if (mode === 'C') {
      prompt = buildExplainPrompt(text, config.language, context);
    } else if (mode === 'D') {
      prompt = buildContextualInterpretPrompt(text, context);
    }
  } else if (promptType === 'explain') {
    // 兼容旧路径
    model = config.explainModel;
    thinkingEnabled = config.explainThinkingEnabled || false;
    reasoningEffort = config.explainReasoningEffort || 'high';
    systemPrompt = SELECTION_SYSTEM_PROMPT;
    prompt = buildExplainPrompt(text, config.language, context);
  } else {
    // translate (fullpage / pdf)
    model = config.translateModel;
    thinkingEnabled = config.translateThinkingEnabled || false;
    reasoningEffort = config.translateReasoningEffort || 'high';
    systemPrompt = '你是一个专业的翻译引擎。只输出译文，不要任何解释、说明。';
    prompt = buildTranslatePrompt(text, config.targetLanguage || 'zh', context);
  }

  if (batchItems) {
    prompt = buildBatchTranslatePrompt(batchItems, config.targetLanguage || 'zh', context);
    systemPrompt = '你是一个专业的翻译引擎。只输出规定格式的译文，不要任何解释、说明。';
  }

  if (!model) {
    port.postMessage({ type: 'error', error: '请先选择模型并保存设置', batchId });
    port.disconnect();
    return;
  }
  const kind = mode ? (mode === 'B' ? 'translate' : 'explain') : (promptType === 'explain' ? 'explain' : 'translate');
  let baseUrl;
  let connection;
  try {
    connection = AIConfig.connectionFor(config, kind);
    baseUrl = AIConfig.normalizeBaseUrl(connection.apiBaseUrl);
  }
  catch (err) {
    port.postMessage({ type: 'error', error: err.message, batchId });
    port.disconnect();
    return;
  }
  const apiKey = connection.apiKey;
  if (!apiKey) {
    port.postMessage({ type: 'error', error: '请先填写所选厂家的 API Key', batchId });
    port.disconnect();
    return;
  }
  if ((connection.modelsCheckedAt || connection.availableModels.length) && !connection.availableModels.includes(model)) {
    port.postMessage({type:'error',error:'请重新选择当前厂家的可用模型',batchId});
    port.disconnect();
    return;
  }

  // 官方端点显式控制思考；第三方网关不凭模型名发送厂家专用参数。
  const deepSeek = AIConfig.isDeepSeekEndpoint(baseUrl);
  const deepSeekThinkingEnabled = deepSeek && config[kind + 'DeepSeekThinkingEnabled'] === true;
  if (deepSeek && !deepSeekThinkingEnabled) thinkingEnabled = false;

  // 缓存检查（键包含思考开关，避免开关切换后命中旧缓存）
  const cacheKey = JSON.stringify([cacheRevision, baseUrl, model, systemPrompt, prompt,
    deepSeekThinkingEnabled, thinkingEnabled, reasoningEffort]);
  const doneMessage = output => {
    if (!batchItems) return { type: 'done', model, batchId };
    const items = parseBatchTranslation(output, batchItems.map(item => item.id));
    if (!items) throw new Error('批量译文解析失败，将回退为逐块翻译');
    return { type: 'done', model, batchId, items };
  };
  const postChunk = (type, token) => {
    if (batchItems) return;
    for (let i = 0; i < token.length; i += MAX_STREAM_CHARS) {
      port.postMessage({ type, token: token.slice(i, i + MAX_STREAM_CHARS), batchId });
    }
  };
  if (CACHE.has(cacheKey)) {
    // 模拟流式：分 chunk 发送缓存结果
    const cached = CACHE.get(cacheKey);
    const chunks = batchItems ? [] : splitIntoChunks(cached, Math.ceil(cached.length / MAX_STREAM_CHARS));
    for (const chunk of chunks) {
      controller.signal.throwIfAborted();
      // 端口可能已被页面断开（用户关闭弹窗），发送失败即中止
      try {
        if (!port.postMessage({ type: 'token', token: chunk, batchId })) return;
        await sleep(16);
      } catch {
        port.disconnect();
        return;
      }
    }
    port.postMessage(doneMessage(cached));
    port.disconnect();
    return;
  }

  let timedOut = false;
  let timeout;
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
  };
  resetTimeout();

  try {
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      stream: true
    };
    // 默认使用最小公共参数，避免不同模型对 temperature / token 上限的差异。
    if (deepSeek) body.thinking = { type: deepSeekThinkingEnabled ? 'enabled' : 'disabled' };
    if (thinkingEnabled) body.reasoning_effort = reasoningEffort;
    const endpoint = `${baseUrl}/chat/completions`;

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const errMsg = await parseApiError(res);
      port.postMessage({ type: 'error', error: errMsg, batchId });
      return;
    }

    if (!res.body) throw new Error('接口没有返回响应流');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', fullText = '', finished = false, sawFinish = false;
    function consume(line) {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data) return;
      if (data === '[DONE]') { finished = true; return; }
      let parsed;
      try { parsed = JSON.parse(data); }
      catch { throw new Error('接口返回了无效的流式 JSON'); }
      if (parsed.error) throw new Error(parsed.error.message || '接口流式响应报错');
      const choice = parsed?.choices?.[0];
      const reasoning = choice?.delta?.reasoning_content;
      if (typeof reasoning === 'string' && reasoning) postChunk('reasoning-token', reasoning);
      const token = choice?.delta?.content;
      if (typeof token === 'string' && token) {
        fullText += token;
        postChunk('token', token);
      }
      if (choice?.finish_reason === 'length') throw new Error('模型输出达到长度上限，请缩短待翻译文本');
      if (choice?.finish_reason === 'content_filter') throw new Error('接口过滤了模型输出');
      if (choice?.finish_reason) sawFinish = true;
    }
    try {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimeout();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) { consume(line); if (finished) break; }
      }
      if (!finished) {
        buffer += decoder.decode();
        for (const line of buffer.split('\n')) { consume(line); if (finished) break; }
      }
    } finally { await reader.cancel().catch(() => {}); }
    if (!fullText) throw new Error('模型没有返回文本，请确认该模型支持流式 Chat Completions');
    if (!finished && !sawFinish) throw new Error('响应流意外中断，请重试');
    const result = doneMessage(fullText);
    if (fullText.length > 10) {
      CACHE.set(cacheKey, fullText);
      if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    }
    port.postMessage(result);
  } catch (err) {
    if (timedOut || err.name !== 'AbortError') {
      port.postMessage({ type: 'error', error: timedOut ? '接口响应超时，请检查网络或接口地址' : err.message, batchId });
    }
  } finally {
    clearTimeout(timeout);
    port.disconnect();
  }
}

// ═══════════════════════════════════════════
// Prompt 构建
// ═══════════════════════════════════════════

const SELECTION_SYSTEM_PROMPT = AISelectionPrompts.SYSTEM;

function buildSelectionPrompt(text, context, analysis, mode, config, explicitTask) {
  return AISelectionPrompts.build(text, context, analysis, mode, config, explicitTask);
}

function buildExplainPrompt(text, language, context) {
  return buildSelectionPrompt(text, context, AISelection.analyze(text), 'C', { language });
}

function buildTranslatePrompt(text, targetLanguage, context) {
  const langNames = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', ar: 'العربية' };
  const targetName = langNames[targetLanguage] || targetLanguage;

  let contextBlock = '';
  if (context && (context.before || context.after)) {
    contextBlock = `\n[上下文]\n标题：${context.title || '未知'}\n上文：${context.before || ''}\n下文：${context.after || ''}\n`;
  }

  return `你是一个专业的翻译引擎。请将以下文本翻译为${targetName}。
${contextBlock}
[待翻译文本]
"""
${text}
"""

规则：
- 只输出翻译结果，不要任何解释、说明、开场白
- 翻译要准确、自然、符合目标语言习惯
- 结合上下文理解多义词和指代，确保翻译准确
- 保持原文的语气和风格（正式/非正式、技术/日常）
- 如果文本中包含专有名词、数字、代码等，保持原样
- 不要使用任何 Markdown 格式`;
}

// 🆕 模式 A：外语短词 → 先翻译成中文，再解释
function buildTranslateExplainPrompt(text, context) {
  return buildSelectionPrompt(text, context, AISelection.analyze(text), 'A', { language: 'zh' });
}

// 模式 B：外语句段 → 浮层原意译文和文中含义（旧消息兼容入口）
function buildPureTranslatePrompt(text, targetLanguage, context) {
  return buildSelectionPrompt(text, context, AISelection.analyze(text), 'B', { targetLanguage });
}

// 🆕 模式 D：中文长段 → 语境解读
function buildContextualInterpretPrompt(text, context) {
  return buildSelectionPrompt(text, context, AISelection.analyze(text), 'D', { language: 'zh' }, 'interpret');
}

// ═══════════════════════════════════════════
// 配置读取
// ═══════════════════════════════════════════

// 会话级配置缓存：避免全文翻译高并发时每个请求都读 storage
let configCache = null;
let configLoad = null;
let configRevision = 0;
const GENERATION_FIELDS = new Set(['enabled', 'usePageContext', 'triggerMode',
  'language', 'targetLanguage', 'explainModel', 'translateModel',
  'explainManufacturer', 'translateManufacturer', 'explainThinkingEnabled',
  'translateThinkingEnabled', 'explainReasoningEffort', 'translateReasoningEffort',
  'explainDeepSeekThinkingEnabled', 'translateDeepSeekThinkingEnabled',
  'apiBaseUrl', 'apiKey', 'availableModels', 'modelList', 'modelManufacturers',
  'apiConfigVersion', 'providerConfigVersion', 'modelCatalogVersion',
  'qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort']);
function generationConnections(value) {
  return Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, value]) => {
      const entry = value || {}, models = AIConfig.normalizeModels(entry.availableModels).sort();
      return [id, entry.apiBaseUrl, entry.apiKey, models, Boolean(entry.modelsCheckedAt || models.length)];
    });
}
function affectsGeneration(changes) {
  return Object.keys(changes).length === 0 || Object.entries(changes).some(([key, change]) => {
    if (key === 'providerConnections') {
      return JSON.stringify(generationConnections(change.oldValue)) !==
        JSON.stringify(generationConnections(change.newValue));
    }
    return GENERATION_FIELDS.has(key) && JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue);
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // 每次保存都防止陈旧配置读回；仅生成语义变化使回答缓存失效。
  configCache = null; configLoad = null; configRevision++;
  if (affectsGeneration(changes)) { cacheRevision++; CACHE.clear(); }
});
async function getConfig() {
  while (!configCache) {
    const revision = configRevision;
    if (!configLoad) configLoad = AIConfig.load({ isCurrent: () => revision === configRevision });
    const pending = configLoad;
    let config;
    try { config = await pending; }
    catch (error) {
      if (revision !== configRevision) continue;
      if (configLoad === pending) configLoad = null;
      throw error;
    }
    // An old storage read must never repopulate a cache invalidated while awaiting it.
    if (revision !== configRevision) continue;
    if (!config) { if (configLoad === pending) configLoad = null; continue; }
    configCache = config;
    if (configLoad === pending) configLoad = null;
  }
  return configCache;
}

// ═══════════════════════════════════════════
// API 错误解析
// ═══════════════════════════════════════════

// 批量协议复用通用生成路径，厂家路由、Key、超时、SSE 校验与缓存保持一致。
function buildBatchTranslatePrompt(items, targetLanguage, context) {
  const langNames = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', ar: 'العربية' };
  const blocks = items.map(item => `<<<DS_ITEM_${item.id}>>>\n${item.text}\n<<<DS_END_${item.id}>>>`).join('\n\n');
  return `你是一个专业的翻译引擎，请将下面每个标记块中的文本翻译为${langNames[targetLanguage] || targetLanguage}。
${context?.title ? `网页标题：${context.title}\n\n` : ''}${blocks}

输出要求：
- 只输出翻译后的标记块，保持 <<<DS_ITEM_xxx>>> 和 <<<DS_END_xxx>>> 标记原样
- 标记中的 xxx 是 id，必须与输入完全一致
- 不要合并、遗漏、新增任何标记块
- 不要输出解释、说明、Markdown 代码块
- 保留原文段落结构和换行`;
}

function parseBatchTranslation(raw, expectedIds) {
  const map = new Map();
  const re = /<<<DS_ITEM_([A-Za-z0-9_]+)>>>([\s\S]*?)<<<DS_END_\1>>>/g;
  for (const match of String(raw || '').matchAll(re)) {
    if (map.has(match[1]) || !expectedIds.includes(match[1])) return null;
    map.set(match[1], match[2].trim());
  }
  if (expectedIds.some(id => !map.get(id))) return null;
  return expectedIds.map(id => ({ id, text: map.get(id) }));
}

async function handleTranslateBatchRequest(port, { items, context, batchId }) {
  if (!Array.isArray(items) || !items.length || items.length > 8 ||
      items.some(item => !item || typeof item.id !== 'string' || !/^[A-Za-z0-9_]+$/.test(item.id) ||
        typeof item.text !== 'string' || !item.text.trim()) ||
      new Set(items.map(item => item.id)).size !== items.length) {
    try { port.postMessage({ type: 'error', error: '批量翻译内容或标记无效', batchId }); } catch {}
    try { port.disconnect(); } catch {}
    return;
  }
  await handleStreamRequest(port, { promptType: 'translate', text: '', context, batchId, batchItems: items });
}

// 保留 main 的生成退避重试，取消/超时信号在等待期间也立即生效。
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    let response;
    try {
      response = await fetch(url, options);
      if ((response.status !== 429 && response.status < 500) || attempt >= maxRetries) return response;
    } catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError' || attempt >= maxRetries) throw error;
    }
    const retryAfter = Number(response?.headers.get('Retry-After') || 0);
    await response?.body?.cancel().catch(() => {});
    const delay = retryAfter > 0 ? Math.min(8000, retryAfter * 1000) : Math.min(8000, 500 * 2 ** attempt);
    await new Promise((resolve, reject) => {
      const signal = options.signal;
      const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(finish, delay);
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
}

async function parseApiError(res) {
  try {
    const body = await res.text();
    if (res.status === 401) return 'API Key 无效，请检查设置';
    if (res.status === 402) return '账户余额不足，请充值';
    if (res.status === 403) return 'API Key 无权访问，请检查';
    if (res.status === 429) return '请求过于频繁，请稍后再试';
    if (res.status === 400) return '请求参数或模型不受支持，请检查模型名；若开启思考，请尝试关闭';
    if (res.status === 404) return '接口路径或模型不存在，请检查 Base URL 和模型名';
    return `API 错误 (${res.status}): ${body.slice(0, 100)}`;
  } catch {
    return `API 错误 (${res.status})`;
  }
}

// ═══════════════════════════════════════════
// 模型可用性检测
// ═══════════════════════════════════════════

async function listModels(connection) {
  const config = connection || AIConfig.connectionFor(await getConfig());
  return AIModelCatalog.fetchInterface(config);
}

async function validateModel(inputModel, connection) {
  const model = AIConfig.normalizeModel(inputModel);
  if (!model || /\s/.test(model)) return { ok: false, error: '请输入不含空格的模型调用名' };
  const result = await listModels(connection);
  if (!result.ok) return result;
  if (!result.models.includes(model)) return { ok: false, error: `接口模型列表中未找到：${model}` };
  return { ok: true, model: { id: model } };
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

function splitIntoChunks(text, count) {
  if (!text || count <= 1) return [text || ''];
  const len = text.length;
  const size = Math.ceil(len / count);
  const chunks = [];
  for (let i = 0; i < len; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [''];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════
// 下载
// ═══════════════════════════════════════════

async function handleDownload(selectedText, explanation) {
  if (typeof selectedText !== 'string' || typeof explanation !== 'string' || !explanation.trim()) {
    return { ok: false, error: '没有可下载的内容' };
  }
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `笔记/说文_${timestamp}.txt`;

  const content = [
    `说文 · LingoClarify`,
    `生成时间: ${now.toLocaleString('zh-CN')}`,
    ``,
    `── 选中原文 ──`,
    selectedText,
    ``,
    `── 解释内容 ──`,
    explanation,
    ``,
  ].join('\n');

  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const dataUrl = 'data:text/plain;charset=utf-8;base64,' + btoa(binary);

  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });
  return Number.isInteger(downloadId) ? { ok: true, downloadId } : { ok: false, error: '下载未启动' };
}

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 后台：接收网页和设置页的消息，联系模型服务，发回回答，保存笔记。
// content.js / popup.js → 本文件 → config.js 选连接 → 模型接口 → content.js 显示结果。
// 先看消息入口，再看 performStreamRequest；请求、缓存、取消、报错都在这里。
//
// 二、先认识常见写法
// const：保存一个不重新赋值的名字；let：保存之后可以换值的名字。对象内容仍可修改。
// function / 箭头 =>：把步骤打包成函数，调用时才执行；立即执行函数用于初始化。
// if / else：符合条件走一条路，否则走另一条；return：结束当前函数并交回结果。
// async / await：等存储或网络完成后再继续；等待时浏览器仍能处理其他工作。
// try / catch / finally：尝试操作、处理错误、最后清理；事件监听函数收到通知后执行。
// 对象 {...} 保存一组字段；数组 [...] 保存列表；Map 按标识存资料；Set 自动去重。
// === 判断严格相等；&& 同时成立；|| 取备用值；?. 值存在才访问；?? 仅缺失时取备用值。
// 后缀“的 length”是数量/长度，“的 value”是控件值，“的 textContent”是元素显示文字。
//
// 三、按原代码顺序逐句看
// 行号对应本文件上方原代码；空行和原有说明不重复解释。
// 同一行有多句时按先后用分号分开；跨行表达式在起始行解释，并标明续行。
// 第 4 行：准备 CACHE（已完成回答的缓存）：建立按标识存取资料的 Map 表。
// 第 5 行：准备 CACHE_MAX（缓存最多保留的条数）：100。
// 第 6 行：准备 MAX_STREAM_CHARS（单次消息最多发送的字符数）：2048。
// 第 7 行：准备 cacheRevision（回答缓存版本）：0。
// 第 9 行：加载共用脚本 “model-catalog.js”。
// 第 10 行：加载共用脚本 “config.js”。
// 第 11 行：加载共用脚本 “selection.js”。
// 第 12 行：加载共用脚本 “selection-prompts.js”。
// 第 18 行：扩展安装或更新时执行菜单初始化。
// 第 20 行：先删除旧菜单，再创建当前菜单，避免同名菜单重复。
// 第 21 行：创建一个原生右键菜单项目。
// 第 22 行：划词菜单的内部标识。
// 第 23 行：划词菜单显示名称。
// 第 24 行：只有选中文字时显示此菜单。
// 第 25 行：结束前面的代码块、资料列表或函数调用。
// 第 26 行：创建一个原生右键菜单项目。
// 第 27 行：全文菜单的内部标识。
// 第 28 行：全文菜单显示名称。
// 第 29 行：在网页空白处右键时显示此菜单。
// 第 30 行：结束前面的代码块、资料列表或函数调用。
// 第 31 行：结束前面的代码块、资料列表或函数调用。
// 第 32 行：结束前面的代码块、资料列表或函数调用。
// 第 38 行：监听原生右键菜单点击。
// 第 39 行：点击划词菜单、有选中文字且有有效标签页时，通知该页面。
// 第 40 行：在 向扩展发送消息 tab的标识 失败时执行处理函数。
// 第 41 行：type 字段设为 “TRIGGER_EXPLAIN”。
// 第 42 行：text 字段设为 去掉 info的selectionText 两端空白。
// 第 43 行：继续前一行的表达式；本行补充 }).catch(() => {});。
// 第 44 行：结束前面的代码块、资料列表或函数调用。
// 第 45 行：如果 （（info的menuItemId 等于 “deepseek-fullpage”） 且 （tab（存在时）的id 不等于 空值 null）），执行下面这一组步骤。
// 第 46 行：在 向扩展发送消息 tab的标识 失败时执行处理函数。
// 第 47 行：type 字段设为 “TRIGGER_FULLPAGE_TRANSLATE”。
// 第 48 行：继续前一行的表达式；本行补充 }).catch(() => {});。
// 第 49 行：结束前面的代码块、资料列表或函数调用。
// 第 50 行：结束前面的代码块、资料列表或函数调用。
// 第 56 行：登记 chrome的runtime的onMessage 的监听函数，收到通知时执行下面的处理。
// 第 57 行：如果 （消息或提示文字的type 等于 “REFRESH_MODEL_CATALOG”），执行下面这一组步骤。
// 第 58 行：收到公开目录刷新消息时启动刷新。
// 第 59 行：ok 字段设为 是（true）；snapshot 字段沿用同名值。
// 第 60 行：ok 字段设为 否（false）；error 字段设为 错误的message。
// 第 61 行：结束当前函数，并返回 是（true）。
// 第 62 行：结束前面的代码块、资料列表或函数调用。
// 第 63 行：如果 （消息或提示文字的type 等于 “DOWNLOAD”），执行下面这一组步骤。
// 第 64 行：收到下载消息时生成笔记。
// 第 65 行：继续前一行的表达式；本行补充 .then(sendResponse)。
// 第 66 行：ok 字段设为 否（false）；error 字段设为 “下载失败，请重试”。
// 第 67 行：结束当前函数，并返回 是（true）。
// 第 68 行：结束前面的代码块、资料列表或函数调用。
// 第 70 行：收到全文注入消息时向发送页面加载全文脚本。
// 第 71 行：向当前页面注入全文翻译脚本（sender）。
// 第 72 行：结束当前函数，并返回 否（false）。
// 第 73 行：结束前面的代码块、资料列表或函数调用。
// 第 74 行：如果 （消息或提示文字的type 等于 “LIST_MODELS”），执行下面这一组步骤。
// 第 75 行：收到模型列表查询消息时查询指定连接。
// 第 76 行：继续前一行的表达式；本行补充 .then(sendResponse)。
// 第 77 行：ok 字段设为 否（false）；error 字段设为 错误的message。
// 第 78 行：结束当前函数，并返回 是（true）。
// 第 79 行：结束前面的代码块、资料列表或函数调用。
// 第 81 行：如果 （消息或提示文字的type 等于 “VALIDATE_MODEL”），执行下面这一组步骤。
// 第 82 行：收到模型验证消息时检查其是否列在当前接口中。
// 第 83 行：继续前一行的表达式；本行补充 .then(result => sendResponse(result))。
// 第 84 行：ok 字段设为 否（false）；error 字段设为 （错误的message 或 “模型检测失败”）。
// 第 85 行：结束当前函数，并返回 是（true）。
// 第 86 行：结束前面的代码块、资料列表或函数调用。
// 第 87 行：结束前面的代码块、资料列表或函数调用。
// 第 89 行：准备 catalogRefresh：空值 null。
// 第 90 行：定义函数 refreshModelCatalog：合并并发的公开目录刷新任务；接收 无参数。
// 第 91 行：没有在途刷新才启动新任务；并发调用共用这一任务。
// 第 92 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 “catalogSnapshot” 完成。
// 第 94 行：准备 snapshot（保存的快照）：等待 不带用户 Key 刷新公开型号资料（已保存的数据的模型目录快照） 完成。
// 第 95 行：保存新公开目录快照。
// 第 96 行：结束当前函数，并返回 保存的快照。
// 第 97 行：无论刷新结果如何，结束后清除在途任务标记。
// 第 98 行：结束当前函数，并返回 catalogRefresh。
// 第 99 行：结束前面的代码块、资料列表或函数调用。
// 第 105 行：定义注入函数，负责把全文脚本加载到发消息的标签页。
// 第 106 行：准备 tabId：sender的tab（存在时）的id。
// 第 107 行：没有可用标签编号时结束。
// 第 109 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 110 行：等待 向指定浏览器标签页加载脚本 完成。
// 第 111 行：target 字段设为 一组字段（tabId）；tabId 字段沿用同名值。
// 第 112 行：files 字段设为 列表 [“content-fullpage.js”]。
// 第 113 行：结束前面的代码块、资料列表或函数调用。
// 第 114 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 115 行：向开发者工具记录错误。
// 第 116 行：结束前面的代码块、资料列表或函数调用。
// 第 117 行：结束前面的代码块、资料列表或函数调用。
// 第 123 行：登记 chrome的runtime的onConnect 的监听函数，收到通知时执行下面的处理。
// 第 124 行：只处理名字以 stream- 开头的扩展通信连接。
// 第 126 行：为这条连接登记请求消息处理。
// 第 127 行：如果 （收到的消息的type 等于 “STREAM_REQUEST”），执行下面这一组步骤。
// 第 128 行：包装流式请求并管理取消和错误（与后台通信的连接、收到的消息）。
// 第 129 行：结束前面的代码块、资料列表或函数调用。
// 第 131 行：如果 （收到的消息的type 等于 “STREAM_BATCH”），执行下面这一组步骤。
// 第 132 行：包装流式请求并管理取消和错误（与后台通信的连接、一组字段）。
// 第 133 行：promptType 字段设为 （收到的消息的promptType 或 “translate”）。
// 第 134 行：text 字段设为 收到的消息的text。
// 第 135 行：context 字段设为 收到的消息的context。
// 第 136 行：batchId 字段设为 收到的消息的batchId。
// 第 137 行：结束前面的代码块、资料列表或函数调用。
// 第 138 行：结束前面的代码块、资料列表或函数调用。
// 第 139 行：如果 （收到的消息的type 等于 “STREAM_TRANSLATE_BATCH”），执行下面这一组步骤。
// 第 140 行：检查批量请求并复用统一请求路径（与后台通信的连接、收到的消息）。
// 第 141 行：结束前面的代码块、资料列表或函数调用。
// 第 142 行：结束前面的代码块、资料列表或函数调用。
// 第 143 行：结束前面的代码块、资料列表或函数调用。
// 第 149 行：定义异步函数 handleStreamRequest：包装流式请求并管理取消和错误；接收 原始通信连接、request。
// 第 150 行：创建本请求的取消控制器。
// 第 151 行：准备 closed（连接是否已关闭）：否（false）。
// 第 153 行：先监听断开，配置尚未读完时用户关闭也能取消请求。
// 第 154 行：准备 port（与后台通信的连接）：一组字段（postMessage 方法、disconnect 方法）。
// 第 155 行：定义 对象方法 postMessage，内部步骤见后续各行。
// 第 156 行：如果 连接是否已关闭，结束当前函数，并返回 否（false）。
// 第 157 行：尝试把消息发回页面；发送成功返回 true。
// 第 158 行：发送失败则标记关闭，取消网络请求并返回 false。
// 第 159 行：结束前面的代码块、资料列表或函数调用。
// 第 160 行：定义 对象方法 disconnect，内部步骤见后续各行。
// 第 161 行：如果 连接是否已关闭，立即结束当前函数，不继续执行下面步骤。
// 第 162 行：连接是否已关闭 改为 是（true）。
// 第 163 行：取消正在进行的请求。
// 第 164 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 原始通信连接；捕获前面步骤的错误，按下面步骤处理。
// 第 165 行：结束前面的代码块、资料列表或函数调用。
// 第 166 行：结束前面的代码块、资料列表或函数调用。
// 第 167 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 168 行：等待 选择模型和连接，检查配置，发请求，解析流式回答（与后台通信的连接、request、请求取消控制器） 完成。
// 第 169 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 170 行：如果 不满足（请求取消控制器的signal的aborted），通过 与后台通信的连接 发出消息 一组字段。
// 第 171 行：断开 与后台通信的连接。
// 第 172 行：结束前面的代码块、资料列表或函数调用。
// 第 174 行：定义异步函数 performStreamRequest：选择模型和连接，检查配置，发请求，解析流式回答；接收 与后台通信的连接、字段 promptType、text、context、batchId、mode、batchItems、analysis、explicitTask、请求取消控制器。
// 第 175 行：读取当前有效配置。
// 第 176 行：配置读取后再次检查请求是否已取消。
// 第 177 行：如果 （配置的enabled 等于 否（false）），执行下面这一组步骤。
// 第 178 行：扩展停用时向页面报告错误并结束。
// 第 179 行：断开 与后台通信的连接。
// 第 180 行：立即结束当前函数，不继续执行下面步骤。
// 第 181 行：结束前面的代码块、资料列表或函数调用。
// 第 183 行：准备 prompt（本次任务和材料），暂不赋值；准备 systemPrompt（统一回答要求），暂不赋值；准备 model（模型），暂不赋值；准备 thinkingEnabled（是否发送思考强度），暂不赋值；准备 reasoningEffort（思考强度），暂不赋值。
// 第 186 行：网页带有分类模式时，按模式选解释或翻译配置。
// 第 187 行：如果 （处理模式 等于 “B”），执行下面这一组步骤。
// 第 189 行：模式 B 使用翻译标签选择的模型。
// 第 190 行：是否发送思考强度 改为 （配置的translateThinkingEnabled 或 否（false））。
// 第 191 行：思考强度 改为 （配置的translateReasoningEffort 或 “high”）。
// 第 192 行：前一个条件不成立时，进入这个备用分支。
// 第 193 行：模型 改为 配置的explainModel。
// 第 194 行：是否发送思考强度 改为 （配置的explainThinkingEnabled 或 否（false））。
// 第 195 行：思考强度 改为 （配置的explainReasoningEffort 或 “high”）。
// 第 196 行：结束前面的代码块、资料列表或函数调用。
// 第 197 行：统一回答要求 改为 SELECTION_SYSTEM_PROMPT。
// 第 199 行：如果 （选区分析结果 且 不满足（批量文字列表）），执行下面这一组步骤。
// 第 200 行：本次任务和材料 改为 调用共享模块组装划词任务（文字、背景材料、选区分析结果、处理模式、配置、明确指定的任务）。
// 第 201 行：如果 （处理模式 等于 “A”），执行下面这一组步骤。
// 第 202 行：本次任务和材料 改为 组装外语短词翻译加解释任务（文字、背景材料）。
// 第 203 行：如果 （处理模式 等于 “B”），执行下面这一组步骤。
// 第 204 行：本次任务和材料 改为 组装外语句段翻译任务（文字、（配置的targetLanguage 或 “zh”）、背景材料）。
// 第 205 行：如果 （处理模式 等于 “C”），执行下面这一组步骤。
// 第 206 行：本次任务和材料 改为 组装解释任务（文字、配置的判断的语言或解释语言、背景材料）。
// 第 207 行：如果 （处理模式 等于 “D”），执行下面这一组步骤。
// 第 208 行：本次任务和材料 改为 组装语境解读任务（文字、背景材料）。
// 第 209 行：结束前面的代码块、资料列表或函数调用。
// 第 210 行：如果 （promptType 等于 “explain”），执行下面这一组步骤。
// 第 212 行：模型 改为 配置的explainModel。
// 第 213 行：是否发送思考强度 改为 （配置的explainThinkingEnabled 或 否（false））。
// 第 214 行：思考强度 改为 （配置的explainReasoningEffort 或 “high”）。
// 第 215 行：统一回答要求 改为 SELECTION_SYSTEM_PROMPT。
// 第 216 行：旧解释入口也复用新的选区要求。
// 第 217 行：前一个条件不成立时，进入这个备用分支。
// 第 219 行：模型 改为 配置的translateModel。
// 第 220 行：是否发送思考强度 改为 （配置的translateThinkingEnabled 或 否（false））。
// 第 221 行：思考强度 改为 （配置的translateReasoningEffort 或 “high”）。
// 第 222 行：全文翻译使用翻译标签配置，统一要求只输出译文。
// 第 223 行：本次任务和材料 改为 组装全文纯翻译任务（文字、（配置的targetLanguage 或 “zh”）、背景材料）。
// 第 224 行：结束前面的代码块、资料列表或函数调用。
// 第 226 行：如果 批量文字列表，执行下面这一组步骤。
// 第 227 行：有批量文字时改用带编号的批量协议。
// 第 228 行：统一回答要求 改为 “你是一个专业的翻译引擎。只输出规定格式的译文，不要任何解释、说明。”。
// 第 229 行：结束前面的代码块、资料列表或函数调用。
// 第 231 行：如果 不满足（模型），执行下面这一组步骤。
// 第 232 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 233 行：断开 与后台通信的连接。
// 第 234 行：立即结束当前函数，不继续执行下面步骤。
// 第 235 行：结束前面的代码块、资料列表或函数调用。
// 第 236 行：模式 B 或全文任务用翻译连接；其他划词模式用解释连接。
// 第 237 行：准备 baseUrl（整理后的基础地址），暂不赋值。
// 第 238 行：准备 connection（接口连接资料），暂不赋值。
// 第 239 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 240 行：接口连接资料 改为 按解释或翻译用途取得实际连接（配置、当前用途或内容类型）。
// 第 241 行：整理后的基础地址 改为 检查地址并去掉末尾接口路径（接口连接资料的接口基础地址）。
// 第 242 行：结束前面的代码块、资料列表或函数调用。
// 第 243 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 244 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 245 行：断开 与后台通信的连接。
// 第 246 行：立即结束当前函数，不继续执行下面步骤。
// 第 247 行：结束前面的代码块、资料列表或函数调用。
// 第 248 行：准备 apiKey（API Key）：接口连接资料的apiKey。
// 第 249 行：如果 不满足（API Key），执行下面这一组步骤。
// 第 250 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 251 行：断开 与后台通信的连接。
// 第 252 行：立即结束当前函数，不继续执行下面步骤。
// 第 253 行：结束前面的代码块、资料列表或函数调用。
// 第 254 行：接口列表明确检查过但已选型号不在其中时，停止并要求重新选择。
// 第 255 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 256 行：断开 与后台通信的连接。
// 第 257 行：立即结束当前函数，不继续执行下面步骤。
// 第 258 行：结束前面的代码块、资料列表或函数调用。
// 第 261 行：准备 deepSeek（是否为 DeepSeek 官方接口）：只按主机名判断 DeepSeek 官方地址（整理后的基础地址）。
// 第 262 行：官方地址才读取 DeepSeek 专用总思考开关；不凭型号名称套参数。
// 第 263 行：如果 （是否为 DeepSeek 官方接口 且 不满足（DeepSeek 总思考开关）），是否发送思考强度 改为 否（false）。
// 第 266 行：缓存索引包含连接、型号、系统要求、任务材料和思考选项，配置不同不共用旧结果。
// 第 267 行：继续前一行的变量定义；本行补充 deepSeekThinkingEnabled, thinkingEnabled, reasoningEffort]);。
// 第 268 行：定义工具 doneMessage：小函数，接收 output；具体步骤见下面各行。
// 第 269 行：普通回答返回完成消息；批量回答继续解析编号。
// 第 270 行：准备 items（项目列表）：按编号解析批量译文，拒绝缺项和重复项（output、map的结果）。
// 第 271 行：批量编号缺失或重复则报错，让网页回退为逐段翻译。
// 第 272 行：结束当前函数，并返回 一组字段（type: “done”、model、batchId、items）。
// 第 273 行：结束前面的代码块、资料列表或函数调用。
// 第 274 行：定义工具 postChunk：小函数，接收 type、新收到的回答片段；具体步骤见下面各行。
// 第 275 行：如果 批量文字列表，立即结束当前函数，不继续执行下面步骤。
// 第 276 行：开始循环：准备 i（循环序号）：0；继续条件为 （循环序号 小于 新收到的回答片段的length）；每轮后 循环序号 累加或追加 单次消息最多发送的字符数。
// 第 277 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 278 行：结束前面的代码块、资料列表或函数调用。
// 第 279 行：结束前面的代码块、资料列表或函数调用。
// 第 280 行：命中缓存就分片回放，不再请求模型。
// 第 282 行：准备 cached（缓存回答）：从 已完成回答的缓存 读取 本次回答的缓存索引。
// 第 283 行：准备 chunks：若 批量文字列表，用 列表 []；否则用 把文字均分成片段（缓存回答、ceil的结果）。
// 第 284 行：逐项读取 chunks，当前项记作 chunk，执行下面步骤。
// 第 285 行：若请求已被取消，立即抛出中止错误。
// 第 287 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 288 行：如果 不满足（通过 与后台通信的连接 发出消息 一组字段），立即结束当前函数，不继续执行下面步骤。
// 第 289 行：等待 等待指定毫秒数（16） 完成。
// 第 290 行：捕获前面步骤的错误，按下面步骤处理。
// 第 291 行：断开 与后台通信的连接。
// 第 292 行：立即结束当前函数，不继续执行下面步骤。
// 第 293 行：结束前面的代码块、资料列表或函数调用。
// 第 294 行：结束前面的代码块、资料列表或函数调用。
// 第 295 行：通过 与后台通信的连接 发出消息 doneMessage的结果。
// 第 296 行：断开 与后台通信的连接。
// 第 297 行：立即结束当前函数，不继续执行下面步骤。
// 第 298 行：结束前面的代码块、资料列表或函数调用。
// 第 300 行：准备 timedOut（是否已超时）：否（false）。
// 第 301 行：准备 timeout（超时计时器），暂不赋值。
// 第 302 行：定义工具 resetTimeout：小函数，接收 无参数；具体步骤见下面各行。
// 第 303 行：取消计时器 超时计时器。
// 第 304 行：重新开始 60 秒无数据超时；到期标记超时并取消请求。
// 第 305 行：结束前面的代码块、资料列表或函数调用。
// 第 306 行：重新开始无响应超时计时。
// 第 308 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 309 行：准备 body（请求内容或正文元素）：一组字段（model、messages: 列表、stream: 是（true））。
// 第 310 行：model 字段沿用同名值。
// 第 311 行：请求消息分为系统要求和用户材料两部分。
// 第 312 行：role 字段设为 “system”；content 字段设为 统一回答要求。
// 第 313 行：role 字段设为 “user”；content 字段设为 本次任务和材料。
// 第 314 行：结束前面的代码块、资料列表或函数调用。
// 第 315 行：要求接口使用流式返回。
// 第 316 行：结束前面的代码块、资料列表或函数调用。
// 第 318 行：DeepSeek 官方连接明确发送总思考 enabled 或 disabled。
// 第 319 行：只有深度思考开启时才发送 reasoning_effort。
// 第 320 行：由基础地址拼接 /chat/completions 生成接口。
// 第 322 行：准备 res（接口响应）：等待 请求接口，必要时延迟重试，响应取消（endpoint、一组字段） 完成。
// 第 323 行：method 字段设为 “POST”。
// 第 324 行：headers 字段设为 一组字段（Content-Type: “application/json”、Authorization: 拼接文字和变量（API Key））。
// 第 325 行：请求头声明 JSON 格式。
// 第 326 行：使用当前厂家 Key 作为 Bearer 鉴权。
// 第 327 行：结束前面的代码块、资料列表或函数调用。
// 第 328 行：body 字段设为 把 请求内容或正文元素 编码为 JSON 文字。
// 第 329 行：signal 字段设为 请求取消控制器的signal。
// 第 330 行：结束前面的代码块、资料列表或函数调用。
// 第 332 行：如果 不满足（接口响应的ok），执行下面这一组步骤。
// 第 333 行：准备 errMsg：等待 把接口状态码整理成错误提示（接口响应） 完成。
// 第 334 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 335 行：立即结束当前函数，不继续执行下面步骤。
// 第 336 行：结束前面的代码块、资料列表或函数调用。
// 第 338 行：如果 不满足（接口响应的body），报告错误并中断当前正常流程：建立错误信息（“接口没有返回响应流”）。
// 第 339 行：准备 reader（响应流读取器）：取得响应流读取器。
// 第 340 行：准备 decoder（字节转文字工具）：建立字节转文字工具。
// 第 341 行：准备 buffer（暂存的文字）：“”；准备 fullText（拼接后的完整回答）：“”；准备 finished（是否已结束）：否（false）；准备 sawFinish（是否收到完成标记）：否（false）。
// 第 342 行：定义函数 consume：解析一行 SSE 数据并发送正文或思考片段；接收 line。
// 第 343 行：只处理 SSE 中以 data: 开头的行。
// 第 344 行：准备 data（数据）：去掉 截取 line，范围参数为 5 两端空白。
// 第 345 行：如果 不满足（数据），立即结束当前函数，不继续执行下面步骤。
// 第 346 行：收到 [DONE] 时标记流已结束。
// 第 347 行：准备 parsed，暂不赋值。
// 第 348 行：将每行数据解析为 JSON。
// 第 349 行：JSON 格式错误时停止并报错。
// 第 350 行：接口明确返回错误时停止并报错。
// 第 351 行：取第一个候选回答。
// 第 352 行：读取 reasoning_content 思考片段。
// 第 353 行：有实际思考文字时发送 reasoning-token 给页面。
// 第 354 行：读取 content 正文片段。
// 第 355 行：如果 （（新收到的回答片段的数据类型 等于 “string”） 且 新收到的回答片段），执行下面这一组步骤。
// 第 356 行：把正文片段追加到完整回答。
// 第 357 行：同时把新正文片段发送给页面。
// 第 358 行：结束前面的代码块、资料列表或函数调用。
// 第 359 行：达到模型长度上限时报告失败，不把截断内容当完整结果。
// 第 360 行：接口过滤输出时报告失败。
// 第 361 行：记录已收到接口的结束原因。
// 第 362 行：结束前面的代码块、资料列表或函数调用。
// 第 363 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 364 行：持续读取响应流，直到收到结束标记。
// 第 365 行：等待下一段字节，同时取得是否结束的标记。
// 第 366 行：如果 done，跳出当前循环。
// 第 367 行：重新开始无响应超时计时。
// 第 368 行：按流式方式解码字节，保留跨块字符的状态。
// 第 369 行：准备 lines：按 “\n” 分割 暂存的文字。
// 第 370 行：暂存最后一个还没遇到换行的片段，下次继续拼。
// 第 371 行：逐项读取 lines，当前项记作 line，执行下面步骤；解析一行 SSE 数据并发送正文或思考片段（line）；如果 是否已结束，跳出当前循环。
// 第 372 行：结束前面的代码块、资料列表或函数调用。
// 第 373 行：如果 不满足（是否已结束），执行下面这一组步骤。
// 第 374 行：暂存的文字 累加或追加 把 无参数 的字节转换为文字。
// 第 375 行：逐项读取 按 “\n” 分割 暂存的文字，当前项记作 line，执行下面步骤；解析一行 SSE 数据并发送正文或思考片段（line）；如果 是否已结束，跳出当前循环。
// 第 376 行：结束前面的代码块、资料列表或函数调用。
// 第 377 行：最后取消读取器，释放响应流。
// 第 378 行：没有正文时报告接口或型号不兼容。
// 第 379 行：没有结束标记或结束原因时报告意外断流。
// 第 380 行：准备 result（处理结果）：构建完成消息，批量回答须先校验标记（拼接后的完整回答）。
// 第 381 行：如果 （拼接后的完整回答的length 大于 10），执行下面这一组步骤。
// 第 382 行：在 已完成回答的缓存 保存 本次回答的缓存索引 对应的 拼接后的完整回答。
// 第 383 行：缓存超出 100 条时删除最早保留的一条。
// 第 384 行：结束前面的代码块、资料列表或函数调用。
// 第 385 行：通过 与后台通信的连接 发出消息 处理结果。
// 第 386 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 387 行：如果 （是否已超时 或 （错误的name 不等于 “AbortError”）），执行下面这一组步骤。
// 第 388 行：通过 与后台通信的连接 发出消息 一组字段。
// 第 389 行：结束前面的代码块、资料列表或函数调用。
// 第 390 行：进入无论成功或失败都会执行的清理步骤。
// 第 391 行：取消计时器 超时计时器。
// 第 392 行：断开 与后台通信的连接。
// 第 393 行：结束前面的代码块、资料列表或函数调用。
// 第 394 行：结束前面的代码块、资料列表或函数调用。
// 第 400 行：准备 SELECTION_SYSTEM_PROMPT：AISelectionPrompts的SYSTEM。
// 第 402 行：定义函数 buildSelectionPrompt：调用共享模块组装划词任务；接收 文字、背景材料、选区分析结果、处理模式、配置、明确指定的任务。
// 第 403 行：结束当前函数，并返回 组装输出语言、任务要求和 JSON 材料（文字、背景材料、选区分析结果、处理模式、配置、明确指定的任务）。
// 第 404 行：结束前面的代码块、资料列表或函数调用。
// 第 406 行：定义函数 buildExplainPrompt：组装解释任务；接收 文字、判断的语言或解释语言、背景材料。
// 第 407 行：结束当前函数，并返回 调用共享模块组装划词任务（文字、背景材料、analyze的结果、“C”、一组字段）。
// 第 408 行：结束前面的代码块、资料列表或函数调用。
// 第 410 行：定义函数 buildTranslatePrompt：组装全文纯翻译任务；接收 文字、目标语言、背景材料。
// 第 411 行：准备 langNames：一组字段（zh: “中文”、en: “English”、ja: “日本語”、ko: “한국어”、fr: “Français”、de: “Deutsch”、es: “Español”、pt: “Português”、ru: “Русский”、ar: “العربية”）。
// 第 412 行：准备 targetName：（langNames的第 [目标语言] 项 或 目标语言）。
// 第 414 行：准备 contextBlock：“”。
// 第 415 行：如果 （背景材料 且 （背景材料的before 或 背景材料的after）），执行下面这一组步骤。
// 第 416 行：contextBlock 改为 拼接文字和变量（（背景材料的title 或 “未知”）、（背景材料的before 或 “”）、（背景材料的after 或 “”））。
// 第 417 行：结束前面的代码块、资料列表或函数调用。
// 第 419 行：结束当前函数，并返回 拼接文字和变量（targetName、contextBlock、文字）。
// 第 420 行：继续拼接给模型的文字要求：${contextBlock}。
// 第 421 行：继续拼接给模型的文字要求：[待翻译文本]。
// 第 422 行：继续拼接给模型的文字要求："""。
// 第 423 行：继续拼接给模型的文字要求：${text}。
// 第 424 行：继续拼接给模型的文字要求："""。
// 第 426 行：继续拼接给模型的文字要求：规则：。
// 第 427 行：继续拼接给模型的文字要求：- 只输出翻译结果，不要任何解释、说明、开场白。
// 第 428 行：继续拼接给模型的文字要求：- 翻译要准确、自然、符合目标语言习惯。
// 第 429 行：继续拼接给模型的文字要求：- 结合上下文理解多义词和指代，确保翻译准确。
// 第 430 行：继续拼接给模型的文字要求：- 保持原文的语气和风格（正式/非正式、技术/日常）。
// 第 431 行：继续拼接给模型的文字要求：- 如果文本中包含专有名词、数字、代码等，保持原样。
// 第 432 行：继续拼接给模型的文字要求：- 不要使用任何 Markdown 格式。
// 第 433 行：结束前面的代码块、资料列表或函数调用。
// 第 436 行：定义函数 buildTranslateExplainPrompt：组装外语短词翻译加解释任务；接收 文字、背景材料。
// 第 437 行：结束当前函数，并返回 调用共享模块组装划词任务（文字、背景材料、analyze的结果、“A”、一组字段）。
// 第 438 行：结束前面的代码块、资料列表或函数调用。
// 第 441 行：定义函数 buildPureTranslatePrompt：组装外语句段翻译任务；接收 文字、目标语言、背景材料。
// 第 442 行：结束当前函数，并返回 调用共享模块组装划词任务（文字、背景材料、analyze的结果、“B”、一组字段）。
// 第 443 行：结束前面的代码块、资料列表或函数调用。
// 第 446 行：定义函数 buildContextualInterpretPrompt：组装语境解读任务；接收 文字、背景材料。
// 第 447 行：结束当前函数，并返回 调用共享模块组装划词任务（文字、背景材料、analyze的结果、“D”、一组字段、“interpret”）。
// 第 448 行：结束前面的代码块、资料列表或函数调用。
// 第 455 行：准备 configCache（暂存的配置）：空值 null。
// 第 456 行：准备 configLoad（正在读取配置的任务）：空值 null。
// 第 457 行：准备 configRevision（配置版本）：0。
// 第 458 行：准备 GENERATION_FIELDS（会影响生成结果的配置字段）：建立不重复的 Set 集合（列表）。
// 第 459 行：继续前一行的变量定义；本行补充 'language', 'targetLanguage', 'explainModel', 'translateModel',。
// 第 460 行：继续前一行的变量定义；本行补充 'explainManufacturer', 'translateManufacturer', 'explainThinkingEnabled',。
// 第 461 行：继续前一行的变量定义；本行补充 'translateThinkingEnabled', 'explainReasoningEffort', 'translateReasoningEffort',。
// 第 462 行：继续前一行的变量定义；本行补充 'explainDeepSeekThinkingEnabled', 'translateDeepSeekThinkingEnabled',。
// 第 463 行：继续前一行的变量定义；本行补充 'apiBaseUrl', 'apiKey', 'availableModels', 'modelList', 'modelManufacturers',。
// 第 464 行：继续前一行的变量定义；本行补充 'apiConfigVersion', 'providerConfigVersion', 'modelCatalogVersion',。
// 第 465 行：继续前一行的变量定义；本行补充 'qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort']);。
// 第 466 行：定义函数 generationConnections：提取会影响生成的连接信息；接收 待处理的值。
// 第 467 行：结束当前函数，并返回 逐项转换 排序 取得 （待处理的值 或 空资料对象 {}） 的字段名和值配对列表，规则为 调用 localeCompare（所属对象：a），传入 b，转换规则为 下方处理函数。
// 第 468 行：继续前一行的表达式；本行补充 .map(([id, value]) => {。
// 第 469 行：准备 entry（一条资料）：（待处理的值 或 空资料对象 {}）；准备 models：排序 整理模型列表并去重（一条资料的接口开放的型号），规则为 无参数。
// 第 470 行：结束当前函数，并返回 列表 [标识、一条资料的apiBaseUrl、一条资料的apiKey、models、把 （一条资料的modelsCheckedAt 或 models的length） 转成是或否]。
// 第 471 行：结束前面的代码块、资料列表或函数调用。
// 第 472 行：结束前面的代码块、资料列表或函数调用。
// 第 473 行：定义函数 affectsGeneration：判断配置变化是否需要清回答缓存；接收 存储变更记录。
// 第 474 行：结束当前函数，并返回 （（取得 存储变更记录 的字段名列表的length 等于 0） 或 检查 取得 存储变更记录 的字段名和值配对列表 是否至少一项满足 下方处理函数）。
// 第 475 行：如果 （字段名或 Key 等于 “providerConnections”），执行下面这一组步骤。
// 第 476 行：结束当前函数，并返回 （把 generationConnections的结果 编码为 JSON 文字 不等于 把 generationConnections的结果 编码为 JSON 文字）。
// 第 477 行：继续前一行的表达式；本行补充 JSON.stringify(generationConnections(change.newValue));。
// 第 478 行：结束前面的代码块、资料列表或函数调用。
// 第 479 行：结束当前函数，并返回 （检查 会影响生成结果的配置字段 中是否有 字段名或 Key 且 （把 change的oldValue 编码为 JSON 文字 不等于 把 change的newValue 编码为 JSON 文字））。
// 第 480 行：结束前面的代码块、资料列表或函数调用。
// 第 481 行：结束前面的代码块、资料列表或函数调用。
// 第 482 行：登记 chrome的storage的onChanged 的监听函数，收到通知时执行下面的处理。
// 第 483 行：如果 （存储区域 不等于 “local”），立即结束当前函数，不继续执行下面步骤。
// 第 485 行：清空暂存配置和在途读取标记，配置版本加一，防止旧读取结果回填。
// 第 486 行：如果 判断配置变化是否需要清回答缓存（存储变更记录），执行下面这一组步骤；回答缓存版本 加 1；清空 已完成回答的缓存。
// 第 487 行：结束前面的代码块、资料列表或函数调用。
// 第 488 行：定义异步函数 getConfig：读取当前配置，排除过时读取结果；接收 无参数。
// 第 489 行：只要 不满足（暂存的配置），继续执行下面步骤。
// 第 490 行：记住本轮读取版本。
// 第 491 行：如果 不满足（正在读取配置的任务），正在读取配置的任务 改为 读取配置，必要时保存迁移结果（一组字段）。
// 第 492 行：准备 pending（待显示的文字或待完成的任务）：正在读取配置的任务。
// 第 493 行：准备 config（配置），暂不赋值。
// 第 494 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；配置 改为 等待 待显示的文字或待完成的任务 完成。
// 第 495 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 496 行：如果 （更新版本 不等于 配置版本），跳过本轮余下步骤，进入下一轮循环。
// 第 497 行：如果 （正在读取配置的任务 等于 待显示的文字或待完成的任务），正在读取配置的任务 改为 空值 null。
// 第 498 行：报告错误并中断当前正常流程：错误。
// 第 499 行：结束前面的代码块、资料列表或函数调用。
// 第 501 行：读取期间发生新保存就重试，不将旧配置放回缓存。
// 第 502 行：如果 不满足（配置），执行下面这一组步骤；如果 （正在读取配置的任务 等于 待显示的文字或待完成的任务），正在读取配置的任务 改为 空值 null；跳过本轮余下步骤，进入下一轮循环。
// 第 503 行：暂存的配置 改为 配置。
// 第 504 行：如果 （正在读取配置的任务 等于 待显示的文字或待完成的任务），正在读取配置的任务 改为 空值 null。
// 第 505 行：结束前面的代码块、资料列表或函数调用。
// 第 506 行：结束当前函数，并返回 暂存的配置。
// 第 507 行：结束前面的代码块、资料列表或函数调用。
// 第 514 行：定义函数 buildBatchTranslatePrompt：给各文字片段加编号并组装批量要求；接收 项目列表、目标语言、背景材料。
// 第 515 行：准备 langNames：一组字段（zh: “中文”、en: “English”、ja: “日本語”、ko: “한국어”、fr: “Français”、de: “Deutsch”、es: “Español”、pt: “Português”、ru: “Русский”、ar: “العربية”）。
// 第 516 行：准备 blocks（段落与文字节点的对应表）：用 “\n\n” 连接 逐项转换 项目列表，转换规则为 拼接文字和变量（item的id、item的text、item的id） 的各项。
// 第 517 行：结束当前函数，并返回 拼接文字和变量（（langNames的第 [目标语言] 项 或 目标语言）、若 背景材料（存在时）的title，用 拼接文字和变量（背景材料的title）；否则用 “”、段落与文字节点的对应表）。
// 第 518 行：继续拼接给模型的文字要求：${context?.title ? 网页标题：${context.title}\n\n : ''}${blocks}。
// 第 520 行：继续拼接给模型的文字要求：输出要求：。
// 第 521 行：继续拼接给模型的文字要求：- 只输出翻译后的标记块，保持 <<<DS_ITEM_xxx>>> 和 <<<DS_END_xxx>>> 标记原样。
// 第 522 行：继续拼接给模型的文字要求：- 标记中的 xxx 是 id，必须与输入完全一致。
// 第 523 行：继续拼接给模型的文字要求：- 不要合并、遗漏、新增任何标记块。
// 第 524 行：继续拼接给模型的文字要求：- 不要输出解释、说明、Markdown 代码块。
// 第 525 行：继续拼接给模型的文字要求：- 保留原文段落结构和换行。
// 第 526 行：结束前面的代码块、资料列表或函数调用。
// 第 528 行：定义函数 parseBatchTranslation：按编号解析批量译文，拒绝缺项和重复项；接收 原始数据、expectedIds。
// 第 529 行：创建编号到译文的对应表。
// 第 530 行：只识别首尾编号一致的批量标记。
// 第 531 行：逐个读取匹配标记块。
// 第 532 行：编号重复或不在预期列表中，整批解析失败。
// 第 533 行：在 map 保存 match的按 1 取得的项目 对应的 trim的结果。
// 第 534 行：结束前面的代码块、资料列表或函数调用。
// 第 535 行：预期编号缺译文时整批失败。
// 第 536 行：结束当前函数，并返回 逐项转换 expectedIds，转换规则为 一组字段（id、text: get的结果）。
// 第 537 行：结束前面的代码块、资料列表或函数调用。
// 第 539 行：定义异步函数 handleTranslateBatchRequest：检查批量请求并复用统一请求路径；接收 与后台通信的连接、字段 items、context、batchId。
// 第 540 行：批量输入必须非空、最多 8 项，每项编号和文字有效且编号不重复。
// 第 541 行：继续前一行的判断条件；本行补充 items.some(item => !item || typeof item.id !== 'string' || !/^[A-Za-z0-9_]+$/.test(item.id) ||。
// 第 542 行：继续前一行的判断条件；本行补充 typeof item.text !== 'string' || !item.text.trim()) ||。
// 第 543 行：继续前一行的判断条件；本行补充 new Set(items.map(item => item.id)).size !== items.length) {。
// 第 544 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；通过 与后台通信的连接 发出消息 一组字段；捕获前面步骤的错误，按下面步骤处理。
// 第 545 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 与后台通信的连接；捕获前面步骤的错误，按下面步骤处理。
// 第 546 行：立即结束当前函数，不继续执行下面步骤。
// 第 547 行：结束前面的代码块、资料列表或函数调用。
// 第 548 行：等待 包装流式请求并管理取消和错误（与后台通信的连接、一组字段） 完成。
// 第 549 行：结束前面的代码块、资料列表或函数调用。
// 第 552 行：定义异步函数 fetchWithRetry：请求接口，必要时延迟重试，响应取消；接收 url、options、maxRetries，未传入时用 3。
// 第 553 行：重试循环：首次请求失败后最多再重试 3 次。
// 第 554 行：每次发请求前检查取消信号。
// 第 555 行：准备 response（响应），暂不赋值。
// 第 556 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 557 行：响应 改为 等待 向 url 发出网络请求 完成。
// 第 558 行：非限流且非服务器错误时直接交回响应；重试次数达到上限也交回。
// 第 559 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 560 行：被取消、AbortError 或次数已用完时停止重试。
// 第 561 行：结束前面的代码块、资料列表或函数调用。
// 第 562 行：准备 retryAfter：把 （从 响应（存在时）的headers 读取 “Retry-After” 或 0） 转成数值。
// 第 563 行：重试前取消旧响应流，释放资源。
// 第 564 行：优先遵守 Retry-After，否则指数延迟；等待最多 8 秒。
// 第 565 行：等待 建立稍后完成或失败的 Promise 任务 完成。
// 第 566 行：准备 signal：options的signal。
// 第 567 行：定义工具 finish：小函数，接收 无参数；具体步骤见下面各行；调用 removeEventListener（所属对象：signal），传入 “abort”、abort；建立已完成任务或完成当前任务，结果为 无参数。
// 第 568 行：准备 timer（延迟计时器）：延迟 delay 毫秒后执行函数。
// 第 569 行：定义工具 abort：小函数，接收 无参数；具体步骤见下面各行；取消计时器 延迟计时器；调用 removeEventListener（所属对象：signal），传入 “abort”、abort；让当前任务以 signal的分类依据 失败。
// 第 570 行：监听 signal 的 “abort” 事件，发生后执行处理函数。
// 第 571 行：如果 signal（存在时）的aborted，取消等待并报告中止。
// 第 572 行：结束前面的代码块、资料列表或函数调用。
// 第 573 行：结束前面的代码块、资料列表或函数调用。
// 第 574 行：结束前面的代码块、资料列表或函数调用。
// 第 576 行：定义异步函数 parseApiError：把接口状态码整理成错误提示；接收 接口响应。
// 第 577 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 578 行：准备 body（请求内容或正文元素）：等待 读取响应正文的文字 完成。
// 第 579 行：如果 （接口响应的status 等于 401），结束当前函数，并返回 “API Key 无效，请检查设置”。
// 第 580 行：如果 （接口响应的status 等于 402），结束当前函数，并返回 “账户余额不足，请充值”。
// 第 581 行：如果 （接口响应的status 等于 403），结束当前函数，并返回 “API Key 无权访问，请检查”。
// 第 582 行：如果 （接口响应的status 等于 429），结束当前函数，并返回 “请求过于频繁，请稍后再试”。
// 第 583 行：如果 （接口响应的status 等于 400），结束当前函数，并返回 “请求参数或模型不受支持，请检查模型名；若开启思考，请尝试关闭”。
// 第 584 行：如果 （接口响应的status 等于 404），结束当前函数，并返回 “接口路径或模型不存在，请检查 Base URL 和模型名”。
// 第 585 行：结束当前函数，并返回 拼接文字和变量（接口响应的status、截取 请求内容或正文元素，范围参数为 0、100）。
// 第 586 行：捕获前面步骤的错误，按下面步骤处理。
// 第 587 行：结束当前函数，并返回 拼接文字和变量（接口响应的status）。
// 第 588 行：结束前面的代码块、资料列表或函数调用。
// 第 589 行：结束前面的代码块、资料列表或函数调用。
// 第 595 行：定义异步函数 listModels：查询当前接口的模型列表；接收 接口连接资料。
// 第 596 行：准备 config（配置）：（接口连接资料 或 按解释或翻译用途取得实际连接（await getConfig() 的计算结果））。
// 第 597 行：结束当前函数，并返回 带当前 Key 查询模型列表并分类错误（配置）。
// 第 598 行：结束前面的代码块、资料列表或函数调用。
// 第 600 行：定义型号验证函数；列表检测成功不等于实际生成已验证。
// 第 601 行：准备 model（模型）：整理模型名，去掉两端空白（inputModel）。
// 第 602 行：如果 （不满足（模型） 或 检查 模型 是否符合 字符匹配规则 /\s/），结束当前函数，并返回 一组字段（ok: 否（false）、error: “请输入不含空格的模型调用名”）。
// 第 603 行：准备 result（处理结果）：等待 查询当前接口的模型列表（接口连接资料） 完成。
// 第 604 行：如果 不满足（处理结果的ok），结束当前函数，并返回 处理结果。
// 第 605 行：如果 不满足（检查 处理结果的models 是否包含 模型），结束当前函数，并返回 一组字段（ok: 否（false）、error: 拼接文字和变量（模型））。
// 第 606 行：结束当前函数，并返回 一组字段（ok: 是（true）、model: 一组字段）。
// 第 607 行：结束前面的代码块、资料列表或函数调用。
// 第 613 行：定义函数 splitIntoChunks：把文字均分成片段；接收 文字、count。
// 第 614 行：如果 （不满足（文字） 或 （count 小于等于 1）），结束当前函数，并返回 列表 [（文字 或 “”）]。
// 第 615 行：准备 len：文字的length。
// 第 616 行：准备 size：把 （len 除以 count） 向上取整。
// 第 617 行：准备 chunks：列表 []。
// 第 618 行：开始循环：准备 i（循环序号）：0；继续条件为 （循环序号 小于 len）；每轮后 循环序号 累加或追加 size。
// 第 619 行：把 截取 文字，范围参数为 循环序号、（循环序号 加上或拼接 size） 加到 chunks 末尾。
// 第 620 行：结束前面的代码块、资料列表或函数调用。
// 第 621 行：结束当前函数，并返回 若 chunks的length，用 chunks；否则用 列表 [“”]。
// 第 622 行：结束前面的代码块、资料列表或函数调用。
// 第 624 行：定义函数 sleep：等待指定毫秒数；接收 ms。
// 第 625 行：结束当前函数，并返回 建立稍后完成或失败的 Promise 任务。
// 第 626 行：结束前面的代码块、资料列表或函数调用。
// 第 632 行：定义异步函数 handleDownload：处理笔记下载；接收 selectedText、explanation。
// 第 633 行：如果 （（（selectedText的数据类型 不等于 “string”） 或 （explanation的数据类型 不等于 “string”）） 或 不满足（去掉 explanation 两端空白）），执行下面这一组步骤。
// 第 634 行：结束当前函数，并返回 一组字段（ok: 否（false）、error: “没有可下载的内容”）。
// 第 635 行：结束前面的代码块、资料列表或函数调用。
// 第 636 行：准备 now：取得日期时间。
// 第 637 行：定义工具 pad：小函数，接收 n；返回 在 把 n 转成文字 前补字符，使其达到指定长度。
// 第 638 行：准备 timestamp：拼接文字和变量（调用 getFullYear（所属对象：now）、把日期数字补足两位（（调用 getMonth（所属对象：now） 加上或拼接 1））、把日期数字补足两位（getDate的结果）、把日期数字补足两位（getHours的结果）、把日期数字补足两位（getMinutes的结果）、把日期数字补足两位（getSeconds的结果））。
// 第 639 行：准备 filename：拼接文字和变量（timestamp）。
// 第 641 行：准备 content：用 “\n” 连接 含 9 项的列表 的各项。
// 第 642 行：继续前一行的变量定义；本行补充 `说文 · LingoClarify`,。
// 第 643 行：继续前一行的变量定义；本行补充 `生成时间: ${now.toLocaleString('zh-CN')}`,。
// 第 644 行：继续前一行的变量定义；本行补充 ``,。
// 第 645 行：继续前一行的变量定义；本行补充 `── 选中原文 ──`,。
// 第 646 行：继续前一行的变量定义；本行补充 selectedText,。
// 第 647 行：继续前一行的变量定义；本行补充 ``,。
// 第 648 行：继续前一行的变量定义；本行补充 `── 解释内容 ──`,。
// 第 649 行：继续前一行的变量定义；本行补充 explanation,。
// 第 650 行：继续前一行的变量定义；本行补充 ``,。
// 第 651 行：继续前一行的变量定义；本行补充 ].join('\n');。
// 第 653 行：创建 UTF-8 编码工具。
// 第 654 行：把笔记文字编码为字节。
// 第 655 行：准备 binary：“”。
// 第 656 行：开始循环：准备 i（循环序号）：0；继续条件为 （循环序号 小于 bytes的length）；每轮后 循环序号 加 1。
// 第 657 行：binary 累加或追加 调用 fromCharCode（所属对象：String），传入 bytes的第 [循环序号] 项。
// 第 658 行：结束前面的代码块、资料列表或函数调用。
// 第 659 行：把字节编码为 Base64 下载地址。
// 第 661 行：请求浏览器下载笔记。
// 第 662 行：url 字段设为 dataUrl。
// 第 663 行：filename 字段设为 filename。
// 第 664 行：saveAs 字段设为 否（false）。
// 第 665 行：结束前面的代码块、资料列表或函数调用。
// 第 666 行：下载任务编号有效表示已启动；最终是否保存成功仍看浏览器下载管理器。
// 第 667 行：结束前面的代码块、资料列表或函数调用。
