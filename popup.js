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
const $verifyModel = document.getElementById('verify-model');
const $connectionMsg = document.getElementById('connection-msg');
const $enabled = document.getElementById('enabled');
const $useContext = document.getElementById('use-context');
const $triggerMode = document.getElementById('trigger-mode');
const $saveBtn = document.getElementById('save-btn');
const $status = document.getElementById('status');

// 两个标签共享同一份模型列表
let modelList = [];

const tabs = [
  {
    key: 'explainModel',
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

function modelDisplayName(model) { return model; }

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

function renderModelOptions($select) {
  const current = $select.value;
  $select.innerHTML = '';

  modelList.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = modelDisplayName(model);
    $select.appendChild(option);
  });

  if (current && modelList.includes(current)) {
    $select.value = current;
  } else {
    $select.selectedIndex = -1;
  }
}

function renderAllModelOptions() {
  tabs.forEach(tab => renderModelOptions(tab.select));
}

function setTabSelection(tab, modelId) {
  if (modelId && modelList.includes(modelId)) {
    tab.select.value = modelId;
    tab.input.value = modelId;
    tab.deleteBtn.disabled = false;
  } else {
    tab.select.selectedIndex = -1;
    tab.input.value = modelId || '';
    tab.deleteBtn.disabled = true;
  }
  syncThinkingForTab(tab);
}

function syncInputFromSelect(tab) {
  const model = tab.select.value || '';
  tab.input.value = model;
  tab.deleteBtn.disabled = !model;
  clearModelMessage(tab.msg);
  syncThinkingForTab(tab);
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

  // 修改当前选中模型，或新增模型
  if (currentInList) {
    const index = modelList.indexOf(current);
    modelList[index] = targetId;
  } else if (!targetInList) {
    modelList.push(targetId);
  }

  const updates = { modelList: modelList.slice() };
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
  modelList = modelList.filter(item => item !== model);
  const fallback = modelList[Math.min(index, modelList.length - 1)] || '';

  const updates = { modelList: modelList.slice() };
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

  renderAllModelOptions();
  setTabSelection(tabs[0], config.explainModel);
  setTabSelection(tabs[1], config.translateModel);

  $apiKey.value = config.apiKey || '';

  $enabled.checked = config.enabled !== false;
  $useContext.checked = config.usePageContext !== false;
  $triggerMode.value = config.triggerMode || 'auto';
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
    modelList: modelList.slice()
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
  await chrome.storage.local.set({ ...connection, verifyModel: $verifyModel.checked, requiresApiSetup: false });
  $apiBaseUrl.value = connection.apiBaseUrl;
}
$fetchModels.addEventListener('click', async () => {
  $fetchModels.disabled = true;
  showModelMessage($connectionMsg, '正在获取接口模型列表…', 'info', 0);
  try {
    const connection = getConnection();
    const result = await chrome.runtime.sendMessage({ type: 'LIST_MODELS', connection });
    if (!result?.ok) throw new Error(result?.error || '获取模型失败');
    modelList = normalizeModelList([...modelList, ...result.models]);
    const selected = tabs.map(tab => tab.select.value || result.models[0]);
    renderAllModelOptions();
    tabs.forEach((tab, index) => setTabSelection(tab, selected[index]));
    await chrome.storage.local.set({ ...connection, modelList: modelList.slice(),
      explainModel: tabs[0].select.value, translateModel: tabs[1].select.value,
      verifyModel: $verifyModel.checked, requiresApiSetup: false });
    showModelMessage($connectionMsg, `✅ 获取 ${result.models.length} 个模型并合并到列表。请选择支持文本对话的模型，列表存在不代表生成已验证。`, 'success', 0);
  } catch (err) { showModelMessage($connectionMsg, err.message, 'error', 0); }
  finally { $fetchModels.disabled = false; }
});
