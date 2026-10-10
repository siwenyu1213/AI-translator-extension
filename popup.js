// ========== AI 智能解释 & 翻译 — Popup ==========
// 双标签布局：解释 / 翻译各自独立模型配置 + 通用设置
// 模型列表：预设和自定义均可修改、保存、删除；可选查询接口模型列表。

// ── DOM 引用 ──
// 标签
const $tabBtns = document.querySelectorAll('.tab-btn');
const $tabPanels = document.querySelectorAll('.tab-panel');

// 解释标签
const $explainModel = document.getElementById('explain-model');
const $explainCustomInput = document.getElementById('explain-custom-model');
const $explainCustomNew = document.getElementById('explain-custom-new');
const $explainCustomAdd = document.getElementById('explain-custom-add');
const $explainCustomDelete = document.getElementById('explain-custom-delete');
const $explainModelMsg = document.getElementById('explain-model-msg');
const $explainThinking = document.getElementById('explain-thinking');
const $explainEffort = document.getElementById('explain-effort');
const $explainEffortSection = document.getElementById('explain-effort-section');
const $explainLanguage = document.getElementById('explain-language');

// 翻译标签
const $translateModel = document.getElementById('translate-model');
const $translateCustomInput = document.getElementById('translate-custom-model');
const $translateCustomNew = document.getElementById('translate-custom-new');
const $translateCustomAdd = document.getElementById('translate-custom-add');
const $translateCustomDelete = document.getElementById('translate-custom-delete');
const $translateModelMsg = document.getElementById('translate-model-msg');
const $translateThinking = document.getElementById('translate-thinking');
const $translateEffort = document.getElementById('translate-effort');
const $translateEffortSection = document.getElementById('translate-effort-section');
const $targetLanguage = document.getElementById('target-language');

// 通用
const $apiKey = document.getElementById('api-key');
const $apiBaseUrl = document.getElementById('api-base-url');
const $fetchModels = document.getElementById('fetch-models');
const $catalogStatus = document.getElementById('catalog-status');
const $verifyModel = document.getElementById('verify-model');
const $connectionMsg = document.getElementById('connection-msg');
const $enabled = document.getElementById('enabled');
const $useContext = document.getElementById('use-context');
const $triggerMode = document.getElementById('trigger-mode');
const $saveBtn = document.getElementById('save-btn');
const $status = document.getElementById('status');

// 两个标签共享同一份模型列表
let modelList = [];
let availableModels = [];
let modelManufacturers = {};
let hiddenCatalogModels = [];
let catalogSnapshot = AIModelCatalog.BUILTIN;
let catalogRefreshing = false;
const metadata = new Map();

const tabs = [
  {
    key: 'explainModel',
    manufacturer: document.getElementById('explain-manufacturer'),
    detail: document.getElementById('explain-model-detail'),
    select: $explainModel,
    input: $explainCustomInput,
    newBtn: $explainCustomNew,
    addBtn: $explainCustomAdd,
    deleteBtn: $explainCustomDelete,
    msg: $explainModelMsg,
    thinking: $explainThinking,
    effortSection: $explainEffortSection
  },
  {
    key: 'translateModel',
    manufacturer: document.getElementById('translate-manufacturer'),
    detail: document.getElementById('translate-model-detail'),
    select: $translateModel,
    input: $translateCustomInput,
    newBtn: $translateCustomNew,
    addBtn: $translateCustomAdd,
    deleteBtn: $translateCustomDelete,
    msg: $translateModelMsg,
    thinking: $translateThinking,
    effortSection: $translateEffortSection
  }
];

// ═══════════════════════════════════════════
// 模型名称工具
// ═══════════════════════════════════════════

function normalizeModelName(model) {
  const name = String(model || '').trim();
  return name;
}

function normalizeModelList(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(item => {
    const name = normalizeModelName(item);
    if (!name || out.includes(name)) return;
    out.push(name);
  });
  return out;
}

