// 文件职责：默认配置、旧配置迁移、厂家连接、接口地址校验与思考开关归一化。
// 设置页与后台共用；显式厂家决定连接，不按模型名称路由。
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

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 共用配置：提供默认值，兼容旧设置，检查地址，选择厂家连接。
// popup.js 和 background.js 共用 AIConfig；选择厂家后，再取得该厂家的地址和 Key。
// 先看 connectionFor 和 load；migrate 将旧格式整理成当前格式。
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
// 第 3 行：定义并立即执行初始化函数；内部步骤见下面各行。
// 第 4 行：准备 DEFAULT_MODEL（默认模型名）：“gpt-4.1-mini”。
// 第 5 行：准备 DEFAULT_MODELS（兼容迁移使用的默认模型列表）：含 10 项的列表。
// 第 6 行：继续前一行的变量定义；本行补充 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini'];。
// 第 7 行：准备 DEFAULT_BASE_URL（默认 OpenAI 地址）：“https://api.openai.com/v1”。
// 第 8 行：准备 PROVIDER_ENDPOINTS（厂家预设地址表）：固定 一组字段 的顶层字段，防止直接修改。
// 第 9 行：openai 字段设为 默认 OpenAI 地址；deepseek 字段设为 “https://api.deepseek.com”。
// 第 10 行：anthropic 字段设为 “https://api.anthropic.com/v1”。
// 第 11 行：google 字段设为 “https://generativelanguage.googleapis.com/v1beta/openai”。
// 第 12 行：qwen 字段设为 “https://dashscope.aliyuncs.com/compatible-mode/v1”。
// 第 13 行：moonshot 字段设为 “https://api.moonshot.cn/v1”；zai 字段设为 “https://open.bigmodel.cn/api/paas/v4”。
// 第 14 行：minimax 字段设为 “https://api.minimax.io/v1”；xai 字段设为 “https://api.x.ai/v1”；mistral 字段设为 “https://api.mistral.ai/v1”。
// 第 15 行：结束前面的代码块、资料列表或函数调用。
// 第 16 行：定义工具 validProvider：小函数，接收 标识；返回 （（标识 等于 “custom”） 或 检查 厂家预设地址表 是否自带字段 标识）。
// 第 17 行：定义工具 normalizeModel：小函数，接收 模型；返回 若 （模型的数据类型 等于 “string”），用 去掉 模型 两端空白；否则用 “”。
// 第 18 行：定义 normalizeModels：有效列表中的型号去空白、去空项、去重复。
// 第 19 行：逐项整理型号，然后过滤空值。
// 第 21 行：定义工具 endpointFor：小函数，接收 厂家标识、一条资料，未传入时用 空资料对象 {}；返回 （厂家预设地址表的第 [厂家标识] 项 或 若 （typeof entry.apiBaseUrl 的计算结果 等于 "string"），用 去掉 一条资料的接口基础地址 两端空白；否则用 “”）。
// 第 22 行：继续前一行的变量定义；本行补充 (typeof entry.apiBaseUrl === 'string' ? entry.apiBaseUrl.trim() : '');。
// 第 23 行：定义函数 isDeepSeekEndpoint：只按主机名判断 DeepSeek 官方地址；接收 输入值。
// 第 24 行：解析网址，只把主机名恰好为 api.deepseek.com 的地址当作官方接口。
// 第 25 行：捕获前面步骤的错误，按下面步骤处理；结束当前函数，并返回 否（false）。
// 第 26 行：结束前面的代码块、资料列表或函数调用。
// 第 28 行：定义函数 normalizeBaseUrl：检查地址并去掉末尾接口路径；接收 输入值。
// 第 29 行：准备 url，暂不赋值。
// 第 30 行：尝试将输入去空白后解析为 URL。
// 第 31 行：捕获前面步骤的错误，按下面步骤处理；报告错误并中断当前正常流程：建立错误信息（“请输入有效的 API Base URL”）。
// 第 32 行：拒绝非 HTTP/HTTPS、带账号密码、查询参数或片段的地址。
// 第 33 行：报告错误并中断当前正常流程：建立错误信息（“接口地址须为 HTTP/HTTPS 地址，不能包含账号、查询参数或片段”）。
// 第 34 行：结束前面的代码块、资料列表或函数调用。
// 第 35 行：去掉路径末尾斜线，以及 /chat/completions 或 /models 尾部路径。
// 第 36 行：返回干净的基础地址。
// 第 37 行：结束前面的代码块、资料列表或函数调用。
// 第 39 行：定义函数 migrate：把旧配置整理为当前配置；接收 原始数据。
// 第 40 行：先设置默认启用、使用背景、自动划词等配置，再用已保存值覆盖默认值。
// 第 41 行：language 字段设为 “auto”；targetLanguage 字段设为 “zh”；explainThinkingEnabled 字段设为 否（false）。
// 第 42 行：translateThinkingEnabled 字段设为 否（false）；explainReasoningEffort 字段设为 “high”。
// 第 43 行：explainDeepSeekThinkingEnabled 字段设为 否（false）；translateDeepSeekThinkingEnabled 字段设为 否（false）。
// 第 44 行：translateReasoningEffort 字段设为 “high”；verifyModel 字段设为 是（true）。
// 第 45 行：如果 （原始数据的apiConfigVersion 不等于 1），执行下面这一组步骤。
// 第 47 行：旧配置有专用 Key 或型号、却没有地址时，视为需要重新配置的旧版连接。
// 第 48 行：配置的apiBaseUrl 改为 （原始数据的apiBaseUrl 或 默认 OpenAI 地址）。
// 第 49 行：不能确定归属的旧 Key 清空；其他已明确连接的 Key 保留。
// 第 50 行：记录是否需要用户重新填写 API 配置。
// 第 51 行：定义工具 keepModel：小函数，接收 名称；返回 不满足（检查 名称 是否符合 字符匹配规则 /^(deepseek|qwen)/i）。
// 第 52 行：合并默认、旧列表、自定义和旧选择的型号，再去重并排除旧专用厂家型号。
// 第 53 行：补入原来的模型列表。
// 第 54 行：补入原来的自定义型号。
// 第 55 行：补入解释、翻译和旧全局型号。
// 第 56 行：逐项读取 列表 [“explainModel”、“translateModel”]，当前项记作 字段名或 Key，执行下面步骤。
// 第 57 行：准备 model（模型）：整理模型名，去掉两端空白（（原始数据的第 [字段名或 Key] 项 或 原始数据的model））。
// 第 58 行：保留仍符合迁移要求的型号，否则改为默认型号。
// 第 59 行：旧版迁移时关闭各用途的深度思考。
// 第 60 行：结束前面的代码块、资料列表或函数调用。
// 第 61 行：配置的apiConfigVersion 改为 1。
// 第 62 行：结束前面的代码块、资料列表或函数调用。
// 第 64 行：保留明确填写的接口地址；缺地址保持空值，不猜 Key 属于 OpenAI。
// 第 65 行：配置的apiKey 原值为空或为否时改为 “”。
// 第 66 行：配置的modelList 改为 整理模型列表并去重（配置的模型名列表）。
// 第 68 行：如果 （配置的modelCatalogVersion 不等于 1），执行下面这一组步骤。
// 第 69 行：准备 presets：逐项转换 合并所有厂家的型号和兼容补充项，转换规则为 AIModelCatalog的nativeId。
// 第 70 行：配置的modelList 改为 整理模型列表并去重（列表）。
// 第 71 行：配置的modelCatalogVersion 改为 1。
// 第 72 行：结束前面的代码块、资料列表或函数调用。
// 第 73 行：配置的modelManufacturers 原值为空或为否时改为 空资料对象 {}。
// 第 74 行：配置的availableModels 改为 整理模型列表并去重（配置的接口开放的型号）。
// 第 75 行：配置的catalogSnapshot 改为 校验目录快照，缺失数据使用内置资料（配置的模型目录快照）。
// 第 76 行：逐项读取 列表 [“explainModel”、“translateModel”]，当前项记作 字段名或 Key，执行下面步骤。
// 第 77 行：配置的第 [字段名或 Key] 项 改为 整理模型名，去掉两端空白（配置的按 字段名或 Key 取得的项目）。
// 第 78 行：已选型号不在整理后的列表中时，当前厂家格式留空；旧格式使用首个可选项。
// 第 79 行：由模型字段名得到对应的厂家字段名。
// 第 80 行：厂家字段无效时，按型号资料和已有分配补充目录分类。
// 第 81 行：结束前面的代码块、资料列表或函数调用。
// 第 82 行：如果 （原始数据的providerConfigVersion 不等于 1），执行下面这一组步骤。
// 第 84 行：配置的providerConnections 改为 空资料对象 {}。
// 第 85 行：准备 oldBase：配置的apiBaseUrl。
// 第 86 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；oldBase 改为 检查地址并去掉末尾接口路径（oldBase）；捕获前面步骤的错误，按下面步骤处理。
// 第 87 行：逐项读取 列表 [“explain”、“translate”]，当前项记作 当前用途或内容类型，执行下面步骤。
// 第 88 行：准备 maker：配置的第 [（当前用途或内容类型 加上或拼接 “Manufacturer”）] 项。
// 第 89 行：旧地址恰好匹配该厂家预设才归给该厂家，否则保留为 custom。
// 第 90 行：配置的第 [（当前用途或内容类型 加上或拼接 “Manufacturer”）] 项 改为 厂家标识。
// 第 91 行：把原地址、Key 和开放型号交给刚确定的连接。
// 第 92 行：复制旧开放型号列表。
// 第 93 行：结束前面的代码块、资料列表或函数调用。
// 第 94 行：配置的providerConfigVersion 改为 1。
// 第 95 行：结束前面的代码块、资料列表或函数调用。
// 第 96 行：配置的providerConnections 改为 整理各厂家连接资料（配置的各厂家的连接草稿）。
// 第 97 行：配置的triggerMode 改为 若 （配置的triggerMode 等于 “contextMenu”），用 “contextMenu”；否则用 “auto”。
// 第 98 行：逐项读取 列表 [“explain”、“translate”]，当前项记作 当前用途或内容类型，执行下面步骤。
// 第 99 行：两用途的 DeepSeek 总开关只有保存值严格为 true 才算打开。
// 第 100 行：准备 provider（厂家标识）：配置的第 [（当前用途或内容类型 加上或拼接 “Manufacturer”）] 项。
// 第 101 行：当前连接是 DeepSeek 官方且总思考开关关闭时，不允许该用途开启深度思考。
// 第 102 行：将这个用途的深度思考设为 false。
// 第 103 行：结束前面的代码块、资料列表或函数调用。
// 第 104 行：逐项读取 列表 [“explainReasoningEffort”、“translateReasoningEffort”]，当前项记作 字段名或 Key，执行下面步骤。
// 第 105 行：如果 不满足（检查 列表 [“low”、“medium”、“high”] 是否包含 配置的按 字段名或 Key 取得的项目），配置的第 [字段名或 Key] 项 改为 “high”。
// 第 106 行：结束前面的代码块、资料列表或函数调用。
// 第 107 行：删除已被当前字段取代的旧版 Key、型号和思考配置。
// 第 108 行：结束当前函数，并返回 配置。
// 第 109 行：结束前面的代码块、资料列表或函数调用。
// 第 111 行：定义函数 normalizeConnections：整理各厂家连接资料；接收 待处理的值。
// 第 112 行：准备 connections（各厂家的连接资料）：空资料对象 {}。
// 第 113 行：逐项读取 列表 [展开或收集 取得 厂家预设地址表 的字段名列表、“custom”]，当前项记作 标识，执行下面步骤。
// 第 114 行：准备 entry（一条资料）：待处理的值（存在时）的第 [标识] 项。
// 第 115 行：如果 （不满足（一条资料） 或 （一条资料的数据类型 不等于 “object”）），跳过本轮余下步骤，进入下一轮循环。
// 第 116 行：整理连接字段，官方厂家使用预设地址，自定义使用明确地址。
// 第 117 行：apiKey 字段设为 若 （一条资料的apiKey的数据类型 等于 “string”），用 去掉 一条资料的apiKey 两端空白；否则用 “”。
// 第 118 行：availableModels 字段设为 整理模型列表并去重（一条资料的接口开放的型号）。
// 第 119 行：整理接口型号资料；只有型号名时先转成资料项，再做文本能力过滤。
// 第 120 行：modelsCheckedAt 字段设为 若 （一条资料的modelsCheckedAt的数据类型 等于 “string”），用 一条资料的modelsCheckedAt；否则用 “”。
// 第 121 行：结束前面的代码块、资料列表或函数调用。
// 第 122 行：结束当前函数，并返回 各厂家的连接资料。
// 第 123 行：结束前面的代码块、资料列表或函数调用。
// 第 124 行：定义函数 connectionFor：按解释或翻译用途取得实际连接；接收 配置、当前用途或内容类型，未传入时用 “explain”。
// 第 125 行：旧连接格式尚未迁移时，使用明确保存的旧全局连接。
// 第 126 行：同时整理旧开放型号列表。
// 第 127 行：准备 provider（厂家标识）：配置的第 [（当前用途或内容类型 加上或拼接 “Manufacturer”）] 项。
// 第 128 行：厂家无效就停止并提示先选择厂家。
// 第 129 行：取得该厂家的连接，没有记录时用空对象。
// 第 130 行：准备 apiBaseUrl（接口基础地址）：取得厂家预设地址或明确保存的自定义地址（厂家标识、一条资料）。
// 第 131 行：自定义厂家没有地址就停止，不向默认厂家发请求。
// 第 132 行：结束当前函数，并返回 一组字段（apiBaseUrl、apiKey: （一条资料的apiKey 或 “”）、availableModels: normalizeModels的结果、modelsCheckedAt: （一条资料的modelsCheckedAt 或 “”））。
// 第 133 行：apiKey 字段设为 （一条资料的apiKey 或 “”）；availableModels 字段设为 整理模型列表并去重（一条资料的接口开放的型号）；modelsCheckedAt 字段设为 （一条资料的modelsCheckedAt 或 “”）。
// 第 134 行：结束前面的代码块、资料列表或函数调用。
// 第 136 行：定义异步函数 load：读取配置，必要时保存迁移结果；接收 字段 isCurrent，未传入时用 空资料对象 {}。
// 第 137 行：从浏览器本地存储读取全部配置。
// 第 139 行：读取期间配置已更新就丢弃这次旧结果。
// 第 140 行：准备 config（配置）：把旧配置整理为当前配置（原始数据）。
// 第 142 行：逐字段比较整理前后值，只保存真正改变的字段。
// 第 143 行：逐字段将值转成 JSON 后比较，只筛出内容不同的字段。
// 第 144 行：如果 取得 待保存的变化 的字段名列表的length，执行下面这一组步骤。
// 第 145 行：保存迁移前再确认版本仍有效。
// 第 146 行：等待 向浏览器本地存储保存 待保存的变化 完成。
// 第 147 行：结束前面的代码块、资料列表或函数调用。
// 第 148 行：准备 oldKeys：列表 [“qwenApiKey”、“customModels”、“model”、“thinkingEnabled”、“reasoningEffort”]。
// 第 149 行：如果 检查 oldKeys 是否至少一项满足 检查 原始数据 是否自带字段 字段名或 Key，执行下面这一组步骤。
// 第 150 行：删除旧字段前也确认版本，避免覆盖新保存。
// 第 151 行：等待 从浏览器本地存储删除旧字段 oldKeys 完成。
// 第 152 行：结束前面的代码块、资料列表或函数调用。
// 第 153 行：结果仍属于当前读取版本才返回，否则返回 null。
// 第 154 行：结束前面的代码块、资料列表或函数调用。
// 第 156 行：将默认值和共用函数公开为 AIConfig。
// 第 157 行：PROVIDER_ENDPOINTS 字段沿用同名值；validProvider 字段沿用同名值；endpointFor 字段沿用同名值；isDeepSeekEndpoint 字段沿用同名值；normalizeConnections 字段沿用同名值；connectionFor 字段沿用同名值。
// 第 158 行：normalizeModel 字段沿用同名值；normalizeModels 字段沿用同名值；normalizeBaseUrl 字段沿用同名值；migrate 字段沿用同名值；load 字段沿用同名值。
// 第 159 行：结束初始化函数并立即执行，完成本文件的注册。
