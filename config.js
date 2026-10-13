// 设置页与后台共用配置；显式厂家决定连接，不按模型名称路由。
(() => {
  const DEFAULT_MODEL = 'gpt-4.1-mini';
  const DEFAULT_MODELS = [DEFAULT_MODEL, 'gpt-4.1', 'gpt-4.1-nano',
    'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini'];
  const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
  const PROVIDER_ENDPOINTS = Object.freeze({
    openai: DEFAULT_BASE_URL, deepseek: 'https://api.deepseek.com',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshot: 'https://api.moonshot.cn/v1', zai: 'https://open.bigmodel.cn/api/paas/v4',
    minimax: 'https://api.minimax.io/v1', xai: 'https://api.x.ai/v1', mistral: 'https://api.mistral.ai/v1'
  });
  const validProvider = id => id === 'custom' || Object.hasOwn(PROVIDER_ENDPOINTS, id);
  const normalizeModel = model => typeof model === 'string' ? model.trim() : '';
  const normalizeModels = list => [...new Set((Array.isArray(list) ? list : [])
    .map(normalizeModel).filter(Boolean))];
  // 官方厂家有固定地址；自定义连接必须提供自己的地址，不能借用默认厂家。
  const endpointFor = (provider, entry = {}) => PROVIDER_ENDPOINTS[provider] ||
    (typeof entry.apiBaseUrl === 'string' ? entry.apiBaseUrl.trim() : '');
  function isDeepSeekEndpoint(input) {
    try { return new URL(input).hostname === 'api.deepseek.com'; }
    catch { return false; }
  }

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
      explainDeepSeekThinkingEnabled: false, translateDeepSeekThinkingEnabled: false,
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
    // 已有v4全局Key缺地址时保留未配置状态，迁移不得猜测Key属于OpenAI。
    config.apiBaseUrl = typeof config.apiBaseUrl === 'string' ? config.apiBaseUrl.trim() : '';
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
      if (!config.modelList.includes(config[key])) config[key] = raw.providerConfigVersion === 1 ? '' : (config.modelList[0] || '');
      const manufacturerKey = key.replace('Model', 'Manufacturer');
      if (!validProvider(config[manufacturerKey])) config[manufacturerKey] = AIModelCatalog.providerFor(config[key], config.modelManufacturers);
    }
    if (raw.providerConfigVersion !== 1) {
      // 把原来的连接只交给匹配的厂家；第三方网关保留为自定义，不转发旧 Key。
      config.providerConnections = {};
      let oldBase = config.apiBaseUrl;
      try { oldBase = normalizeBaseUrl(oldBase); } catch {}
      for (const kind of ['explain', 'translate']) {
        const maker = config[kind + 'Manufacturer'];
        const provider = PROVIDER_ENDPOINTS[maker] === oldBase ? maker : 'custom';
        config[kind + 'Manufacturer'] = provider;
        config.providerConnections[provider] = { apiBaseUrl: oldBase, apiKey: config.apiKey,
          availableModels: config.availableModels.slice() };
      }
      config.providerConfigVersion = 1;
    }
    config.providerConnections = normalizeConnections(config.providerConnections);
    config.triggerMode = config.triggerMode === 'contextMenu' ? 'contextMenu' : 'auto';
    for (const kind of ['explain', 'translate']) {
      config[kind + 'DeepSeekThinkingEnabled'] = config[kind + 'DeepSeekThinkingEnabled'] === true;
      const provider = config[kind + 'Manufacturer'];
      if (isDeepSeekEndpoint(endpointFor(provider, config.providerConnections[provider])) &&
          !config[kind + 'DeepSeekThinkingEnabled']) config[kind + 'ThinkingEnabled'] = false;
    }
    for (const key of ['explainReasoningEffort', 'translateReasoningEffort']) {
      if (!['low', 'medium', 'high'].includes(config[key])) config[key] = 'high';
    }
    for (const key of ['qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort']) delete config[key];
    return config;
  }

  function normalizeConnections(value) {
    const connections = {};
    for (const id of [...Object.keys(PROVIDER_ENDPOINTS), 'custom']) {
      const entry = value?.[id];
      if (!entry || typeof entry !== 'object') continue;
      connections[id] = { apiBaseUrl: endpointFor(id, entry),
        apiKey: typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '',
        availableModels: normalizeModels(entry.availableModels),
        modelEntries: AIModelCatalog.interfaceModels(entry.modelEntries || normalizeModels(entry.availableModels).map(model => ({id:model})), id),
        modelsCheckedAt: typeof entry.modelsCheckedAt === 'string' ? entry.modelsCheckedAt : '' };
    }
    return connections;
  }
  function connectionFor(config, kind = 'explain') {
    if (config.providerConfigVersion !== 1) return { apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey,
      availableModels: normalizeModels(config.availableModels) };
    const provider = config[kind + 'Manufacturer'];
    if (!validProvider(provider)) throw new Error('请先选择接口厂家并保存设置');
    const entry = config.providerConnections?.[provider] || {};
    const apiBaseUrl = endpointFor(provider, entry);
    if (provider === 'custom' && !apiBaseUrl) throw new Error('请先配置自定义接口地址');
    return { apiBaseUrl,
      apiKey: entry.apiKey || '', availableModels: normalizeModels(entry.availableModels), modelsCheckedAt: entry.modelsCheckedAt || '' };
  }

  async function load({ isCurrent = () => true } = {}) {
    const raw = await chrome.storage.local.get(null);
    // 后台读配置期间发生外部保存时，不让旧快照的迁移覆盖新值。
    if (!isCurrent()) return null;
    const config = migrate(raw);
    // storage 返回的键顺序可能不同；逐字段比较，只写真正需要迁移/归一化的值。
    const updates = Object.fromEntries(Object.entries(config)
      .filter(([key,value])=>JSON.stringify(raw[key]) !== JSON.stringify(value)));
    if (Object.keys(updates).length) {
      if (!isCurrent()) return null;
      await chrome.storage.local.set(updates);
    }
    const oldKeys = ['qwenApiKey', 'customModels', 'model', 'thinkingEnabled', 'reasoningEffort'];
    if (oldKeys.some(key => Object.hasOwn(raw, key))) {
      if (!isCurrent()) return null;
      await chrome.storage.local.remove(oldKeys);
    }
    return isCurrent() ? config : null;
  }

  globalThis.AIConfig = { DEFAULT_MODEL, DEFAULT_MODELS, DEFAULT_BASE_URL,
    PROVIDER_ENDPOINTS, validProvider, endpointFor, isDeepSeekEndpoint, normalizeConnections, connectionFor,
    normalizeModel, normalizeModels, normalizeBaseUrl, migrate, load };
})();