function modelDisplayName(model) { return metadata.get(model)?.name || model; }
function manufacturerFor(model) {
  return modelManufacturers[model] || metadata.get(model)?.provider || AIModelCatalog.providerFor(model);
}
function refreshMetadata() {
  metadata.clear();
  AIModelCatalog.allModels(catalogSnapshot).forEach(model => {
    const id = AIModelCatalog.resolveId(model, $apiBaseUrl.value, availableModels);
    if (!metadata.has(id) || model.note) metadata.set(id, model);
    if (!hiddenCatalogModels.includes(id) && !modelList.includes(id)) modelList.push(id);
  });
}
function renderManufacturers() {
  tabs.forEach(tab => {
    const current = tab.manufacturer.value || 'openai';
    tab.manufacturer.replaceChildren();
    [...catalogSnapshot.providers, {id:'custom', name:'其他厂家 / 自定义'}].forEach(provider => {
      const option = document.createElement('option'); option.value = provider.id; option.textContent = provider.name;
      tab.manufacturer.appendChild(option);
    });
    tab.manufacturer.value = current;
  });
}
function updateModelDetail(tab) {
  const id = tab.select.value;
  const model = metadata.get(id);
  tab.detail.textContent = model?.note || (id.includes('deepseek-v4-flash')
    ? 'V4 Flash / Vision Exp 为历史型号，DeepSeek 官方已将其调用转到 V4.1 Flash。'
    : id ? `调用名：${id}${availableModels.includes(id) ? ' · 当前接口列表已列出' : ' · 请确认当前接口支持'}` : '该厂家暂无选定模型，可手动新增调用名。');
}
function catalogState(text = '') {
  $catalogStatus.textContent = text;
  $catalogStatus.hidden = !text;
}

function clearModelMessage($msg) {
  clearTimeout($msg._hideTimer);
  $msg.textContent = '';
  $msg.className = 'model-msg';
}

function showModelMessage($msg, text, type = 'error', autoHide = 5000) {
  clearTimeout($msg._hideTimer);
  $msg.textContent = text;
  $msg.className = 'model-msg ' + type;
  if (autoHide > 0) {
    $msg._hideTimer = setTimeout(() => {
      $msg.textContent = '';
      $msg.className = 'model-msg';
    }, autoHide);
  }
}

function syncThinkingForTab(tab) {
  tab.effortSection.style.display = tab.thinking.checked ? '' : 'none';
}

// ═══════════════════════════════════════════
// 模型列表渲染 / 同步
// ═══════════════════════════════════════════

function renderModelOptions(tab) {
  const current = tab.select.value, providerId = tab.manufacturer.value;
  tab.select.replaceChildren();
  const displayed = new Set();
  function group(label, entries) {
    const optgroup = document.createElement('optgroup'); optgroup.label = label;
    entries.forEach(({id, name}) => {
      if (displayed.has(id) || hiddenCatalogModels.includes(id)) return;
      displayed.add(id);
      const option = document.createElement('option'); option.value = id; option.textContent = name;
      optgroup.appendChild(option);
    });
    if (optgroup.children.length) tab.select.appendChild(optgroup);
  }
  const provider = catalogSnapshot.providers.find(p => p.id === providerId);
  if (provider) group(provider.stale ? '该厂家模型 · 已有列表' : '该厂家模型 · 公开目录', provider.models.map(model => ({
    id: AIModelCatalog.resolveId(model, $apiBaseUrl.value, availableModels), name: model.name
  })));
  group('常用 / 历史兼容型号', AIModelCatalog.COMPATIBILITY.filter(m => m.provider === providerId)
    .map(model => ({ id: AIModelCatalog.resolveId(model, $apiBaseUrl.value, availableModels), name: model.name })));
  group('当前接口 / 已保存的模型', modelList.filter(id => manufacturerFor(id) === providerId)
    .map(id => ({id, name:modelDisplayName(id)})));
  if (displayed.has(current)) tab.select.value = current;
  else tab.select.selectedIndex = -1;
}
function renderAllModelOptions() {
  refreshMetadata();
  tabs.forEach(renderModelOptions);
}

