// ========== AI 智能解释 & 翻译 — Service Worker ==========
// 职责：配置管理、流式 API 代理、动态右键菜单、缓存、下载

const CACHE = new Map();
const CACHE_MAX = 100;
const MAX_STREAM_CHARS = 2048;
let cacheRevision = 0;

importScripts('model-catalog.js');
importScripts('config.js');

// ═══════════════════════════════════════════
// 右键菜单：安装/更新时创建（精简为两项）
// ═══════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  // 先清除旧菜单再重建，避免扩展更新/浏览器升级时重复 create 同 id 报错
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'deepseek-explain',
      title: '📖 智能解释',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'deepseek-fullpage',
      title: '🌐 全文翻译',
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
    handleDownload(message.text, message.explanation);
    return false;
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

async function handleStreamRequest(port, { promptType, text, context, batchId, mode, batchItems }) {
  const config = await getConfig();
  if (config.enabled === false) {
    port.postMessage({ type: 'error', error: '扩展已禁用', batchId });
    port.disconnect();
    return;
  }

  let prompt, systemPrompt, model, thinkingEnabled, reasoningEffort;

  // 🆕 四分类模式（来自智能解释的本地分类）
  if (mode) {
    if (mode === 'B') {
      // 纯翻译 → 使用翻译标签的模型
      model = config.translateModel;
      thinkingEnabled = config.translateThinkingEnabled || false;
      reasoningEffort = config.translateReasoningEffort || 'high';
    } else {
      model = config.explainModel;
      thinkingEnabled = config.explainThinkingEnabled || false;
      reasoningEffort = config.explainReasoningEffort || 'high';
    }
    systemPrompt = '你是一个知识渊博的助手。请严格按照指令输出。';

    if (mode === 'A') {
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
    systemPrompt = '你是一个知识渊博、擅于解释的助手。给出简洁清晰的解释，不要重复开场白，直接解释。';
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
  let baseUrl;
  let connection;
  try {
    const kind = mode ? (mode === 'B' ? 'translate' : 'explain') : (promptType === 'explain' ? 'explain' : 'translate');
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

  // 缓存检查（键包含思考开关，避免开关切换后命中旧缓存）
  const cacheKey = JSON.stringify([cacheRevision, baseUrl, model, systemPrompt, prompt,
    thinkingEnabled, reasoningEffort]);
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
      // 端口可能已被页面断开（用户关闭弹窗），发送失败即中止
      try {
        port.postMessage({ type: 'token', token: chunk, batchId });
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

  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
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

function buildExplainPrompt(text, language, context) {
  const langHint = language === 'auto'
    ? '请自动检测文本语言：如果是英文，用英文解释；如果是中文，用中文解释；其他语言用中文解释。'
    : language === 'en'
      ? '请用英文解释以下内容。'
      : '请用中文解释以下内容。';

  let contextBlock = '';
  if (context && (context.before || context.after)) {
    contextBlock = `\n[网页标题]\n${context.title || '未知'}\n\n[选中文本的上下文]\n...${context.before || ''}[选中文本]${context.after || ''}...\n`;
  }

  return `你是一个知识渊博、擅于解释的助手。用户选中了一段文本，请结合上下文给出简洁清晰的分点解释。
${contextBlock}
[需要解释的文本]
"""
${text}
"""

规则：
- ${langHint}
- 用编号列表（1. 2. 3.）分点解释，每点一行
- 结合上文和下文的语境来理解选中文本的具体含义
- 如果选中文本在上下文中是专业术语或特定领域的用法，请给出该领域内的解释
- 不要使用任何 Markdown 格式：不要用 ** 加粗、不要用 * 斜体、不要用反引号、不要用标题符号
- 如果文本是单词或短语：分点给出释义、词性、用法、例句
- 如果文本是句子或段落：分点解释含义、背景、关键信息
- 如果是专业术语：分点给出定义、背景、相关知识
- 整体控制在 3~5 个要点，每个要点一句话，简洁有力
- 不要写"这段文字说的是"之类的开场白，直接分点解释`;
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
  let contextBlock = '';
  if (context && (context.before || context.after)) {
    contextBlock = `\n[上下文]\n标题：${context.title || '未知'}\n上文：${context.before || ''}\n下文：${context.after || ''}\n`;
  }
  return `请先翻译以下文本为中文，然后对翻译结果给出简洁解释（释义、词性、用法、例句）。

${contextBlock}
[待处理文本]
"""
${text}
"""

输出格式：
【译文】
（翻译结果）
【解释】
1. 释义：...
2. 用法：...
3. 例句：...

规则：
- 不要使用 Markdown 格式
- 解释控制在 2~4 个要点
- 不要写开场白`;
}

// 🆕 模式 B：外语长段 → 纯翻译
function buildPureTranslatePrompt(text, targetLanguage, context) {
  const langNames = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', ar: 'العربية' };
  const targetName = langNames[targetLanguage] || targetLanguage;
  let contextBlock = '';
  if (context && (context.before || context.after)) {
    contextBlock = `\n[上下文]\n${context.before || ''}\n${context.after || ''}\n`;
  }
  return `将以下文本翻译为${targetName}。只输出译文，不要解释。
${contextBlock}
"""
${text}
"""`;
}

// 🆕 模式 D：中文长段 → 语境解读
function buildContextualInterpretPrompt(text, context) {
  let contextBlock = '';
  if (context && (context.before || context.after)) {
    contextBlock = `\n[上文]\n${context.before || ''}\n\n[下文]\n${context.after || ''}\n`;
  }
  return `请结合上下文解读这段话的核心含义和深层意图。

${contextBlock}
[待解读文本]
"""
${text}
"""

规则：
- 用编号列表（1. 2. 3.）输出
- 每点一行：先概括核心意思，再点出背景/意图/隐含信息
- 控制在 3~5 点
- 直接输出，不要开场白"这段话说的是…"
- 不要使用 Markdown 格式`;
}

// ═══════════════════════════════════════════
// 配置读取
// ═══════════════════════════════════════════

// 会话级配置缓存：避免全文翻译高并发时每个请求都读 storage
let configCache = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') { configCache = null; cacheRevision++; CACHE.clear(); }
});
async function getConfig() {
  if (!configCache) configCache = await AIConfig.load();
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
    port.postMessage({ type: 'error', error: '批量翻译内容或标记无效', batchId });
    port.disconnect();
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

function handleDownload(selectedText, explanation) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `笔记/AI解释_${timestamp}.txt`;

  const content = [
    `AI 智能解释`,
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

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  }).catch(() => {});
}
