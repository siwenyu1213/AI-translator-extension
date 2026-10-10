// 公开文本模型目录快照；来源与时间随刷新结果保留。
(() => {
  const BUILTIN = {
  "updatedAt": "2026-10-10T12:35:34.090Z",
  "source": "https://openrouter.ai/api/v1/models",
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "prefix": "openai",
      "docs": "https://developers.openai.com/api/docs/models",
      "models": [
        {
          "id": "openai/gpt-6.1-sol-pro",
          "name": "GPT-6.1 Sol Pro",
          "created": 1790702886
        },
        {
          "id": "openai/gpt-6.1-sol",
          "name": "GPT-6.1 Sol",
          "created": 1790702882
        },
        {
          "id": "openai/gpt-6-luna-pro",
          "name": "GPT-6 Luna Pro",
          "created": 1790100791
        }
      ]
    },
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "prefix": "deepseek",
      "docs": "https://api-docs.deepseek.com/quick_start/pricing-details-cny/",
      "models": [
        {
          "id": "deepseek/deepseek-v4.1-flash",
          "name": "DeepSeek V4.1 Flash",
          "created": 1789021285
        },
        {
          "id": "deepseek/deepseek-v4-flash-vision-exp",
          "name": "DeepSeek V4 Flash Vision Exp",
          "created": 1787311563
        },
        {
          "id": "deepseek/deepseek-v4-pro-0813",
          "name": "DeepSeek V4 Pro 0813",
          "created": 1786549364
        }
      ]
    },
    {
      "id": "anthropic",
      "name": "Anthropic · Claude",
      "prefix": "anthropic",
      "docs": "https://platform.claude.com/docs/en/models/overview",
      "models": [
        {
          "id": "anthropic/claude-haiku-5.5",
          "name": "Claude Haiku 5.5",
          "created": 1791397883
        },
        {
          "id": "anthropic/claude-sonnet-5.5",
          "name": "Claude Sonnet 5.5",
          "created": 1790618686
        },
        {
          "id": "anthropic/claude-opus-5.5",
          "name": "Claude Opus 5.5",
          "created": 1790094732
        }
      ]
    },
    {
      "id": "google",
      "name": "Google · Gemini",
      "prefix": "google",
      "docs": "https://ai.google.dev/gemini-api/docs/models",
      "models": [
        {
          "id": "google/gemini-3.8-flash",
          "name": "Gemini 3.8 Flash",
          "created": 1788362056
        },
        {
          "id": "google/gemini-3.7-flash",
          "name": "Gemini 3.7 Flash",
          "created": 1786640581
        },
        {
          "id": "google/gemini-3.6-flash",
          "name": "Gemini 3.6 Flash",
          "created": 1784646733
        }
      ]
    },
    {
      "id": "qwen",
      "name": "阿里千问 · Qwen",
      "prefix": "qwen",
      "docs": "https://help.aliyun.com/zh/model-studio/models",
      "models": [
        {
          "id": "qwen/qwen3.8-max-prime",
          "name": "Qwen3.8 Max Prime",
          "created": 1790191228
        },
        {
          "id": "qwen/qwen3.8-omni-flash",
          "name": "Qwen3.8 Omni Flash",
          "created": 1789959954
        },
        {
          "id": "qwen/qwen3.8-max-0902",
          "name": "Qwen3.8 Max (0902)",
          "created": 1788469704
        }
      ]
    },
    {
      "id": "moonshot",
      "name": "月之暗面 · Kimi",
      "prefix": "moonshotai",
      "docs": "https://platform.moonshot.cn/docs",
      "models": [
        {
          "id": "moonshotai/kimi-k3",
          "name": "Kimi K3",
          "created": 1784215858
        },
        {
          "id": "moonshotai/kimi-k2.7-code",
          "name": "Kimi K2.7 Code",
          "created": 1781266361
        },
        {
          "id": "moonshotai/kimi-k2.6",
          "name": "Kimi K2.6",
          "created": 1776699402
        }
      ]
    },
    {
      "id": "zai",
      "name": "智谱 · GLM",
      "prefix": "z-ai",
      "docs": "https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3",
      "models": [
        {
          "id": "z-ai/glm-5.3-prime",
          "name": "GLM 5.3 Prime",
          "created": 1790199651
        },
        {
          "id": "z-ai/glm-5.3-flashx",
          "name": "GLM 5.3 FlashX",
          "created": 1789744020
        },
        {
          "id": "z-ai/glm-5.3-flash",
          "name": "GLM 5.3 Flash",
          "created": 1787752741
        }
      ]
    },
    {
      "id": "minimax",
      "name": "MiniMax",
      "prefix": "minimax",
      "docs": "https://platform.minimax.io/docs/guides/models-intro",
      "models": [
        {
          "id": "minimax/minimax-m3",
          "name": "MiniMax M3",
          "created": 1780245374
        },
        {
          "id": "minimax/minimax-m2.7",
          "name": "MiniMax M2.7",
          "created": 1773836697
        },
        {
          "id": "minimax/minimax-m2.5",
          "name": "MiniMax M2.5",
          "created": 1770908502
        }
      ]
    },
    {
      "id": "xai",
      "name": "xAI · Grok",
      "prefix": "x-ai",
      "docs": "https://docs.x.ai/developers/models",
      "models": [
        {
          "id": "x-ai/grok-4.7",
          "name": "Grok 4.7",
          "created": 1790007541
        },
        {
          "id": "x-ai/grok-4.6",
          "name": "Grok 4.6",
          "created": 1786548957
        },
        {
          "id": "x-ai/grok-4.5",
          "name": "Grok 4.5",
          "created": 1783523154
        }
      ]
    },
    {
      "id": "mistral",
      "name": "Mistral AI",
      "prefix": "mistralai",
      "docs": "https://docs.mistral.ai/models",
      "models": [
        {
          "id": "mistralai/mistral-large-4-0",
          "name": "Mistral Large 4",
          "created": 1791294122
        },
        {
          "id": "mistralai/mistral-medium-3-5",
          "name": "Mistral Medium 3.5",
          "created": 1777570439
        },
        {
          "id": "mistralai/mistral-small-2603",
          "name": "Mistral Small 4",
          "created": 1773695685
        }
      ]
    }
  ]
};
  const SOURCE = 'https://openrouter.ai/api/v1/models';
  const REFRESH_MS = 15 * 60 * 1000;
  const COMPATIBILITY = [
    { provider: 'deepseek', id: 'deepseek/deepseek-v4.1-flash', nativeId: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' },
    { provider: 'deepseek', id: 'deepseek/deepseek-v4-flash', nativeId: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash（历史兼容）', note: '官方已退役 V4 Flash，此调用名在官方接口转到 V4.1 Flash；网关行为以其接口为准。' },
    { provider: 'deepseek', id: 'deepseek/deepseek-v4-pro', nativeId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
  ];
  const nativeAliases = {
    'deepseek/deepseek-v4.1-flash': 'deepseek-flash',
    'mistralai/mistral-large-4-0': 'mistral-large-latest',
    'mistralai/mistral-small-2603': 'mistral-small-latest'
  };
  function nativeId(model) {
    if (model.nativeId) return model.nativeId;
    if (nativeAliases[model.id]) return nativeAliases[model.id];
    let id = model.id.slice(model.id.indexOf('/') + 1);
    if (model.id.startsWith('anthropic/')) id = id.replace(/(\d)\.(\d)/g, '$1-$2');
    if (model.id.startsWith('minimax/')) id = id.replace(/^minimax-m/i, 'MiniMax-M');
    return id;
  }
  function providerFor(id, assignments = {}) {
    if (assignments[id] && [...BUILTIN.providers.map(p => p.id), 'custom'].includes(assignments[id])) return assignments[id];
    const lower = String(id || '').toLowerCase();
    const prefix = BUILTIN.providers.find(p => lower.startsWith(p.prefix + '/'));
    if (prefix) return prefix.id;
    const rules = [ ['openai', /^(gpt-|o[134](?:-|$))/], ['deepseek', /deepseek/],
      ['anthropic', /claude/], ['google', /gemini|gemma/], ['qwen', /qwen/],
      ['moonshot', /kimi|moonshot/], ['zai', /\bglm/], ['minimax', /minimax/],
      ['xai', /grok/], ['mistral', /mistral|ministral|codestral|devstral|magistral/] ];
    return rules.find(([, regex]) => regex.test(lower))?.[0] || 'custom';
  }
  function normalizeSnapshot(value) {
    if (!value || value.source !== SOURCE || !Number.isFinite(Date.parse(value.updatedAt))) return BUILTIN;
    const providers = BUILTIN.providers.map(base => {
      const incoming = Array.isArray(value.providers) ? value.providers.find(p => p.id === base.id) : null;
      const models = (Array.isArray(incoming?.models) ? incoming.models : [])
        .filter(m => typeof m.id === 'string' && m.id.startsWith(base.prefix + '/') && m.id.length <= 200 &&
          !/[\s:]/.test(m.id) && typeof m.name === 'string' && m.name.length <= 200 &&
          Number.isFinite(m.created) && m.created > 0 && m.created * 1000 <= Date.now() + 86400000)
        .filter((m, index, list) => list.findIndex(item => item.id === m.id) === index)
        .slice(0, 3).map(m => ({ id: m.id, name: m.name, created: m.created }));
      return models.length === 3 ? { ...base, models, updatedAt: incoming.updatedAt || value.updatedAt, stale: incoming.stale === true } : { ...base, updatedAt: BUILTIN.updatedAt, stale: true };
    });
    return { updatedAt: value.updatedAt, source: SOURCE, providers };
  }
  function resolveId(model, baseUrl, availableModels = []) {
    const native = nativeId(model);
    // 当前接口真实返回的 ID 优先。目录厂家只影响选择，不改变请求端点。
    const matches = [model.id, native].filter(id => availableModels.includes(id));
    if (matches.length) return /openrouter\.ai/i.test(baseUrl) && matches.includes(model.id) ? model.id : matches[0];
    try { if (new URL(baseUrl).hostname === 'openrouter.ai') return model.id; } catch {}
    return native;
  }
  function allModels(snapshot = BUILTIN) {
    return [...snapshot.providers.flatMap(p => p.models.map(m => ({ ...m, provider: p.id }))), ...COMPATIBILITY];
  }
  async function refresh(previous = BUILTIN) {
    const res = await fetch(SOURCE, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`公开模型目录请求失败 (${res.status})`);
    const payload = await res.json();
    if (!Array.isArray(payload?.data)) throw new Error('公开模型目录格式无效，保留已保存列表');
    const timestamp = new Date().toISOString();
    const existing = normalizeSnapshot(previous);
    let updated = 0;
    const providers = existing.providers.map(provider => {
      const selected = payload.data.filter(m => typeof m.id === 'string' && m.id.startsWith(provider.prefix + '/') &&
        !/[\s:]/.test(m.id) && m.id.length <= 200 && typeof m.name === 'string' &&
        m.name.length <= 200 && Number.isFinite(m.created) && m.created > 0 &&
        m.created * 1000 <= Date.now() + 86400000 &&
        m.architecture?.input_modalities?.includes('text') &&
        m.architecture?.output_modalities?.length === 1 && m.architecture.output_modalities[0] === 'text' &&
        (!m.expiration_date || Date.parse(m.expiration_date) > Date.now()))
        .sort((a,b) => b.created - a.created || a.id.localeCompare(b.id))
        .filter((m, index, list) => list.findIndex(item => item.id === m.id) === index).slice(0,3)
        .map(m => ({ id: m.id, name: m.name.replace(/^[^:]+:\s*/, ''), created: m.created }));
      if (selected.length < 3) return { ...provider, stale: true };
      updated++;
      return { ...provider, models: selected, updatedAt: timestamp, stale: false };
    });
    if (!updated) throw new Error('目录没有提供足够的文本模型，保留已保存列表');
    return { updatedAt: timestamp, source: SOURCE, providers };
  }
  globalThis.AIModelCatalog = { BUILTIN, SOURCE, REFRESH_MS, COMPATIBILITY, nativeId,
    providerFor, normalizeSnapshot, resolveId, allModels, refresh };
})();