function setTabSelection(tab, modelId) {
  if (modelId && modelList.includes(modelId)) {
    tab.manufacturer.value = manufacturerFor(modelId);
    renderModelOptions(tab);
    tab.select.value = modelId;
    tab.input.value = modelId;
    tab.deleteBtn.disabled = false;
  } else {
    tab.select.selectedIndex = -1;
    tab.input.value = modelId || '';
    tab.deleteBtn.disabled = true;
  }
  syncThinkingForTab(tab);
  updateModelDetail(tab);
}

function syncInputFromSelect(tab) {
  const model = tab.select.value || '';
  tab.input.value = model;
  tab.deleteBtn.disabled = !model;
  clearModelMessage(tab.msg);
  syncThinkingForTab(tab);
  updateModelDetail(tab);
}

function startNewModel(tab) {
  tab.select.selectedIndex = -1;
  tab.input.value = '';
  tab.deleteBtn.disabled = true;
  clearModelMessage(tab.msg);
  tab.input.focus();
}

// ═══════════════════════════════════════════
// 标签切换
// ═══════════════════════════════════════════

$tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $tabPanels.forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tab}`);
    });
  });
});

// ═══════════════════════════════════════════
// 深度思考开关 → 联动强度选择显隐
// ═══════════════════════════════════════════

$explainThinking.addEventListener('change', () => {
  syncThinkingForTab(tabs[0]);
});
$translateThinking.addEventListener('change', () => {
  syncThinkingForTab(tabs[1]);
});

// ═══════════════════════════════════════════
// 自定义 / 列表模型：保存、修改、删除、新增
// ═══════════════════════════════════════════

async function saveCurrentModel(tab) {
  const raw = tab.input.value.trim();
  if (!raw) {
    showModelMessage(tab.msg, '请输入模型调用名', 'error');
    return;
  }
  if (/\s/.test(raw)) {
    showModelMessage(tab.msg, '模型调用名不能包含空格', 'error');
    return;
  }

  const requested = normalizeModelName(raw);
  const current = tab.select.value || '';

  // 按用户要求：保存前先调用后台 API 测试模型是否存在/可调用
  tab.addBtn.disabled = true;
  tab.newBtn.disabled = true;
  showModelMessage(tab.msg, '正在保存模型…', 'info', 0);

  let result;
  try {
    const connection = getConnection();
    result = $verifyModel.checked
      ? await chrome.runtime.sendMessage({ type: 'VALIDATE_MODEL', model: requested, connection })
      : { ok: true, model: { id: requested } };
    if (result?.ok) await saveConnection(connection);
  } catch (err) {
    result = { ok: false, error: err.message || '模型检测失败' };
  } finally {
    tab.addBtn.disabled = false;
    tab.newBtn.disabled = false;
  }

  if (!result || !result.ok) {
    showModelMessage(tab.msg, result?.error || '模型不可用，请检查调用名或 API Key', 'error', 8000);
    return;
  }

  const targetId = normalizeModelName(result.model?.id || requested);
  const targetInList = modelList.includes(targetId);
  const currentInList = current && modelList.includes(current);

  // 新增时如果输入的是列表已有模型，直接选择，不重复添加
  if (targetInList && targetId !== current) {
    if (!current) {
      renderAllModelOptions();
      setTabSelection(tab, targetId);
      await chrome.storage.local.set({ modelList: modelList.slice(), [tab.key]: targetId });
      showModelMessage(tab.msg, `✅ 已选择：${targetId}`, 'success', 3000);
      return;
    }
    showModelMessage(tab.msg, `模型列表中已存在：${targetId}，请直接从列表选择`, 'error', 8000);
    return;
  }

  modelManufacturers[targetId] = tab.manufacturer.value || manufacturerFor(targetId);
  hiddenCatalogModels = hiddenCatalogModels.filter(id => id !== targetId);
  if (current && current !== targetId) hiddenCatalogModels.push(current);

  // 修改当前选中模型，或新增模型
  if (currentInList) {
    const index = modelList.indexOf(current);
    modelList[index] = targetId;
  } else if (!targetInList) {
    modelList.push(targetId);
  }

  const updates = { modelList: modelList.slice(), modelManufacturers: { ...modelManufacturers }, hiddenCatalogModels: hiddenCatalogModels.slice() };
  const desiredSelections = new Map();

  tabs.forEach(item => {
    let desired = item.select.value || '';
    if (desired && desired === current) {
      // 同一个模型在另一个标签里也被使用时，同步改成修改后的名字
      desired = targetId;
    } else if (!desired && item === tab) {
      // 新增模式下保存，当前标签自动选中新模型
      desired = targetId;
    }
    desiredSelections.set(item, desired);
    updates[item.key] = desired || '';
  });

  renderAllModelOptions();
  tabs.forEach(item => setTabSelection(item, desiredSelections.get(item) || ''));
  await chrome.storage.local.set(updates);

  const action = currentInList ? '修改' : '新增';
  showModelMessage(tab.msg, `✅ 已保存${action}：${targetId}`, 'success', 3000);
}

async function deleteCurrentModel(tab) {
  const model = tab.select.value;
  if (!model || !modelList.includes(model)) {
    showModelMessage(tab.msg, '当前没有可删除的列表模型', 'error');
    return;
  }

  const index = modelList.indexOf(model);
  hiddenCatalogModels.push(model);
  modelList = modelList.filter(item => item !== model);
  const fallback = modelList[Math.min(index, modelList.length - 1)] || '';

  const updates = { modelList: modelList.slice(), modelManufacturers: { ...modelManufacturers }, hiddenCatalogModels: hiddenCatalogModels.slice() };
  const desiredSelections = new Map();

  tabs.forEach(item => {
    let desired = item.select.value || '';
    if (desired === model || (desired && !modelList.includes(desired))) {
      desired = fallback;
    }
    desiredSelections.set(item, desired);
    updates[item.key] = desired || '';
  });

  renderAllModelOptions();
  tabs.forEach(item => setTabSelection(item, desiredSelections.get(item) || ''));
  await chrome.storage.local.set(updates);

  showModelMessage(tab.msg, `✅ 已删除模型：${model}`, 'success', 3000);
}

tabs.forEach(tab => {
  tab.manufacturer.addEventListener('change', () => {
    renderModelOptions(tab);
    tab.select.selectedIndex = tab.select.options.length ? 0 : -1;
    syncInputFromSelect(tab);
  });
  tab.select.addEventListener('change', () => syncInputFromSelect(tab));

  tab.newBtn.addEventListener('click', () => startNewModel(tab));
  tab.addBtn.addEventListener('click', () => saveCurrentModel(tab));
  tab.deleteBtn.addEventListener('click', () => deleteCurrentModel(tab));

  tab.input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCurrentModel(tab);
    }
  });
});

// ═══════════════════════════════════════════
// 加载配置
// ═══════════════════════════════════════════

(async () => {
  const config = await AIConfig.load();
  modelList = config.modelList.slice();
  availableModels = config.availableModels || [];
  modelManufacturers = config.modelManufacturers || {};
  hiddenCatalogModels = config.hiddenCatalogModels || [];
  catalogSnapshot = AIModelCatalog.normalizeSnapshot(config.catalogSnapshot);
  $apiBaseUrl.value = config.apiBaseUrl;
  $verifyModel.checked = config.verifyModel !== false;
  if (config.requiresApiSetup) showModelMessage($connectionMsg,
    '已升级为通用接口。旧供应商 Key 和预设已移除，请填写新的接口地址和 API Key。', 'info', 0);

  // ── 填充 UI ──
  $explainThinking.checked = config.explainThinkingEnabled === true;
  $explainEffort.value = config.explainReasoningEffort || 'high';
  $explainLanguage.value = config.language || 'auto';

  $translateThinking.checked = config.translateThinkingEnabled === true;
  $translateEffort.value = config.translateReasoningEffort || 'high';
  $targetLanguage.value = config.targetLanguage || 'zh';

  renderManufacturers();
  renderAllModelOptions();
  catalogState();
  setTabSelection(tabs[0], config.explainModel);
  setTabSelection(tabs[1], config.translateModel);

  $apiKey.value = config.apiKey || '';

  $enabled.checked = config.enabled !== false;
  $useContext.checked = config.usePageContext !== false;
  $triggerMode.value = config.triggerMode || 'auto';
  refreshCatalog();
})().catch(err => showStatus('读取设置失败：' + err.message, 'error'));

// ═══════════════════════════════════════════
// 保存配置
// ═══════════════════════════════════════════

$saveBtn.addEventListener('click', async () => {
  const apiKey = $apiKey.value.trim();
  let connection;
  try { connection = getConnection(); }
  catch (err) { showStatus(err.message, 'error'); return; }

  const config = {
    apiKey: apiKey,
    ...connection,
    verifyModel: $verifyModel.checked,
    requiresApiSetup: false,
    // 解释标签
    explainModel: normalizeModelName($explainModel.value) || '',
    explainThinkingEnabled: $explainThinking.checked,
    explainReasoningEffort: $explainEffort.value,
    language: $explainLanguage.value,
    // 翻译标签
    translateModel: normalizeModelName($translateModel.value) || '',
    translateThinkingEnabled: $translateThinking.checked,
    translateReasoningEffort: $translateEffort.value,
    targetLanguage: $targetLanguage.value,
    // 通用
    enabled: $enabled.checked,
    usePageContext: $useContext.checked,
    triggerMode: $triggerMode.value,
    // 模型列表
    modelList: modelList.slice(),
    availableModels: availableModels.slice(),
    modelManufacturers: { ...modelManufacturers },
    hiddenCatalogModels: hiddenCatalogModels.slice(),
    explainManufacturer: tabs[0].manufacturer.value,
    translateManufacturer: tabs[1].manufacturer.value
  };

  try {
    await chrome.storage.local.set(config);
    if (!apiKey) {
      showStatus('⚠️ 已保存，但未设置任何 API Key，扩展将无法使用', 'error');
    } else {
      showStatus('✅ 设置已保存！现在去任意页面试试吧', 'success');
    }
  } catch (err) {
    showStatus('保存失败: ' + err.message, 'error');
  }
});

// ═══════════════════════════════════════════
// 实时保存（通用开关）
// ═══════════════════════════════════════════

$enabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: $enabled.checked });
});
$useContext.addEventListener('change', () => {
  chrome.storage.local.set({ usePageContext: $useContext.checked });
});
$triggerMode.addEventListener('change', () => {
  chrome.storage.local.set({ triggerMode: $triggerMode.value });
});

// ═══════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════

function showStatus(msg, type) {
  $status.textContent = msg;
  $status.className = 'status ' + (type || '');
  setTimeout(() => {
    $status.textContent = '';
    $status.className = 'status';
  }, 3000);
}

// 获取列表和保存模型均使用当前输入的连接，不需要先点总保存。
function getConnection() {
  return { apiBaseUrl: AIConfig.normalizeBaseUrl($apiBaseUrl.value), apiKey: $apiKey.value.trim() };
}
async function saveConnection(connection) {
  await chrome.storage.local.set({ ...connection, availableModels: availableModels.slice(), verifyModel: $verifyModel.checked, requiresApiSetup: false });
  $apiBaseUrl.value = connection.apiBaseUrl;
}
$fetchModels.addEventListener('click', async () => {
  $fetchModels.disabled = true;
  showModelMessage($connectionMsg, '正在获取接口模型列表…', 'info', 0);
  try {
    const connection = getConnection();
    const result = await chrome.runtime.sendMessage({ type: 'LIST_MODELS', connection });
    if (!result?.ok) throw new Error(result?.error || '获取模型失败');
    availableModels = result.models;
    hiddenCatalogModels = hiddenCatalogModels.filter(id => !result.models.includes(id));
    modelList = normalizeModelList([...modelList, ...result.models]);
    const selected = tabs.map(tab => tab.select.value || result.models[0]);
    renderAllModelOptions();
    tabs.forEach((tab, index) => setTabSelection(tab, selected[index]));
    await chrome.storage.local.set({ ...connection, modelList: modelList.slice(), availableModels, hiddenCatalogModels,
      explainModel: tabs[0].select.value, translateModel: tabs[1].select.value,
      verifyModel: $verifyModel.checked, requiresApiSetup: false });
    showModelMessage($connectionMsg, `✅ 获取 ${result.models.length} 个模型并合并到列表。请选择支持文本对话的模型，列表存在不代表生成已验证。`, 'success', 0);
  } catch (err) { showModelMessage($connectionMsg, err.message, 'error', 0); }
  finally { $fetchModels.disabled = false; }
});

async function requestCatalogSnapshot() {
  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: 'REFRESH_MODEL_CATALOG' });
  } catch (err) {
    // 升级后旧 Worker、已关闭的消息通道或尚未建立的监听器。
    if (!/receiving end does not exist|could not establish connection|message port closed|message channel closed/i.test(err.message)) throw err;
  }
  if (result == null) {
    const stored = await chrome.storage.local.get('catalogSnapshot');
    const snapshot = await AIModelCatalog.refresh(stored.catalogSnapshot);
    await chrome.storage.local.set({ catalogSnapshot: snapshot });
    return { snapshot, recovered: true };
  }
  if (!result.ok) throw new Error(result.error || '后台返回了失败回复，但没有提供错误详情；请重新加载扩展');
  if (result.snapshot?.source !== AIModelCatalog.SOURCE || !Array.isArray(result.snapshot.providers)) {
    throw new Error('后台返回的模型目录无效；请重新加载扩展');
  }
  return { snapshot: result.snapshot, recovered: false };
}

async function refreshCatalog() {
  if (catalogRefreshing) return;
  catalogRefreshing = true;
  catalogState();
  try {
    const result = await requestCatalogSnapshot();
    const savedSelections = await chrome.storage.local.get(['explainModel', 'translateModel']);
    const selections = tabs.map(tab => tab.select.value);
    const drafts = tabs.map(tab => ({ manufacturer: tab.manufacturer.value, input: tab.input.value }));
    const oldCatalogIds = new Set(AIModelCatalog.allModels(catalogSnapshot)
      .map(model => AIModelCatalog.resolveId(model, $apiBaseUrl.value, availableModels)));
    modelList = modelList.filter(id => !oldCatalogIds.has(id) || selections.includes(id) ||
      Object.values(savedSelections).includes(id) || availableModels.includes(id) || Object.hasOwn(modelManufacturers, id));
    catalogSnapshot = AIModelCatalog.normalizeSnapshot(result.snapshot);
    renderManufacturers(); renderAllModelOptions();
    tabs.forEach((tab, index) => {
      setTabSelection(tab, selections[index]);
      if (!selections[index]) { tab.manufacturer.value = drafts[index].manufacturer; renderModelOptions(tab); }
      tab.input.value = drafts[index].input;
    });
    await chrome.storage.local.set({ modelList: modelList.slice(), catalogLastCheckedAt: new Date().toISOString() });
    const stale = catalogSnapshot.providers.filter(p => p.stale).length;
    catalogState(stale ? '部分厂家的模型暂未更新，已保留已有列表。' : '');
  } catch (err) {
    catalogState('暂时无法获取模型，已保留已有列表。');
    console.warn('公开模型目录刷新失败：', err.message);
  } finally {
    catalogRefreshing = false;
  }
}
function invalidateAvailableModels() {
  availableModels = []; // 旧接口列表不能作为新接口的 ID 匹配依据。
  renderAllModelOptions();
  tabs.forEach(tab => syncInputFromSelect(tab));
}
$apiBaseUrl.addEventListener('change', invalidateAvailableModels);
$apiKey.addEventListener('change', invalidateAvailableModels);
