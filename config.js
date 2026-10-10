// 设置页与后台共用配置；不按模型名称猜测供应商。
(() => {
  const DEFAULT_MODEL = 'gpt-4.1-mini';
  const DEFAULT_MODELS = [DEFAULT_MODEL, 'gpt-4.1', 'gpt-4.1-nano',
    'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini'];
  const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
  const normalizeModel = model => typeof model === 'string' ? model.trim() : '';
  const normalizeModels = list => [...new Set((Array.isArray(list) ? list : [])
    .map(normalizeModel).filter(Boolean))];

  function normalizeBaseUrl(input) {
    let url;
    try { url = new URL(String(input || '').trim()); }
    catch { throw new Error('请输入有效的 API Base URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('接口地址须为 HTTP/HTTPS 地址，不能包含账号、查询参数或片段');
    }
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|models)$/, '');
    return url.href.replace(/\/+$/, '');
  }

  function migrate(raw) {
    const config = { enabled: true, usePageContext: true, triggerMode: 'auto',
      language: 'auto', targetLanguage: 'zh', explainThinkingEnabled: false,
      translateThinkingEnabled: false, explainReasoningEffort: 'high',
      translateReasoningEffort: 'high', verifyModel: true, ...raw };
    if (raw.apiConfigVersion !== 1) {
      // 旧版的 apiKey 属于专用供应商，不能发到新默认地址。
      const legacy = !raw.apiBaseUrl && (raw.apiKey || raw.qwenApiKey || raw.modelList || raw.model || raw.explainModel);
      config.apiBaseUrl = raw.apiBaseUrl || DEFAULT_BASE_URL;
      config.apiKey = legacy ? '' : (raw.apiKey || '');
      config.requiresApiSetup = Boolean(legacy);
      const keepModel = name => !/^(deepseek|qwen)/i.test(name);
      config.modelList = normalizeModels([...DEFAULT_MODELS,
        ...(Array.isArray(raw.modelList) ? raw.modelList : []),
        ...(Array.isArray(raw.customModels) ? raw.customModels : []),
        raw.explainModel, raw.translateModel, raw.model]).filter(keepModel);
      for (const key of ['explainModel', 'translateModel']) {
        const model = normalizeModel(raw[key] || raw.model);
        config[key] = model && keepModel(model) ? model : DEFAULT_MODEL;
        config[key.replace('Model', 'ThinkingEnabled')] = false;
      }
      config.apiConfigVersion = 1;
    }
    config.apiBaseUrl ||= DEFAULT_BASE_URL;
    config.apiKey ||= '';
    config.modelList = normalizeModels(config.modelList);
    // 只升级厂家目录，不改 v4 已保存的接口、Key 或当前模型。
    if (config.modelCatalogVersion !== 1) {
      const presets = AIModelCatalog.allModels().map(AIModelCatalog.nativeId);
      config.modelList = normalizeModels([...config.modelList, ...presets]);
      config.modelCatalogVersion = 1;
    }
    config.modelManufacturers ||= {};
    config.availableModels = normalizeModels(config.availableModels);
    config.catalogSnapshot = AIModelCatalog.normalizeSnapshot(config.catalogSnapshot);
    for (const key of ['explainModel', 'translateModel']) {
      config[key] = normalizeModel(config[key]);
      if (!config.modelList.includes(config[key])) config[key] = config.modelList[0] || '';
      config[key.replace('Model', 'Manufacturer')] = AIModelCatalog.providerFor(config[key], config.modelManufacturers);
    }
    for (const key of ['explainReasoningEffort', 'translateReasoningEffort']) {
      if (!['low', 'medium', 'high'].includes(config[key])) config[key] = 'high';
    }
    for (const key of ['qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort']) delete config[key];
    return config;
  }

  async function load() {
    const raw = await chrome.storage.local.get(null);
    const config = migrate(raw);
    if (JSON.stringify(raw) !== JSON.stringify(config)) await chrome.storage.local.set(config);
    const oldKeys = ['qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort'];
    if (oldKeys.some(key => Object.hasOwn(raw, key))) await chrome.storage.local.remove(oldKeys);
    return config;
  }

  globalThis.AIConfig = { DEFAULT_MODEL, DEFAULT_MODELS, DEFAULT_BASE_URL,
    normalizeModel, normalizeModels, normalizeBaseUrl, migrate, load };
})();
