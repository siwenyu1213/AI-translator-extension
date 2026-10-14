// 文件职责：厂家模型目录、公开快照刷新、接口模型查询与可用文本型号过滤。
// 来源与时间随刷新结果保留。
(() => {
  const BUILTIN = {
    "updatedAt": "2026-10-10T13:18:30.375Z",
    "source": "https://openrouter.ai/api/v1/models",
    "providers": [
      {
        "id": "openai",
        "name": "OpenAI",
        "prefix": "openai",
        "docs": "https://developers.openai.com/api/docs/models",
        "models": [
          {"id":"openai/gpt-6.1-sol-pro","name":"GPT-6.1 Sol Pro","created":1790702886},
          {"id":"openai/gpt-6.1-sol","name":"GPT-6.1 Sol","created":1790702882},
          {"id":"openai/gpt-6-luna-pro","name":"GPT-6 Luna Pro","created":1790100791},
          {"id":"openai/gpt-6-luna","name":"GPT-6 Luna","created":1790100786},
          {"id":"openai/gpt-6-sol-pro","name":"GPT-6 Sol Pro","created":1790100781},
          {"id":"openai/gpt-6-sol","name":"GPT-6 Sol","created":1790100775},
          {"id":"openai/gpt-6-astra","name":"GPT-6 Astra","created":1788552838},
          {"id":"openai/gpt-6-astra-pro","name":"GPT-6 Astra Pro","created":1788552835},
          {"id":"openai/gpt-5.6-luna-pro","name":"GPT-5.6 Luna Pro","created":1783590867},
          {"id":"openai/gpt-5.6-luna","name":"GPT-5.6 Luna","created":1783590864},
          {"id":"openai/gpt-5.6-terra-pro","name":"GPT-5.6 Terra Pro","created":1783590861},
          {"id":"openai/gpt-5.6-terra","name":"GPT-5.6 Terra","created":1783590857},
          {"id":"openai/gpt-5.6-sol-pro","name":"GPT-5.6 Sol Pro","created":1783590854},
          {"id":"openai/gpt-5.6-sol","name":"GPT-5.6 Sol","created":1783590850},
          {"id":"openai/gpt-chat-latest","name":"GPT Chat Latest","created":1778000212},
          {"id":"openai/gpt-5.5-pro","name":"GPT-5.5 Pro","created":1777051896},
          {"id":"openai/gpt-5.5","name":"GPT-5.5","created":1777051893},
          {"id":"openai/gpt-5.4-nano","name":"GPT-5.4 Nano","created":1773748187},
          {"id":"openai/gpt-5.4-mini","name":"GPT-5.4 Mini","created":1773748178},
          {"id":"openai/gpt-5.4-pro","name":"GPT-5.4 Pro","created":1772734366},
          {"id":"openai/gpt-5.4","name":"GPT-5.4","created":1772734352},
          {"id":"openai/gpt-5.3-codex","name":"GPT-5.3-Codex","created":1771959164},
          {"id":"openai/gpt-5.2-codex","name":"GPT-5.2-Codex","created":1768409315},
          {"id":"openai/gpt-5.2-chat","name":"GPT-5.2 Chat","created":1765389783},
          {"id":"openai/gpt-5.2-pro","name":"GPT-5.2 Pro","created":1765389780},
          {"id":"openai/gpt-5.2","name":"GPT-5.2","created":1765389775},
          {"id":"openai/gpt-5.1-codex-max","name":"GPT-5.1-Codex-Max","created":1764878934},
          {"id":"openai/gpt-5.1","name":"GPT-5.1","created":1763060305},
          {"id":"openai/gpt-5.1-codex","name":"GPT-5.1-Codex","created":1763060298},
          {"id":"openai/gpt-5.1-codex-mini","name":"GPT-5.1-Codex-Mini","created":1763057820},
          {"id":"openai/gpt-oss-safeguard-20b","name":"gpt-oss-safeguard-20b","created":1761752836},
          {"id":"openai/gpt-5-pro","name":"GPT-5 Pro","created":1759776663},
          {"id":"openai/gpt-5","name":"GPT-5","created":1754587413},
          {"id":"openai/gpt-5-mini","name":"GPT-5 Mini","created":1754587407},
          {"id":"openai/gpt-5-nano","name":"GPT-5 Nano","created":1754587402},
          {"id":"openai/gpt-oss-120b","name":"gpt-oss-120b","created":1754414231},
          {"id":"openai/gpt-oss-20b","name":"gpt-oss-20b","created":1754414229},
          {"id":"openai/o3-pro","name":"o3 Pro","created":1749598352},
          {"id":"openai/o4-mini-high","name":"o4 Mini High","created":1744824212},
          {"id":"openai/o3","name":"o3","created":1744823457},
          {"id":"openai/o4-mini","name":"o4 Mini","created":1744820942},
          {"id":"openai/gpt-4.1","name":"GPT-4.1","created":1744651385},
          {"id":"openai/gpt-4.1-mini","name":"GPT-4.1 Mini","created":1744651381},
          {"id":"openai/gpt-4.1-nano","name":"GPT-4.1 Nano","created":1744651369},
          {"id":"openai/o1-pro","name":"o1-pro","created":1742423211},
          {"id":"openai/o3-mini-high","name":"o3 Mini High","created":1739372611},
          {"id":"openai/o3-mini","name":"o3 Mini","created":1738351721},
          {"id":"openai/o1","name":"o1","created":1734459999},
          {"id":"openai/gpt-4o-2024-11-20","name":"GPT-4o (2024-11-20)","created":1732127594},
          {"id":"openai/gpt-4o-2024-08-06","name":"GPT-4o (2024-08-06)","created":1722902400},
          {"id":"openai/gpt-4o-mini","name":"GPT-4o-mini","created":1721260800},
          {"id":"openai/gpt-4o-mini-2024-07-18","name":"GPT-4o-mini (2024-07-18)","created":1721260800},
          {"id":"openai/gpt-4o","name":"GPT-4o","created":1715558400},
          {"id":"openai/gpt-4o-2024-05-13","name":"GPT-4o (2024-05-13)","created":1715558400},
          {"id":"openai/gpt-4-turbo","name":"GPT-4 Turbo","created":1712620800},
          {"id":"openai/gpt-3.5-turbo-0613","name":"GPT-3.5 Turbo (older v0613)","created":1706140800},
          {"id":"openai/gpt-3.5-turbo-instruct","name":"GPT-3.5 Turbo Instruct","created":1695859200},
          {"id":"openai/gpt-3.5-turbo-16k","name":"GPT-3.5 Turbo 16k","created":1693180800},
          {"id":"openai/gpt-3.5-turbo","name":"GPT-3.5 Turbo","created":1685232000},
          {"id":"openai/gpt-4","name":"GPT-4","created":1685232000}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "deepseek",
        "name": "DeepSeek",
        "prefix": "deepseek",
        "docs": "https://api-docs.deepseek.com/quick_start/pricing-details-cny/",
        "models": [
          {"id":"deepseek/deepseek-v4.1-flash","name":"DeepSeek V4.1 Flash","created":1789021285},
          {"id":"deepseek/deepseek-v4-flash-vision-exp","name":"DeepSeek V4 Flash Vision Exp","created":1787311563},
          {"id":"deepseek/deepseek-v4-pro-0813","name":"DeepSeek V4 Pro 0813","created":1786549364},
          {"id":"deepseek/deepseek-v4-flash-0731","name":"DeepSeek V4 Flash 0731","created":1785478908},
          {"id":"deepseek/deepseek-v4-pro","name":"DeepSeek V4 Pro 0423","created":1777000679},
          {"id":"deepseek/deepseek-v4-flash","name":"DeepSeek V4 Flash 0423","created":1777000666},
          {"id":"deepseek/deepseek-v3.2","name":"DeepSeek V3.2","created":1764594642},
          {"id":"deepseek/deepseek-v3.2-exp","name":"DeepSeek V3.2 Exp","created":1759150481},
          {"id":"deepseek/deepseek-v3.1-terminus","name":"DeepSeek V3.1 Terminus","created":1758548275},
          {"id":"deepseek/deepseek-chat-v3.1","name":"DeepSeek V3.1","created":1755779628},
          {"id":"deepseek/deepseek-r1-0528","name":"R1 0528","created":1748455170},
          {"id":"deepseek/deepseek-chat-v3-0324","name":"DeepSeek V3 0324","created":1742824755},
          {"id":"deepseek/deepseek-r1","name":"R1","created":1737381095},
          {"id":"deepseek/deepseek-chat","name":"DeepSeek V3","created":1735241320}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "anthropic",
        "name": "Anthropic · Claude",
        "prefix": "anthropic",
        "docs": "https://platform.claude.com/docs/en/models/overview",
        "models": [
          {"id":"anthropic/claude-haiku-5.5","name":"Claude Haiku 5.5","created":1791397883},
          {"id":"anthropic/claude-sonnet-5.5","name":"Claude Sonnet 5.5","created":1790618686},
          {"id":"anthropic/claude-opus-5.5","name":"Claude Opus 5.5","created":1790094732},
          {"id":"anthropic/claude-fable-5.1","name":"Claude Fable 5.1","created":1788285838},
          {"id":"anthropic/claude-opus-5","name":"Claude Opus 5","created":1784912544},
          {"id":"anthropic/claude-sonnet-5","name":"Claude Sonnet 5","created":1782843083},
          {"id":"anthropic/claude-fable-5","name":"Claude Fable 5","created":1781007515},
          {"id":"anthropic/claude-opus-4.8","name":"Claude Opus 4.8","created":1779905091},
          {"id":"anthropic/claude-opus-4.7","name":"Claude Opus 4.7","created":1776351100},
          {"id":"anthropic/claude-sonnet-4.6","name":"Claude Sonnet 4.6","created":1771342990},
          {"id":"anthropic/claude-opus-4.6","name":"Claude Opus 4.6","created":1770219050},
          {"id":"anthropic/claude-opus-4.5","name":"Claude Opus 4.5","created":1764010580},
          {"id":"anthropic/claude-haiku-4.5","name":"Claude Haiku 4.5","created":1760547638},
          {"id":"anthropic/claude-sonnet-4.5","name":"Claude Sonnet 4.5","created":1759161676},
          {"id":"anthropic/claude-opus-4.1","name":"Claude Opus 4.1","created":1754411591},
          {"id":"anthropic/claude-sonnet-4","name":"Claude Sonnet 4","created":1747930371}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "google",
        "name": "Google · Gemini",
        "prefix": "google",
        "docs": "https://ai.google.dev/gemini-api/docs/models",
        "models": [
          {"id":"google/gemini-3.8-flash","name":"Gemini 3.8 Flash","created":1788362056},
          {"id":"google/gemini-3.7-flash","name":"Gemini 3.7 Flash","created":1786640581},
          {"id":"google/gemini-3.6-flash","name":"Gemini 3.6 Flash","created":1784646733},
          {"id":"google/gemini-3.5-flash-lite","name":"Gemini 3.5 Flash Lite","created":1784646726},
          {"id":"google/gemini-3.5-flash","name":"Gemini 3.5 Flash","created":1779193800},
          {"id":"google/gemini-3.1-flash-lite","name":"Gemini 3.1 Flash Lite","created":1778168828},
          {"id":"google/gemma-4-26b-a4b-it","name":"Gemma 4 26B A4B ","created":1775227989},
          {"id":"google/gemma-4-31b-it","name":"Gemma 4 31B","created":1775148486},
          {"id":"google/gemini-3.1-flash-lite-preview","name":"Gemini 3.1 Flash Lite Preview","created":1772512673},
          {"id":"google/gemini-3.1-pro-preview-customtools","name":"Gemini 3.1 Pro Preview Custom Tools","created":1772045923},
          {"id":"google/gemini-3.1-pro-preview","name":"Gemini 3.1 Pro Preview","created":1771509627},
          {"id":"google/gemini-3-flash-preview","name":"Gemini 3 Flash Preview","created":1765987078},
          {"id":"google/gemini-2.5-flash-lite","name":"Gemini 2.5 Flash Lite","created":1753200276},
          {"id":"google/gemini-2.5-flash","name":"Gemini 2.5 Flash","created":1750172488},
          {"id":"google/gemini-2.5-pro","name":"Gemini 2.5 Pro","created":1750169544},
          {"id":"google/gemini-2.5-pro-preview","name":"Gemini 2.5 Pro Preview 06-05","created":1749137257},
          {"id":"google/gemma-3-4b-it","name":"Gemma 3 4B","created":1741905510},
          {"id":"google/gemma-3-12b-it","name":"Gemma 3 12B","created":1741902625},
          {"id":"google/gemma-3-27b-it","name":"Gemma 3 27B","created":1741756359},
          {"id":"google/gemma-2-27b-it","name":"Gemma 2 27B","created":1720828800}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "qwen",
        "name": "阿里千问 · Qwen",
        "prefix": "qwen",
        "docs": "https://help.aliyun.com/zh/model-studio/models",
        "models": [
          {"id":"qwen/qwen3.8-max-prime","name":"Qwen3.8 Max Prime","created":1790191228},
          {"id":"qwen/qwen3.8-omni-flash","name":"Qwen3.8 Omni Flash","created":1789959954},
          {"id":"qwen/qwen3.8-max-0902","name":"Qwen3.8 Max (0902)","created":1788469704},
          {"id":"qwen/qwen3.8-flash","name":"Qwen3.8 Flash","created":1787773060},
          {"id":"qwen/qwen3.8-27b","name":"Qwen3.8 27B","created":1786722910},
          {"id":"qwen/qwen3.8-2.4t-a95b","name":"Qwen3.8 2.4T A95B","created":1786551702},
          {"id":"qwen/qwen3.7-flash","name":"Qwen3.7 Flash","created":1785190561},
          {"id":"qwen/qwen3.7-plus","name":"Qwen3.7 Plus","created":1780491783},
          {"id":"qwen/qwen3.7-max","name":"Qwen3.7 Max","created":1779376861},
          {"id":"qwen/qwen3.5-plus-20260420","name":"Qwen3.5 Plus 2026-04-20","created":1777261368},
          {"id":"qwen/qwen3.6-flash","name":"Qwen3.6 Flash","created":1777261362},
          {"id":"qwen/qwen3.6-35b-a3b","name":"Qwen3.6 35B A3B","created":1777260255},
          {"id":"qwen/qwen3.6-27b","name":"Qwen3.6 27B","created":1777255064},
          {"id":"qwen/qwen3.6-plus","name":"Qwen3.6 Plus","created":1775133557},
          {"id":"qwen/qwen3.5-9b","name":"Qwen3.5-9B","created":1773152396},
          {"id":"qwen/qwen3.5-35b-a3b","name":"Qwen3.5-35B-A3B","created":1772053822},
          {"id":"qwen/qwen3.5-27b","name":"Qwen3.5-27B","created":1772053810},
          {"id":"qwen/qwen3.5-122b-a10b","name":"Qwen3.5-122B-A10B","created":1772053789},
          {"id":"qwen/qwen3.5-flash-02-23","name":"Qwen3.5-Flash","created":1772053776},
          {"id":"qwen/qwen3.5-plus-02-15","name":"Qwen3.5 Plus 2026-02-15","created":1771229416},
          {"id":"qwen/qwen3.5-397b-a17b","name":"Qwen3.5 397B A17B","created":1771223018},
          {"id":"qwen/qwen3-coder-next","name":"Qwen3 Coder Next","created":1770164101},
          {"id":"qwen/qwen3-vl-8b-instruct","name":"Qwen3 VL 8B Instruct","created":1760463308},
          {"id":"qwen/qwen3-vl-30b-a3b-thinking","name":"Qwen3 VL 30B A3B Thinking","created":1759794479},
          {"id":"qwen/qwen3-vl-30b-a3b-instruct","name":"Qwen3 VL 30B A3B Instruct","created":1759794476},
          {"id":"qwen/qwen3-vl-235b-a22b-instruct","name":"Qwen3 VL 235B A22B Instruct","created":1758668687},
          {"id":"qwen/qwen3-coder-flash","name":"Qwen3 Coder Flash","created":1758115536},
          {"id":"qwen/qwen3-next-80b-a3b-thinking","name":"Qwen3 Next 80B A3B Thinking","created":1757612284},
          {"id":"qwen/qwen3-next-80b-a3b-instruct","name":"Qwen3 Next 80B A3B Instruct","created":1757612213},
          {"id":"qwen/qwen3-coder-30b-a3b-instruct","name":"Qwen3 Coder 30B A3B Instruct","created":1753972379},
          {"id":"qwen/qwen3-30b-a3b-instruct-2507","name":"Qwen3 30B A3B Instruct 2507","created":1753806965},
          {"id":"qwen/qwen3-235b-a22b-thinking-2507","name":"Qwen3 235B A22B Thinking 2507","created":1753449557},
          {"id":"qwen/qwen3-coder","name":"Qwen3 Coder 480B A35B","created":1753230546},
          {"id":"qwen/qwen3-235b-a22b-2507","name":"Qwen3 235B A22B Instruct 2507","created":1753119555},
          {"id":"qwen/qwen3-30b-a3b","name":"Qwen3 30B A3B","created":1745878604},
          {"id":"qwen/qwen3-14b","name":"Qwen3 14B","created":1745876478},
          {"id":"qwen/qwen3-32b","name":"Qwen3 32B","created":1745875945},
          {"id":"qwen/qwen2.5-vl-72b-instruct","name":"Qwen2.5 VL 72B Instruct","created":1738410311},
          {"id":"qwen/qwen-plus","name":"Qwen-Plus","created":1738409840},
          {"id":"qwen/qwen-2.5-coder-32b-instruct","name":"Qwen2.5 Coder 32B Instruct","created":1731368400},
          {"id":"qwen/qwen-2.5-7b-instruct","name":"Qwen2.5 7B Instruct","created":1729036800},
          {"id":"qwen/qwen-2.5-72b-instruct","name":"Qwen2.5 72B Instruct","created":1726704000}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "moonshot",
        "name": "月之暗面 · Kimi",
        "prefix": "moonshotai",
        "docs": "https://platform.moonshot.cn/docs",
        "models": [
          {"id":"moonshotai/kimi-k3","name":"Kimi K3","created":1784215858},
          {"id":"moonshotai/kimi-k2.7-code","name":"Kimi K2.7 Code","created":1781266361},
          {"id":"moonshotai/kimi-k2.6","name":"Kimi K2.6","created":1776699402},
          {"id":"moonshotai/kimi-k2.5","name":"Kimi K2.5","created":1769487076},
          {"id":"moonshotai/kimi-k2-thinking","name":"Kimi K2 Thinking","created":1762440622},
          {"id":"moonshotai/kimi-k2-0905","name":"Kimi K2 0905","created":1757021147},
          {"id":"moonshotai/kimi-k2","name":"Kimi K2 0711","created":1752263252}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "zai",
        "name": "智谱 · GLM",
        "prefix": "z-ai",
        "docs": "https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3",
        "models": [
          {"id":"z-ai/glm-5.3-prime","name":"GLM 5.3 Prime","created":1790199651},
          {"id":"z-ai/glm-5.3-flashx","name":"GLM 5.3 FlashX","created":1789744020},
          {"id":"z-ai/glm-5.3-flash","name":"GLM 5.3 Flash","created":1787752741},
          {"id":"z-ai/glm-5.3","name":"GLM 5.3","created":1787086655},
          {"id":"z-ai/glm-5.2","name":"GLM 5.2","created":1781631930},
          {"id":"z-ai/glm-5.1","name":"GLM 5.1","created":1775578025},
          {"id":"z-ai/glm-5v-turbo","name":"GLM 5V Turbo","created":1775061458},
          {"id":"z-ai/glm-5-turbo","name":"GLM 5 Turbo","created":1773583573},
          {"id":"z-ai/glm-5","name":"GLM 5","created":1770829182},
          {"id":"z-ai/glm-4.7-flash","name":"GLM 4.7 Flash","created":1768833913},
          {"id":"z-ai/glm-4.7","name":"GLM 4.7","created":1766378014},
          {"id":"z-ai/glm-4.6v","name":"GLM 4.6V","created":1765207462},
          {"id":"z-ai/glm-4.6","name":"GLM 4.6","created":1759235576},
          {"id":"z-ai/glm-4.5v","name":"GLM 4.5V","created":1754922288},
          {"id":"z-ai/glm-4.5","name":"GLM 4.5","created":1753471347},
          {"id":"z-ai/glm-4.5-air","name":"GLM 4.5 Air","created":1753471258}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "minimax",
        "name": "MiniMax",
        "prefix": "minimax",
        "docs": "https://platform.minimax.io/docs/guides/models-intro",
        "models": [
          {"id":"minimax/minimax-m3","name":"MiniMax M3","created":1780245374},
          {"id":"minimax/minimax-m2.7","name":"MiniMax M2.7","created":1773836697},
          {"id":"minimax/minimax-m2.5","name":"MiniMax M2.5","created":1770908502},
          {"id":"minimax/minimax-m2-her","name":"MiniMax M2-her","created":1769177239},
          {"id":"minimax/minimax-m2.1","name":"MiniMax M2.1","created":1766454997},
          {"id":"minimax/minimax-m2","name":"MiniMax M2","created":1761252093},
          {"id":"minimax/minimax-m1","name":"MiniMax M1","created":1750200414},
          {"id":"minimax/minimax-01","name":"MiniMax-01","created":1736915462}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "xai",
        "name": "xAI · Grok",
        "prefix": "x-ai",
        "docs": "https://docs.x.ai/developers/models",
        "models": [
          {"id":"x-ai/grok-4.7","name":"Grok 4.7","created":1790007541},
          {"id":"x-ai/grok-4.6","name":"Grok 4.6","created":1786548957},
          {"id":"x-ai/grok-4.5","name":"Grok 4.5","created":1783523154},
          {"id":"x-ai/grok-build-0.1","name":"Grok Build 0.1","created":1779298123},
          {"id":"x-ai/grok-4.3","name":"Grok 4.3","created":1777591821},
          {"id":"x-ai/grok-4.20-multi-agent","name":"Grok 4.20 Multi-Agent","created":1774979158},
          {"id":"x-ai/grok-4.20","name":"Grok 4.20","created":1774979019}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      },
      {
        "id": "mistral",
        "name": "Mistral AI",
        "prefix": "mistralai",
        "docs": "https://docs.mistral.ai/models",
        "models": [
          {"id":"mistralai/mistral-large-4-0","name":"Mistral Large 4","created":1791294122},
          {"id":"mistralai/mistral-medium-3-5","name":"Mistral Medium 3.5","created":1777570439},
          {"id":"mistralai/mistral-small-2603","name":"Mistral Small 4","created":1773695685},
          {"id":"mistralai/devstral-2512","name":"Devstral 2 2512","created":1765285419},
          {"id":"mistralai/ministral-14b-2512","name":"Ministral 3 14B 2512","created":1764681735},
          {"id":"mistralai/ministral-8b-2512","name":"Ministral 3 8B 2512","created":1764681654},
          {"id":"mistralai/ministral-3b-2512","name":"Ministral 3 3B 2512","created":1764681560},
          {"id":"mistralai/mistral-large-2512","name":"Mistral Large 3 2512","created":1764624472},
          {"id":"mistralai/voxtral-small-24b-2507","name":"Voxtral Small 24B 2507","created":1761835144},
          {"id":"mistralai/mistral-medium-3.1","name":"Mistral Medium 3.1","created":1755095639},
          {"id":"mistralai/codestral-2508","name":"Codestral 2508","created":1754079630},
          {"id":"mistralai/mistral-small-3.2-24b-instruct","name":"Mistral Small 3.2 24B","created":1750443016},
          {"id":"mistralai/mistral-medium-3","name":"Mistral Medium 3","created":1746627341},
          {"id":"mistralai/mistral-small-3.1-24b-instruct","name":"Mistral Small 3.1 24B","created":1742238937},
          {"id":"mistralai/mistral-saba","name":"Saba","created":1739803239},
          {"id":"mistralai/mistral-small-24b-instruct-2501","name":"Mistral Small 3","created":1738255409},
          {"id":"mistralai/mistral-large-2407","name":"Mistral Large 2407","created":1731978415},
          {"id":"mistralai/mistral-nemo","name":"Mistral Nemo","created":1721347200},
          {"id":"mistralai/mixtral-8x22b-instruct","name":"Mixtral 8x22B Instruct","created":1713312000},
          {"id":"mistralai/mistral-large","name":"Mistral Large","created":1708905600}
        ],
        "updatedAt": "2026-10-10T13:18:30.375Z",
        "stale": false
      }
    ]
  };

  const SOURCE = 'https://openrouter.ai/api/v1/models';
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
      ['xai', /grok/], ['mistral', /mistral|ministral|mixtral|codestral|devstral|magistral|voxtral/] ];
    return rules.find(([, regex]) => regex.test(lower))?.[0] || 'custom';
  }
  function normalizeSnapshot(value) {
    if (!value || value.source !== SOURCE || !Number.isFinite(Date.parse(value.updatedAt))) return BUILTIN;
    const providers = BUILTIN.providers.map(base => {
      const incoming = Array.isArray(value.providers) ? value.providers.find(p => p.id === base.id) : null;
      const models = (Array.isArray(incoming?.models) ? incoming.models : [])
        .filter(m => m && typeof m.id === 'string' && m.id.startsWith(base.prefix + '/') && m.id.length <= 200 &&
          !/[\s:]/.test(m.id) && typeof m.name === 'string' && m.name.length <= 200 &&
          Number.isFinite(m.created) && m.created > 0 && m.created * 1000 <= Date.now() + 86400000)
        .filter((m, index, list) => list.findIndex(item => item.id === m.id) === index)
        .map(m => ({ id: m.id, name: m.name, created: m.created }));
      return models.length ? { ...base, models, updatedAt: incoming.updatedAt || value.updatedAt, stale: incoming.stale === true } : { ...base, updatedAt: BUILTIN.updatedAt, stale: true };
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
  function interfaceModels(items, provider = 'custom') {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => {
      const id = item?.id;
      if (typeof id !== 'string' || !id.trim() || id.length > 200 || /\s/.test(id) || seen.has(id)) return false;
      const input = item.input_modalities || item.architecture?.input_modalities;
      const output = item.output_modalities || item.architecture?.output_modalities;
      if ((Array.isArray(input) && !input.includes('text')) ||
          (Array.isArray(output) && (output.length !== 1 || output[0] !== 'text'))) return false;
      // Voxtral 还包含语音型号；仅在接口明确确认文本输入/输出时开放。
      if (/voxtral/i.test(id) && (!Array.isArray(input) || !input.includes('text') ||
          !Array.isArray(output) || !output.includes('text'))) return false;
      if (item.expiration_date && Date.parse(item.expiration_date) <= Date.now()) return false;
      if (/(?:embed|rerank|whisper|tts|dall-e|image|moderation|sora|realtime|transcri|audio)/i.test(id)) return false;
      const family = id.replace(/^ft:/, '').replace(/^models\//, '');
      if (provider !== 'custom' && providerFor(family) !== provider) return false;
      seen.add(id); return true;
    }).map(item => ({ id: item.id, name: typeof item.name === 'string' && item.name.length <= 200 ? item.name : item.id,
      // 重复过滤/缓存归一化仍需保留 Voxtral 的已确认文本能力。
      ...(/voxtral/i.test(item.id) ? {input_modalities:['text'],output_modalities:['text']} : {}) }));
  }
  // 后台与设置页共用账号模型查询；只返回固定错误信息，不回显服务端正文或凭据。
  async function fetchInterface(connection) {
    let baseUrl;
    try { baseUrl = AIConfig.normalizeBaseUrl(connection?.apiBaseUrl); }
    catch { return {ok:false,code:'address',error:'接口地址无效，请检查配置。'}; }
    const apiKey = String(connection?.apiKey || '').trim();
    if (!apiKey) return {ok:false,code:'key_missing',error:'请先填写 API Key。'};
    const signal = AbortSignal.timeout(20000);
    for (let attempt=0; attempt<2; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/models`, {
          headers:{Authorization:`Bearer ${apiKey}`}, cache:'no-store', signal
        });
        if (!res.ok) {
          if (res.status>=500 && attempt===0) {
            await new Promise(resolve=>setTimeout(resolve,300)); continue;
          }
          const code = ({401:'key_invalid',402:'balance',403:'forbidden',404:'unsupported',429:'rate_limit'})[res.status] || 'service';
          return {ok:false,code,status:res.status,error:`模型接口请求失败 (${res.status})`};
        }
        let payload;
        try { payload = await res.json(); }
        catch (err) {
          if (signal.aborted) throw err;
          return {ok:false,code:'format',error:'模型接口未返回有效 JSON。'};
        }
        if (!Array.isArray(payload?.data)) return {ok:false,code:'format',error:'模型列表格式不兼容：需要 data 数组'};
        return {ok:true,models:AIConfig.normalizeModels(payload.data.map(item=>item?.id)).sort(),
          entries:interfaceModels(payload.data)};
      } catch (err) {
        if (signal.aborted || err.name==='TimeoutError' || err.name==='AbortError') {
          return {ok:false,code:'timeout',error:'获取模型列表超时。'};
        }
        if (attempt===0) { await new Promise(resolve=>setTimeout(resolve,300)); continue; }
        return {ok:false,code:'network',error:'无法连接模型接口，请检查网络。'};
      }
    }
  }
  async function refresh(previous = BUILTIN) {
    let res;
    try {
      res = await fetch(SOURCE, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error('公开模型目录请求超时（20 秒），请检查网络后重试');
      }
      throw new Error(`无法连接公开模型目录 openrouter.ai，请检查网络或代理（${err.message || '网络请求失败'}）`);
    }
    if (!res.ok) throw new Error(`公开模型目录请求失败 (${res.status})`);
    let payload;
    try { payload = await res.json(); }
    catch { throw new Error('公开模型目录未返回有效 JSON，请检查网络或代理响应'); }
    if (!Array.isArray(payload?.data)) throw new Error('公开模型目录格式无效，保留已保存列表');
    const timestamp = new Date().toISOString();
    const existing = normalizeSnapshot(previous);
    let updated = 0;
    const providers = existing.providers.map(provider => {
      const selected = payload.data.filter(m => m && typeof m.id === 'string' && m.id.startsWith(provider.prefix + '/') &&
        !/[\s:]/.test(m.id) && m.id.length <= 200 && typeof m.name === 'string' &&
        m.name.length <= 200 && Number.isFinite(m.created) && m.created > 0 &&
        m.created * 1000 <= Date.now() + 86400000 &&
        m.architecture?.input_modalities?.includes('text') &&
        m.architecture?.output_modalities?.length === 1 && m.architecture.output_modalities[0] === 'text' &&
        (!m.expiration_date || Date.parse(m.expiration_date) > Date.now()))
        .sort((a,b) => b.created - a.created || a.id.localeCompare(b.id))
        .filter((m, index, list) => list.findIndex(item => item.id === m.id) === index)
        .map(m => ({ id: m.id, name: m.name.replace(/^[^:]+:\s*/, ''), created: m.created }));
      if (!selected.length) return { ...provider, stale: true };
      updated++;
      return { ...provider, models: selected, updatedAt: timestamp, stale: false };
    });
    if (!updated) throw new Error('目录没有提供可用的文本模型，保留已保存列表');
    return { updatedAt: timestamp, source: SOURCE, providers };
  }
  globalThis.AIModelCatalog = { BUILTIN, SOURCE, COMPATIBILITY, nativeId,
    providerFor, normalizeSnapshot, resolveId, allModels, interfaceModels, fetchInterface, refresh };
})();

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 模型目录：保存厂家和型号资料，刷新公开目录，查询账号实际开放的型号。
// config.js 使用目录整理旧配置；popup.js / background.js 查询和过滤接口型号。
// 内置目录是保存时的资料，created 是目录上架时间；资料中有型号不代表账号能调用它。
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
// 第 4 行：保存内置厂家型号快照；它是预置资料，不代表当前账号开放权限。
// 第 5 行：记录这份内置资料的更新时间。
// 第 6 行：记录公开资料的来源地址。
// 第 7 行：开始保存厂家列表。
// 第 8 行：继续填写 providers 的内容：含 10 项的列表。
// 第 9 行：id 字段设为 “openai”。
// 第 10 行：name 字段设为 “OpenAI”。
// 第 11 行：prefix 字段设为 “openai”。
// 第 12 行：docs 字段设为 “https://developers.openai.com/api/docs/models”。
// 第 13 行：models 字段设为 含 60 项的列表。
// 第 14 行：记录型号 openai/gpt-6.1-sol-pro：显示名“GPT-6.1 Sol Pro”，目录上架时间戳 1790702886（秒）；这是资料，不是生成请求。
// 第 15 行：记录型号 openai/gpt-6.1-sol：显示名“GPT-6.1 Sol”，目录上架时间戳 1790702882（秒）；这是资料，不是生成请求。
// 第 16 行：记录型号 openai/gpt-6-luna-pro：显示名“GPT-6 Luna Pro”，目录上架时间戳 1790100791（秒）；这是资料，不是生成请求。
// 第 17 行：记录型号 openai/gpt-6-luna：显示名“GPT-6 Luna”，目录上架时间戳 1790100786（秒）；这是资料，不是生成请求。
// 第 18 行：记录型号 openai/gpt-6-sol-pro：显示名“GPT-6 Sol Pro”，目录上架时间戳 1790100781（秒）；这是资料，不是生成请求。
// 第 19 行：记录型号 openai/gpt-6-sol：显示名“GPT-6 Sol”，目录上架时间戳 1790100775（秒）；这是资料，不是生成请求。
// 第 20 行：记录型号 openai/gpt-6-astra：显示名“GPT-6 Astra”，目录上架时间戳 1788552838（秒）；这是资料，不是生成请求。
// 第 21 行：记录型号 openai/gpt-6-astra-pro：显示名“GPT-6 Astra Pro”，目录上架时间戳 1788552835（秒）；这是资料，不是生成请求。
// 第 22 行：记录型号 openai/gpt-5.6-luna-pro：显示名“GPT-5.6 Luna Pro”，目录上架时间戳 1783590867（秒）；这是资料，不是生成请求。
// 第 23 行：记录型号 openai/gpt-5.6-luna：显示名“GPT-5.6 Luna”，目录上架时间戳 1783590864（秒）；这是资料，不是生成请求。
// 第 24 行：记录型号 openai/gpt-5.6-terra-pro：显示名“GPT-5.6 Terra Pro”，目录上架时间戳 1783590861（秒）；这是资料，不是生成请求。
// 第 25 行：记录型号 openai/gpt-5.6-terra：显示名“GPT-5.6 Terra”，目录上架时间戳 1783590857（秒）；这是资料，不是生成请求。
// 第 26 行：记录型号 openai/gpt-5.6-sol-pro：显示名“GPT-5.6 Sol Pro”，目录上架时间戳 1783590854（秒）；这是资料，不是生成请求。
// 第 27 行：记录型号 openai/gpt-5.6-sol：显示名“GPT-5.6 Sol”，目录上架时间戳 1783590850（秒）；这是资料，不是生成请求。
// 第 28 行：记录型号 openai/gpt-chat-latest：显示名“GPT Chat Latest”，目录上架时间戳 1778000212（秒）；这是资料，不是生成请求。
// 第 29 行：记录型号 openai/gpt-5.5-pro：显示名“GPT-5.5 Pro”，目录上架时间戳 1777051896（秒）；这是资料，不是生成请求。
// 第 30 行：记录型号 openai/gpt-5.5：显示名“GPT-5.5”，目录上架时间戳 1777051893（秒）；这是资料，不是生成请求。
// 第 31 行：记录型号 openai/gpt-5.4-nano：显示名“GPT-5.4 Nano”，目录上架时间戳 1773748187（秒）；这是资料，不是生成请求。
// 第 32 行：记录型号 openai/gpt-5.4-mini：显示名“GPT-5.4 Mini”，目录上架时间戳 1773748178（秒）；这是资料，不是生成请求。
// 第 33 行：记录型号 openai/gpt-5.4-pro：显示名“GPT-5.4 Pro”，目录上架时间戳 1772734366（秒）；这是资料，不是生成请求。
// 第 34 行：记录型号 openai/gpt-5.4：显示名“GPT-5.4”，目录上架时间戳 1772734352（秒）；这是资料，不是生成请求。
// 第 35 行：记录型号 openai/gpt-5.3-codex：显示名“GPT-5.3-Codex”，目录上架时间戳 1771959164（秒）；这是资料，不是生成请求。
// 第 36 行：记录型号 openai/gpt-5.2-codex：显示名“GPT-5.2-Codex”，目录上架时间戳 1768409315（秒）；这是资料，不是生成请求。
// 第 37 行：记录型号 openai/gpt-5.2-chat：显示名“GPT-5.2 Chat”，目录上架时间戳 1765389783（秒）；这是资料，不是生成请求。
// 第 38 行：记录型号 openai/gpt-5.2-pro：显示名“GPT-5.2 Pro”，目录上架时间戳 1765389780（秒）；这是资料，不是生成请求。
// 第 39 行：记录型号 openai/gpt-5.2：显示名“GPT-5.2”，目录上架时间戳 1765389775（秒）；这是资料，不是生成请求。
// 第 40 行：记录型号 openai/gpt-5.1-codex-max：显示名“GPT-5.1-Codex-Max”，目录上架时间戳 1764878934（秒）；这是资料，不是生成请求。
// 第 41 行：记录型号 openai/gpt-5.1：显示名“GPT-5.1”，目录上架时间戳 1763060305（秒）；这是资料，不是生成请求。
// 第 42 行：记录型号 openai/gpt-5.1-codex：显示名“GPT-5.1-Codex”，目录上架时间戳 1763060298（秒）；这是资料，不是生成请求。
// 第 43 行：记录型号 openai/gpt-5.1-codex-mini：显示名“GPT-5.1-Codex-Mini”，目录上架时间戳 1763057820（秒）；这是资料，不是生成请求。
// 第 44 行：记录型号 openai/gpt-oss-safeguard-20b：显示名“gpt-oss-safeguard-20b”，目录上架时间戳 1761752836（秒）；这是资料，不是生成请求。
// 第 45 行：记录型号 openai/gpt-5-pro：显示名“GPT-5 Pro”，目录上架时间戳 1759776663（秒）；这是资料，不是生成请求。
// 第 46 行：记录型号 openai/gpt-5：显示名“GPT-5”，目录上架时间戳 1754587413（秒）；这是资料，不是生成请求。
// 第 47 行：记录型号 openai/gpt-5-mini：显示名“GPT-5 Mini”，目录上架时间戳 1754587407（秒）；这是资料，不是生成请求。
// 第 48 行：记录型号 openai/gpt-5-nano：显示名“GPT-5 Nano”，目录上架时间戳 1754587402（秒）；这是资料，不是生成请求。
// 第 49 行：记录型号 openai/gpt-oss-120b：显示名“gpt-oss-120b”，目录上架时间戳 1754414231（秒）；这是资料，不是生成请求。
// 第 50 行：记录型号 openai/gpt-oss-20b：显示名“gpt-oss-20b”，目录上架时间戳 1754414229（秒）；这是资料，不是生成请求。
// 第 51 行：记录型号 openai/o3-pro：显示名“o3 Pro”，目录上架时间戳 1749598352（秒）；这是资料，不是生成请求。
// 第 52 行：记录型号 openai/o4-mini-high：显示名“o4 Mini High”，目录上架时间戳 1744824212（秒）；这是资料，不是生成请求。
// 第 53 行：记录型号 openai/o3：显示名“o3”，目录上架时间戳 1744823457（秒）；这是资料，不是生成请求。
// 第 54 行：记录型号 openai/o4-mini：显示名“o4 Mini”，目录上架时间戳 1744820942（秒）；这是资料，不是生成请求。
// 第 55 行：记录型号 openai/gpt-4.1：显示名“GPT-4.1”，目录上架时间戳 1744651385（秒）；这是资料，不是生成请求。
// 第 56 行：记录型号 openai/gpt-4.1-mini：显示名“GPT-4.1 Mini”，目录上架时间戳 1744651381（秒）；这是资料，不是生成请求。
// 第 57 行：记录型号 openai/gpt-4.1-nano：显示名“GPT-4.1 Nano”，目录上架时间戳 1744651369（秒）；这是资料，不是生成请求。
// 第 58 行：记录型号 openai/o1-pro：显示名“o1-pro”，目录上架时间戳 1742423211（秒）；这是资料，不是生成请求。
// 第 59 行：记录型号 openai/o3-mini-high：显示名“o3 Mini High”，目录上架时间戳 1739372611（秒）；这是资料，不是生成请求。
// 第 60 行：记录型号 openai/o3-mini：显示名“o3 Mini”，目录上架时间戳 1738351721（秒）；这是资料，不是生成请求。
// 第 61 行：记录型号 openai/o1：显示名“o1”，目录上架时间戳 1734459999（秒）；这是资料，不是生成请求。
// 第 62 行：记录型号 openai/gpt-4o-2024-11-20：显示名“GPT-4o (2024-11-20)”，目录上架时间戳 1732127594（秒）；这是资料，不是生成请求。
// 第 63 行：记录型号 openai/gpt-4o-2024-08-06：显示名“GPT-4o (2024-08-06)”，目录上架时间戳 1722902400（秒）；这是资料，不是生成请求。
// 第 64 行：记录型号 openai/gpt-4o-mini：显示名“GPT-4o-mini”，目录上架时间戳 1721260800（秒）；这是资料，不是生成请求。
// 第 65 行：记录型号 openai/gpt-4o-mini-2024-07-18：显示名“GPT-4o-mini (2024-07-18)”，目录上架时间戳 1721260800（秒）；这是资料，不是生成请求。
// 第 66 行：记录型号 openai/gpt-4o：显示名“GPT-4o”，目录上架时间戳 1715558400（秒）；这是资料，不是生成请求。
// 第 67 行：记录型号 openai/gpt-4o-2024-05-13：显示名“GPT-4o (2024-05-13)”，目录上架时间戳 1715558400（秒）；这是资料，不是生成请求。
// 第 68 行：记录型号 openai/gpt-4-turbo：显示名“GPT-4 Turbo”，目录上架时间戳 1712620800（秒）；这是资料，不是生成请求。
// 第 69 行：记录型号 openai/gpt-3.5-turbo-0613：显示名“GPT-3.5 Turbo (older v0613)”，目录上架时间戳 1706140800（秒）；这是资料，不是生成请求。
// 第 70 行：记录型号 openai/gpt-3.5-turbo-instruct：显示名“GPT-3.5 Turbo Instruct”，目录上架时间戳 1695859200（秒）；这是资料，不是生成请求。
// 第 71 行：记录型号 openai/gpt-3.5-turbo-16k：显示名“GPT-3.5 Turbo 16k”，目录上架时间戳 1693180800（秒）；这是资料，不是生成请求。
// 第 72 行：记录型号 openai/gpt-3.5-turbo：显示名“GPT-3.5 Turbo”，目录上架时间戳 1685232000（秒）；这是资料，不是生成请求。
// 第 73 行：记录型号 openai/gpt-4：显示名“GPT-4”，目录上架时间戳 1685232000（秒）；这是资料，不是生成请求。
// 第 74 行：结束前面的代码块、资料列表或函数调用。
// 第 75 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 76 行：stale 字段设为 否（false）。
// 第 77 行：结束前面的代码块、资料列表或函数调用。
// 第 78 行：继续填写 providers 的内容：含 10 项的列表。
// 第 79 行：id 字段设为 “deepseek”。
// 第 80 行：name 字段设为 “DeepSeek”。
// 第 81 行：prefix 字段设为 “deepseek”。
// 第 82 行：docs 字段设为 “https://api-docs.deepseek.com/quick_start/pricing-details-cny/”。
// 第 83 行：models 字段设为 含 14 项的列表。
// 第 84 行：记录型号 deepseek/deepseek-v4.1-flash：显示名“DeepSeek V4.1 Flash”，目录上架时间戳 1789021285（秒）；这是资料，不是生成请求。
// 第 85 行：记录型号 deepseek/deepseek-v4-flash-vision-exp：显示名“DeepSeek V4 Flash Vision Exp”，目录上架时间戳 1787311563（秒）；这是资料，不是生成请求。
// 第 86 行：记录型号 deepseek/deepseek-v4-pro-0813：显示名“DeepSeek V4 Pro 0813”，目录上架时间戳 1786549364（秒）；这是资料，不是生成请求。
// 第 87 行：记录型号 deepseek/deepseek-v4-flash-0731：显示名“DeepSeek V4 Flash 0731”，目录上架时间戳 1785478908（秒）；这是资料，不是生成请求。
// 第 88 行：记录型号 deepseek/deepseek-v4-pro：显示名“DeepSeek V4 Pro 0423”，目录上架时间戳 1777000679（秒）；这是资料，不是生成请求。
// 第 89 行：记录型号 deepseek/deepseek-v4-flash：显示名“DeepSeek V4 Flash 0423”，目录上架时间戳 1777000666（秒）；这是资料，不是生成请求。
// 第 90 行：记录型号 deepseek/deepseek-v3.2：显示名“DeepSeek V3.2”，目录上架时间戳 1764594642（秒）；这是资料，不是生成请求。
// 第 91 行：记录型号 deepseek/deepseek-v3.2-exp：显示名“DeepSeek V3.2 Exp”，目录上架时间戳 1759150481（秒）；这是资料，不是生成请求。
// 第 92 行：记录型号 deepseek/deepseek-v3.1-terminus：显示名“DeepSeek V3.1 Terminus”，目录上架时间戳 1758548275（秒）；这是资料，不是生成请求。
// 第 93 行：记录型号 deepseek/deepseek-chat-v3.1：显示名“DeepSeek V3.1”，目录上架时间戳 1755779628（秒）；这是资料，不是生成请求。
// 第 94 行：记录型号 deepseek/deepseek-r1-0528：显示名“R1 0528”，目录上架时间戳 1748455170（秒）；这是资料，不是生成请求。
// 第 95 行：记录型号 deepseek/deepseek-chat-v3-0324：显示名“DeepSeek V3 0324”，目录上架时间戳 1742824755（秒）；这是资料，不是生成请求。
// 第 96 行：记录型号 deepseek/deepseek-r1：显示名“R1”，目录上架时间戳 1737381095（秒）；这是资料，不是生成请求。
// 第 97 行：记录型号 deepseek/deepseek-chat：显示名“DeepSeek V3”，目录上架时间戳 1735241320（秒）；这是资料，不是生成请求。
// 第 98 行：结束前面的代码块、资料列表或函数调用。
// 第 99 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 100 行：stale 字段设为 否（false）。
// 第 101 行：结束前面的代码块、资料列表或函数调用。
// 第 102 行：继续填写 providers 的内容：含 10 项的列表。
// 第 103 行：id 字段设为 “anthropic”。
// 第 104 行：name 字段设为 “Anthropic · Claude”。
// 第 105 行：prefix 字段设为 “anthropic”。
// 第 106 行：docs 字段设为 “https://platform.claude.com/docs/en/models/overview”。
// 第 107 行：models 字段设为 含 16 项的列表。
// 第 108 行：记录型号 anthropic/claude-haiku-5.5：显示名“Claude Haiku 5.5”，目录上架时间戳 1791397883（秒）；这是资料，不是生成请求。
// 第 109 行：记录型号 anthropic/claude-sonnet-5.5：显示名“Claude Sonnet 5.5”，目录上架时间戳 1790618686（秒）；这是资料，不是生成请求。
// 第 110 行：记录型号 anthropic/claude-opus-5.5：显示名“Claude Opus 5.5”，目录上架时间戳 1790094732（秒）；这是资料，不是生成请求。
// 第 111 行：记录型号 anthropic/claude-fable-5.1：显示名“Claude Fable 5.1”，目录上架时间戳 1788285838（秒）；这是资料，不是生成请求。
// 第 112 行：记录型号 anthropic/claude-opus-5：显示名“Claude Opus 5”，目录上架时间戳 1784912544（秒）；这是资料，不是生成请求。
// 第 113 行：记录型号 anthropic/claude-sonnet-5：显示名“Claude Sonnet 5”，目录上架时间戳 1782843083（秒）；这是资料，不是生成请求。
// 第 114 行：记录型号 anthropic/claude-fable-5：显示名“Claude Fable 5”，目录上架时间戳 1781007515（秒）；这是资料，不是生成请求。
// 第 115 行：记录型号 anthropic/claude-opus-4.8：显示名“Claude Opus 4.8”，目录上架时间戳 1779905091（秒）；这是资料，不是生成请求。
// 第 116 行：记录型号 anthropic/claude-opus-4.7：显示名“Claude Opus 4.7”，目录上架时间戳 1776351100（秒）；这是资料，不是生成请求。
// 第 117 行：记录型号 anthropic/claude-sonnet-4.6：显示名“Claude Sonnet 4.6”，目录上架时间戳 1771342990（秒）；这是资料，不是生成请求。
// 第 118 行：记录型号 anthropic/claude-opus-4.6：显示名“Claude Opus 4.6”，目录上架时间戳 1770219050（秒）；这是资料，不是生成请求。
// 第 119 行：记录型号 anthropic/claude-opus-4.5：显示名“Claude Opus 4.5”，目录上架时间戳 1764010580（秒）；这是资料，不是生成请求。
// 第 120 行：记录型号 anthropic/claude-haiku-4.5：显示名“Claude Haiku 4.5”，目录上架时间戳 1760547638（秒）；这是资料，不是生成请求。
// 第 121 行：记录型号 anthropic/claude-sonnet-4.5：显示名“Claude Sonnet 4.5”，目录上架时间戳 1759161676（秒）；这是资料，不是生成请求。
// 第 122 行：记录型号 anthropic/claude-opus-4.1：显示名“Claude Opus 4.1”，目录上架时间戳 1754411591（秒）；这是资料，不是生成请求。
// 第 123 行：记录型号 anthropic/claude-sonnet-4：显示名“Claude Sonnet 4”，目录上架时间戳 1747930371（秒）；这是资料，不是生成请求。
// 第 124 行：结束前面的代码块、资料列表或函数调用。
// 第 125 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 126 行：stale 字段设为 否（false）。
// 第 127 行：结束前面的代码块、资料列表或函数调用。
// 第 128 行：继续填写 providers 的内容：含 10 项的列表。
// 第 129 行：id 字段设为 “google”。
// 第 130 行：name 字段设为 “Google · Gemini”。
// 第 131 行：prefix 字段设为 “google”。
// 第 132 行：docs 字段设为 “https://ai.google.dev/gemini-api/docs/models”。
// 第 133 行：models 字段设为 含 20 项的列表。
// 第 134 行：记录型号 google/gemini-3.8-flash：显示名“Gemini 3.8 Flash”，目录上架时间戳 1788362056（秒）；这是资料，不是生成请求。
// 第 135 行：记录型号 google/gemini-3.7-flash：显示名“Gemini 3.7 Flash”，目录上架时间戳 1786640581（秒）；这是资料，不是生成请求。
// 第 136 行：记录型号 google/gemini-3.6-flash：显示名“Gemini 3.6 Flash”，目录上架时间戳 1784646733（秒）；这是资料，不是生成请求。
// 第 137 行：记录型号 google/gemini-3.5-flash-lite：显示名“Gemini 3.5 Flash Lite”，目录上架时间戳 1784646726（秒）；这是资料，不是生成请求。
// 第 138 行：记录型号 google/gemini-3.5-flash：显示名“Gemini 3.5 Flash”，目录上架时间戳 1779193800（秒）；这是资料，不是生成请求。
// 第 139 行：记录型号 google/gemini-3.1-flash-lite：显示名“Gemini 3.1 Flash Lite”，目录上架时间戳 1778168828（秒）；这是资料，不是生成请求。
// 第 140 行：记录型号 google/gemma-4-26b-a4b-it：显示名“Gemma 4 26B A4B ”，目录上架时间戳 1775227989（秒）；这是资料，不是生成请求。
// 第 141 行：记录型号 google/gemma-4-31b-it：显示名“Gemma 4 31B”，目录上架时间戳 1775148486（秒）；这是资料，不是生成请求。
// 第 142 行：记录型号 google/gemini-3.1-flash-lite-preview：显示名“Gemini 3.1 Flash Lite Preview”，目录上架时间戳 1772512673（秒）；这是资料，不是生成请求。
// 第 143 行：记录型号 google/gemini-3.1-pro-preview-customtools：显示名“Gemini 3.1 Pro Preview Custom Tools”，目录上架时间戳 1772045923（秒）；这是资料，不是生成请求。
// 第 144 行：记录型号 google/gemini-3.1-pro-preview：显示名“Gemini 3.1 Pro Preview”，目录上架时间戳 1771509627（秒）；这是资料，不是生成请求。
// 第 145 行：记录型号 google/gemini-3-flash-preview：显示名“Gemini 3 Flash Preview”，目录上架时间戳 1765987078（秒）；这是资料，不是生成请求。
// 第 146 行：记录型号 google/gemini-2.5-flash-lite：显示名“Gemini 2.5 Flash Lite”，目录上架时间戳 1753200276（秒）；这是资料，不是生成请求。
// 第 147 行：记录型号 google/gemini-2.5-flash：显示名“Gemini 2.5 Flash”，目录上架时间戳 1750172488（秒）；这是资料，不是生成请求。
// 第 148 行：记录型号 google/gemini-2.5-pro：显示名“Gemini 2.5 Pro”，目录上架时间戳 1750169544（秒）；这是资料，不是生成请求。
// 第 149 行：记录型号 google/gemini-2.5-pro-preview：显示名“Gemini 2.5 Pro Preview 06-05”，目录上架时间戳 1749137257（秒）；这是资料，不是生成请求。
// 第 150 行：记录型号 google/gemma-3-4b-it：显示名“Gemma 3 4B”，目录上架时间戳 1741905510（秒）；这是资料，不是生成请求。
// 第 151 行：记录型号 google/gemma-3-12b-it：显示名“Gemma 3 12B”，目录上架时间戳 1741902625（秒）；这是资料，不是生成请求。
// 第 152 行：记录型号 google/gemma-3-27b-it：显示名“Gemma 3 27B”，目录上架时间戳 1741756359（秒）；这是资料，不是生成请求。
// 第 153 行：记录型号 google/gemma-2-27b-it：显示名“Gemma 2 27B”，目录上架时间戳 1720828800（秒）；这是资料，不是生成请求。
// 第 154 行：结束前面的代码块、资料列表或函数调用。
// 第 155 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 156 行：stale 字段设为 否（false）。
// 第 157 行：结束前面的代码块、资料列表或函数调用。
// 第 158 行：继续填写 providers 的内容：含 10 项的列表。
// 第 159 行：id 字段设为 “qwen”。
// 第 160 行：name 字段设为 “阿里千问 · Qwen”。
// 第 161 行：prefix 字段设为 “qwen”。
// 第 162 行：docs 字段设为 “https://help.aliyun.com/zh/model-studio/models”。
// 第 163 行：models 字段设为 含 42 项的列表。
// 第 164 行：记录型号 qwen/qwen3.8-max-prime：显示名“Qwen3.8 Max Prime”，目录上架时间戳 1790191228（秒）；这是资料，不是生成请求。
// 第 165 行：记录型号 qwen/qwen3.8-omni-flash：显示名“Qwen3.8 Omni Flash”，目录上架时间戳 1789959954（秒）；这是资料，不是生成请求。
// 第 166 行：记录型号 qwen/qwen3.8-max-0902：显示名“Qwen3.8 Max (0902)”，目录上架时间戳 1788469704（秒）；这是资料，不是生成请求。
// 第 167 行：记录型号 qwen/qwen3.8-flash：显示名“Qwen3.8 Flash”，目录上架时间戳 1787773060（秒）；这是资料，不是生成请求。
// 第 168 行：记录型号 qwen/qwen3.8-27b：显示名“Qwen3.8 27B”，目录上架时间戳 1786722910（秒）；这是资料，不是生成请求。
// 第 169 行：记录型号 qwen/qwen3.8-2.4t-a95b：显示名“Qwen3.8 2.4T A95B”，目录上架时间戳 1786551702（秒）；这是资料，不是生成请求。
// 第 170 行：记录型号 qwen/qwen3.7-flash：显示名“Qwen3.7 Flash”，目录上架时间戳 1785190561（秒）；这是资料，不是生成请求。
// 第 171 行：记录型号 qwen/qwen3.7-plus：显示名“Qwen3.7 Plus”，目录上架时间戳 1780491783（秒）；这是资料，不是生成请求。
// 第 172 行：记录型号 qwen/qwen3.7-max：显示名“Qwen3.7 Max”，目录上架时间戳 1779376861（秒）；这是资料，不是生成请求。
// 第 173 行：记录型号 qwen/qwen3.5-plus-20260420：显示名“Qwen3.5 Plus 2026-04-20”，目录上架时间戳 1777261368（秒）；这是资料，不是生成请求。
// 第 174 行：记录型号 qwen/qwen3.6-flash：显示名“Qwen3.6 Flash”，目录上架时间戳 1777261362（秒）；这是资料，不是生成请求。
// 第 175 行：记录型号 qwen/qwen3.6-35b-a3b：显示名“Qwen3.6 35B A3B”，目录上架时间戳 1777260255（秒）；这是资料，不是生成请求。
// 第 176 行：记录型号 qwen/qwen3.6-27b：显示名“Qwen3.6 27B”，目录上架时间戳 1777255064（秒）；这是资料，不是生成请求。
// 第 177 行：记录型号 qwen/qwen3.6-plus：显示名“Qwen3.6 Plus”，目录上架时间戳 1775133557（秒）；这是资料，不是生成请求。
// 第 178 行：记录型号 qwen/qwen3.5-9b：显示名“Qwen3.5-9B”，目录上架时间戳 1773152396（秒）；这是资料，不是生成请求。
// 第 179 行：记录型号 qwen/qwen3.5-35b-a3b：显示名“Qwen3.5-35B-A3B”，目录上架时间戳 1772053822（秒）；这是资料，不是生成请求。
// 第 180 行：记录型号 qwen/qwen3.5-27b：显示名“Qwen3.5-27B”，目录上架时间戳 1772053810（秒）；这是资料，不是生成请求。
// 第 181 行：记录型号 qwen/qwen3.5-122b-a10b：显示名“Qwen3.5-122B-A10B”，目录上架时间戳 1772053789（秒）；这是资料，不是生成请求。
// 第 182 行：记录型号 qwen/qwen3.5-flash-02-23：显示名“Qwen3.5-Flash”，目录上架时间戳 1772053776（秒）；这是资料，不是生成请求。
// 第 183 行：记录型号 qwen/qwen3.5-plus-02-15：显示名“Qwen3.5 Plus 2026-02-15”，目录上架时间戳 1771229416（秒）；这是资料，不是生成请求。
// 第 184 行：记录型号 qwen/qwen3.5-397b-a17b：显示名“Qwen3.5 397B A17B”，目录上架时间戳 1771223018（秒）；这是资料，不是生成请求。
// 第 185 行：记录型号 qwen/qwen3-coder-next：显示名“Qwen3 Coder Next”，目录上架时间戳 1770164101（秒）；这是资料，不是生成请求。
// 第 186 行：记录型号 qwen/qwen3-vl-8b-instruct：显示名“Qwen3 VL 8B Instruct”，目录上架时间戳 1760463308（秒）；这是资料，不是生成请求。
// 第 187 行：记录型号 qwen/qwen3-vl-30b-a3b-thinking：显示名“Qwen3 VL 30B A3B Thinking”，目录上架时间戳 1759794479（秒）；这是资料，不是生成请求。
// 第 188 行：记录型号 qwen/qwen3-vl-30b-a3b-instruct：显示名“Qwen3 VL 30B A3B Instruct”，目录上架时间戳 1759794476（秒）；这是资料，不是生成请求。
// 第 189 行：记录型号 qwen/qwen3-vl-235b-a22b-instruct：显示名“Qwen3 VL 235B A22B Instruct”，目录上架时间戳 1758668687（秒）；这是资料，不是生成请求。
// 第 190 行：记录型号 qwen/qwen3-coder-flash：显示名“Qwen3 Coder Flash”，目录上架时间戳 1758115536（秒）；这是资料，不是生成请求。
// 第 191 行：记录型号 qwen/qwen3-next-80b-a3b-thinking：显示名“Qwen3 Next 80B A3B Thinking”，目录上架时间戳 1757612284（秒）；这是资料，不是生成请求。
// 第 192 行：记录型号 qwen/qwen3-next-80b-a3b-instruct：显示名“Qwen3 Next 80B A3B Instruct”，目录上架时间戳 1757612213（秒）；这是资料，不是生成请求。
// 第 193 行：记录型号 qwen/qwen3-coder-30b-a3b-instruct：显示名“Qwen3 Coder 30B A3B Instruct”，目录上架时间戳 1753972379（秒）；这是资料，不是生成请求。
// 第 194 行：记录型号 qwen/qwen3-30b-a3b-instruct-2507：显示名“Qwen3 30B A3B Instruct 2507”，目录上架时间戳 1753806965（秒）；这是资料，不是生成请求。
// 第 195 行：记录型号 qwen/qwen3-235b-a22b-thinking-2507：显示名“Qwen3 235B A22B Thinking 2507”，目录上架时间戳 1753449557（秒）；这是资料，不是生成请求。
// 第 196 行：记录型号 qwen/qwen3-coder：显示名“Qwen3 Coder 480B A35B”，目录上架时间戳 1753230546（秒）；这是资料，不是生成请求。
// 第 197 行：记录型号 qwen/qwen3-235b-a22b-2507：显示名“Qwen3 235B A22B Instruct 2507”，目录上架时间戳 1753119555（秒）；这是资料，不是生成请求。
// 第 198 行：记录型号 qwen/qwen3-30b-a3b：显示名“Qwen3 30B A3B”，目录上架时间戳 1745878604（秒）；这是资料，不是生成请求。
// 第 199 行：记录型号 qwen/qwen3-14b：显示名“Qwen3 14B”，目录上架时间戳 1745876478（秒）；这是资料，不是生成请求。
// 第 200 行：记录型号 qwen/qwen3-32b：显示名“Qwen3 32B”，目录上架时间戳 1745875945（秒）；这是资料，不是生成请求。
// 第 201 行：记录型号 qwen/qwen2.5-vl-72b-instruct：显示名“Qwen2.5 VL 72B Instruct”，目录上架时间戳 1738410311（秒）；这是资料，不是生成请求。
// 第 202 行：记录型号 qwen/qwen-plus：显示名“Qwen-Plus”，目录上架时间戳 1738409840（秒）；这是资料，不是生成请求。
// 第 203 行：记录型号 qwen/qwen-2.5-coder-32b-instruct：显示名“Qwen2.5 Coder 32B Instruct”，目录上架时间戳 1731368400（秒）；这是资料，不是生成请求。
// 第 204 行：记录型号 qwen/qwen-2.5-7b-instruct：显示名“Qwen2.5 7B Instruct”，目录上架时间戳 1729036800（秒）；这是资料，不是生成请求。
// 第 205 行：记录型号 qwen/qwen-2.5-72b-instruct：显示名“Qwen2.5 72B Instruct”，目录上架时间戳 1726704000（秒）；这是资料，不是生成请求。
// 第 206 行：结束前面的代码块、资料列表或函数调用。
// 第 207 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 208 行：stale 字段设为 否（false）。
// 第 209 行：结束前面的代码块、资料列表或函数调用。
// 第 210 行：继续填写 providers 的内容：含 10 项的列表。
// 第 211 行：id 字段设为 “moonshot”。
// 第 212 行：name 字段设为 “月之暗面 · Kimi”。
// 第 213 行：prefix 字段设为 “moonshotai”。
// 第 214 行：docs 字段设为 “https://platform.moonshot.cn/docs”。
// 第 215 行：models 字段设为 含 7 项的列表。
// 第 216 行：记录型号 moonshotai/kimi-k3：显示名“Kimi K3”，目录上架时间戳 1784215858（秒）；这是资料，不是生成请求。
// 第 217 行：记录型号 moonshotai/kimi-k2.7-code：显示名“Kimi K2.7 Code”，目录上架时间戳 1781266361（秒）；这是资料，不是生成请求。
// 第 218 行：记录型号 moonshotai/kimi-k2.6：显示名“Kimi K2.6”，目录上架时间戳 1776699402（秒）；这是资料，不是生成请求。
// 第 219 行：记录型号 moonshotai/kimi-k2.5：显示名“Kimi K2.5”，目录上架时间戳 1769487076（秒）；这是资料，不是生成请求。
// 第 220 行：记录型号 moonshotai/kimi-k2-thinking：显示名“Kimi K2 Thinking”，目录上架时间戳 1762440622（秒）；这是资料，不是生成请求。
// 第 221 行：记录型号 moonshotai/kimi-k2-0905：显示名“Kimi K2 0905”，目录上架时间戳 1757021147（秒）；这是资料，不是生成请求。
// 第 222 行：记录型号 moonshotai/kimi-k2：显示名“Kimi K2 0711”，目录上架时间戳 1752263252（秒）；这是资料，不是生成请求。
// 第 223 行：结束前面的代码块、资料列表或函数调用。
// 第 224 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 225 行：stale 字段设为 否（false）。
// 第 226 行：结束前面的代码块、资料列表或函数调用。
// 第 227 行：继续填写 providers 的内容：含 10 项的列表。
// 第 228 行：id 字段设为 “zai”。
// 第 229 行：name 字段设为 “智谱 · GLM”。
// 第 230 行：prefix 字段设为 “z-ai”。
// 第 231 行：docs 字段设为 “https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3”。
// 第 232 行：models 字段设为 含 16 项的列表。
// 第 233 行：记录型号 z-ai/glm-5.3-prime：显示名“GLM 5.3 Prime”，目录上架时间戳 1790199651（秒）；这是资料，不是生成请求。
// 第 234 行：记录型号 z-ai/glm-5.3-flashx：显示名“GLM 5.3 FlashX”，目录上架时间戳 1789744020（秒）；这是资料，不是生成请求。
// 第 235 行：记录型号 z-ai/glm-5.3-flash：显示名“GLM 5.3 Flash”，目录上架时间戳 1787752741（秒）；这是资料，不是生成请求。
// 第 236 行：记录型号 z-ai/glm-5.3：显示名“GLM 5.3”，目录上架时间戳 1787086655（秒）；这是资料，不是生成请求。
// 第 237 行：记录型号 z-ai/glm-5.2：显示名“GLM 5.2”，目录上架时间戳 1781631930（秒）；这是资料，不是生成请求。
// 第 238 行：记录型号 z-ai/glm-5.1：显示名“GLM 5.1”，目录上架时间戳 1775578025（秒）；这是资料，不是生成请求。
// 第 239 行：记录型号 z-ai/glm-5v-turbo：显示名“GLM 5V Turbo”，目录上架时间戳 1775061458（秒）；这是资料，不是生成请求。
// 第 240 行：记录型号 z-ai/glm-5-turbo：显示名“GLM 5 Turbo”，目录上架时间戳 1773583573（秒）；这是资料，不是生成请求。
// 第 241 行：记录型号 z-ai/glm-5：显示名“GLM 5”，目录上架时间戳 1770829182（秒）；这是资料，不是生成请求。
// 第 242 行：记录型号 z-ai/glm-4.7-flash：显示名“GLM 4.7 Flash”，目录上架时间戳 1768833913（秒）；这是资料，不是生成请求。
// 第 243 行：记录型号 z-ai/glm-4.7：显示名“GLM 4.7”，目录上架时间戳 1766378014（秒）；这是资料，不是生成请求。
// 第 244 行：记录型号 z-ai/glm-4.6v：显示名“GLM 4.6V”，目录上架时间戳 1765207462（秒）；这是资料，不是生成请求。
// 第 245 行：记录型号 z-ai/glm-4.6：显示名“GLM 4.6”，目录上架时间戳 1759235576（秒）；这是资料，不是生成请求。
// 第 246 行：记录型号 z-ai/glm-4.5v：显示名“GLM 4.5V”，目录上架时间戳 1754922288（秒）；这是资料，不是生成请求。
// 第 247 行：记录型号 z-ai/glm-4.5：显示名“GLM 4.5”，目录上架时间戳 1753471347（秒）；这是资料，不是生成请求。
// 第 248 行：记录型号 z-ai/glm-4.5-air：显示名“GLM 4.5 Air”，目录上架时间戳 1753471258（秒）；这是资料，不是生成请求。
// 第 249 行：结束前面的代码块、资料列表或函数调用。
// 第 250 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 251 行：stale 字段设为 否（false）。
// 第 252 行：结束前面的代码块、资料列表或函数调用。
// 第 253 行：继续填写 providers 的内容：含 10 项的列表。
// 第 254 行：id 字段设为 “minimax”。
// 第 255 行：name 字段设为 “MiniMax”。
// 第 256 行：prefix 字段设为 “minimax”。
// 第 257 行：docs 字段设为 “https://platform.minimax.io/docs/guides/models-intro”。
// 第 258 行：models 字段设为 含 8 项的列表。
// 第 259 行：记录型号 minimax/minimax-m3：显示名“MiniMax M3”，目录上架时间戳 1780245374（秒）；这是资料，不是生成请求。
// 第 260 行：记录型号 minimax/minimax-m2.7：显示名“MiniMax M2.7”，目录上架时间戳 1773836697（秒）；这是资料，不是生成请求。
// 第 261 行：记录型号 minimax/minimax-m2.5：显示名“MiniMax M2.5”，目录上架时间戳 1770908502（秒）；这是资料，不是生成请求。
// 第 262 行：记录型号 minimax/minimax-m2-her：显示名“MiniMax M2-her”，目录上架时间戳 1769177239（秒）；这是资料，不是生成请求。
// 第 263 行：记录型号 minimax/minimax-m2.1：显示名“MiniMax M2.1”，目录上架时间戳 1766454997（秒）；这是资料，不是生成请求。
// 第 264 行：记录型号 minimax/minimax-m2：显示名“MiniMax M2”，目录上架时间戳 1761252093（秒）；这是资料，不是生成请求。
// 第 265 行：记录型号 minimax/minimax-m1：显示名“MiniMax M1”，目录上架时间戳 1750200414（秒）；这是资料，不是生成请求。
// 第 266 行：记录型号 minimax/minimax-01：显示名“MiniMax-01”，目录上架时间戳 1736915462（秒）；这是资料，不是生成请求。
// 第 267 行：结束前面的代码块、资料列表或函数调用。
// 第 268 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 269 行：stale 字段设为 否（false）。
// 第 270 行：结束前面的代码块、资料列表或函数调用。
// 第 271 行：继续填写 providers 的内容：含 10 项的列表。
// 第 272 行：id 字段设为 “xai”。
// 第 273 行：name 字段设为 “xAI · Grok”。
// 第 274 行：prefix 字段设为 “x-ai”。
// 第 275 行：docs 字段设为 “https://docs.x.ai/developers/models”。
// 第 276 行：models 字段设为 含 7 项的列表。
// 第 277 行：记录型号 x-ai/grok-4.7：显示名“Grok 4.7”，目录上架时间戳 1790007541（秒）；这是资料，不是生成请求。
// 第 278 行：记录型号 x-ai/grok-4.6：显示名“Grok 4.6”，目录上架时间戳 1786548957（秒）；这是资料，不是生成请求。
// 第 279 行：记录型号 x-ai/grok-4.5：显示名“Grok 4.5”，目录上架时间戳 1783523154（秒）；这是资料，不是生成请求。
// 第 280 行：记录型号 x-ai/grok-build-0.1：显示名“Grok Build 0.1”，目录上架时间戳 1779298123（秒）；这是资料，不是生成请求。
// 第 281 行：记录型号 x-ai/grok-4.3：显示名“Grok 4.3”，目录上架时间戳 1777591821（秒）；这是资料，不是生成请求。
// 第 282 行：记录型号 x-ai/grok-4.20-multi-agent：显示名“Grok 4.20 Multi-Agent”，目录上架时间戳 1774979158（秒）；这是资料，不是生成请求。
// 第 283 行：记录型号 x-ai/grok-4.20：显示名“Grok 4.20”，目录上架时间戳 1774979019（秒）；这是资料，不是生成请求。
// 第 284 行：结束前面的代码块、资料列表或函数调用。
// 第 285 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 286 行：stale 字段设为 否（false）。
// 第 287 行：结束前面的代码块、资料列表或函数调用。
// 第 288 行：继续填写 providers 的内容：含 10 项的列表。
// 第 289 行：id 字段设为 “mistral”。
// 第 290 行：name 字段设为 “Mistral AI”。
// 第 291 行：prefix 字段设为 “mistralai”。
// 第 292 行：docs 字段设为 “https://docs.mistral.ai/models”。
// 第 293 行：models 字段设为 含 20 项的列表。
// 第 294 行：记录型号 mistralai/mistral-large-4-0：显示名“Mistral Large 4”，目录上架时间戳 1791294122（秒）；这是资料，不是生成请求。
// 第 295 行：记录型号 mistralai/mistral-medium-3-5：显示名“Mistral Medium 3.5”，目录上架时间戳 1777570439（秒）；这是资料，不是生成请求。
// 第 296 行：记录型号 mistralai/mistral-small-2603：显示名“Mistral Small 4”，目录上架时间戳 1773695685（秒）；这是资料，不是生成请求。
// 第 297 行：记录型号 mistralai/devstral-2512：显示名“Devstral 2 2512”，目录上架时间戳 1765285419（秒）；这是资料，不是生成请求。
// 第 298 行：记录型号 mistralai/ministral-14b-2512：显示名“Ministral 3 14B 2512”，目录上架时间戳 1764681735（秒）；这是资料，不是生成请求。
// 第 299 行：记录型号 mistralai/ministral-8b-2512：显示名“Ministral 3 8B 2512”，目录上架时间戳 1764681654（秒）；这是资料，不是生成请求。
// 第 300 行：记录型号 mistralai/ministral-3b-2512：显示名“Ministral 3 3B 2512”，目录上架时间戳 1764681560（秒）；这是资料，不是生成请求。
// 第 301 行：记录型号 mistralai/mistral-large-2512：显示名“Mistral Large 3 2512”，目录上架时间戳 1764624472（秒）；这是资料，不是生成请求。
// 第 302 行：记录型号 mistralai/voxtral-small-24b-2507：显示名“Voxtral Small 24B 2507”，目录上架时间戳 1761835144（秒）；这是资料，不是生成请求。
// 第 303 行：记录型号 mistralai/mistral-medium-3.1：显示名“Mistral Medium 3.1”，目录上架时间戳 1755095639（秒）；这是资料，不是生成请求。
// 第 304 行：记录型号 mistralai/codestral-2508：显示名“Codestral 2508”，目录上架时间戳 1754079630（秒）；这是资料，不是生成请求。
// 第 305 行：记录型号 mistralai/mistral-small-3.2-24b-instruct：显示名“Mistral Small 3.2 24B”，目录上架时间戳 1750443016（秒）；这是资料，不是生成请求。
// 第 306 行：记录型号 mistralai/mistral-medium-3：显示名“Mistral Medium 3”，目录上架时间戳 1746627341（秒）；这是资料，不是生成请求。
// 第 307 行：记录型号 mistralai/mistral-small-3.1-24b-instruct：显示名“Mistral Small 3.1 24B”，目录上架时间戳 1742238937（秒）；这是资料，不是生成请求。
// 第 308 行：记录型号 mistralai/mistral-saba：显示名“Saba”，目录上架时间戳 1739803239（秒）；这是资料，不是生成请求。
// 第 309 行：记录型号 mistralai/mistral-small-24b-instruct-2501：显示名“Mistral Small 3”，目录上架时间戳 1738255409（秒）；这是资料，不是生成请求。
// 第 310 行：id 字段设为 “mistralai/mistral-large-2407”；name 字段设为 “Mistral Large 2407”；created 字段设为 1731978415。
// 第 311 行：id 字段设为 “mistralai/mistral-nemo”；name 字段设为 “Mistral Nemo”；created 字段设为 1721347200。
// 第 312 行：id 字段设为 “mistralai/mixtral-8x22b-instruct”；name 字段设为 “Mixtral 8x22B Instruct”；created 字段设为 1713312000。
// 第 313 行：id 字段设为 “mistralai/mistral-large”；name 字段设为 “Mistral Large”；created 字段设为 1708905600。
// 第 314 行：结束前面的代码块、资料列表或函数调用。
// 第 315 行：updatedAt 字段设为 “2026-10-10T13:18:30.375Z”。
// 第 316 行：stale 字段设为 否（false）。
// 第 317 行：结束前面的代码块、资料列表或函数调用。
// 第 318 行：结束前面的代码块、资料列表或函数调用。
// 第 319 行：结束前面的代码块、资料列表或函数调用。
// 第 321 行：公开目录刷新使用 OpenRouter 的型号目录地址，不携带用户 Key。
// 第 322 行：开始保存兼容型号补充列表。
// 第 323 行：provider 字段设为 “deepseek”；id 字段设为 “deepseek/deepseek-v4.1-flash”；nativeId 字段设为 “deepseek-flash”；name 字段设为 “DeepSeek V4.1 Flash”。
// 第 324 行：provider 字段设为 “deepseek”；id 字段设为 “deepseek/deepseek-v4-flash”；nativeId 字段设为 “deepseek-v4-flash”；name 字段设为 “DeepSeek V4 Flash（历史兼容）”；note 字段设为 “官方已退役 V4 Flash，此调用名在官方接口转到 V4.1 Flash；网关行为以其接口为准。”。
// 第 325 行：provider 字段设为 “deepseek”；id 字段设为 “deepseek/deepseek-v4-pro”；nativeId 字段设为 “deepseek-v4-pro”；name 字段设为 “DeepSeek V4 Pro”。
// 第 326 行：结束前面的代码块、资料列表或函数调用。
// 第 327 行：准备 nativeAliases（模型原生名称对照表）：一组字段（deepseek/deepseek-v4.1-flash: “deepseek-flash”、mistralai/mistral-large-4-0: “mistral-large-latest”、mistralai/mistral-small-2603: “mistral-small-latest”）。
// 第 328 行：deepseek/deepseek-v4.1-flash 字段设为 “deepseek-flash”。
// 第 329 行：mistralai/mistral-large-4-0 字段设为 “mistral-large-latest”。
// 第 330 行：mistralai/mistral-small-2603 字段设为 “mistral-small-latest”。
// 第 331 行：结束前面的代码块、资料列表或函数调用。
// 第 332 行：定义函数 nativeId：把目录模型名转换为原生调用名；接收 模型。
// 第 333 行：资料有明确 nativeId 时直接使用它。
// 第 334 行：没有明确原生名时查询本地别名对照表。
// 第 335 行：其他目录型号去掉第一个斜线前的厂家前缀。
// 第 336 行：Anthropic 原生名把相邻版本数字间的点转换为横线。
// 第 337 行：MiniMax 原生名规范前缀大小写。
// 第 338 行：结束当前函数，并返回 标识。
// 第 339 行：结束前面的代码块、资料列表或函数调用。
// 第 340 行：定义函数 providerFor：按已存分配或型号线索确定目录分类；接收 标识、assignments，未传入时用 空资料对象 {}。
// 第 341 行：已有合法厂家分配时优先采用它。
// 第 342 行：准备 lower：将 把 （标识 或 “”） 转成文字 转为小写。
// 第 343 行：准备 prefix：从 内置厂家和型号快照的providers 找首个满足 检查 lower 是否以 （p的prefix 加上或拼接 “/”） 开头 的项。
// 第 344 行：如果 prefix，结束当前函数，并返回 prefix的id。
// 第 345 行：列出型号命名与目录厂家的常见对应规则；这些规则不决定网络请求地址。
// 第 346 行：继续前一行的变量定义；本行补充 ['anthropic', /claude/], ['google', /gemini|gemma/], ['qwen', /qwen/],。
// 第 347 行：继续前一行的变量定义；本行补充 ['moonshot', /kimi|moonshot/], ['zai', /\bglm/], ['minimax', /minimax/],。
// 第 348 行：继续前一行的变量定义；本行补充 ['xai', /grok/], ['mistral', /mistral|ministral|mixtral|codestral|devstral|magistral|voxtral/] ];。
// 第 349 行：结束当前函数，并返回 （从 rules 找首个满足 检查 lower 是否符合 regex 的项（存在时）的第 [0] 项 或 “custom”）。
// 第 350 行：结束前面的代码块、资料列表或函数调用。
// 第 351 行：定义函数 normalizeSnapshot：校验目录快照，缺失数据使用内置资料；接收 待处理的值。
// 第 352 行：快照来源不匹配或更新时间非法时，回到内置资料。
// 第 353 行：准备 providers：逐项转换 内置厂家和型号快照的providers，转换规则为 下方处理函数。
// 第 354 行：准备 incoming：若 检查 待处理的值的providers 是否为列表，用 从 待处理的值的providers 找首个满足 （p的id 等于 base的id） 的项；否则用 空值 null。
// 第 355 行：开始清理各厂家输入型号，检查前缀、字段类型、长度和时间。
// 第 356 行：继续前一行的变量定义；本行补充 .filter(m => m && typeof m.id === 'string' && m.id.startsWith(base.prefix + '/') && m.id.length <= 200 &&。
// 第 357 行：拒绝型号名含空白或冒号，以及不合法显示名。
// 第 358 行：只接受有效目录时间戳，允许最多一天的时间偏差。
// 第 359 行：继续前一行的变量定义；本行补充 .filter((m, index, list) => list.findIndex(item => item.id === m.id) === index)。
// 第 360 行：id 字段设为 m的id；name 字段设为 m的name；created 字段设为 m的created。
// 第 361 行：结束当前函数，并返回 若 models的length，用 一组字段（沿用已有字段、models、updatedAt: （incoming的updatedAt 或 待处理的值的updatedAt）、stale: （incoming的stale 等于 是（true）））；否则用 一组字段（沿用已有字段、updatedAt: 内置厂家和型号快照的资料更新时间、stale: 是（true））。
// 第 362 行：结束前面的代码块、资料列表或函数调用。
// 第 363 行：结束当前函数，并返回 一组字段（updatedAt: 待处理的值的资料更新时间、source: 公开模型目录地址、providers）。
// 第 364 行：结束前面的代码块、资料列表或函数调用。
// 第 365 行：定义函数 resolveId：优先采用接口实际返回的调用名；接收 模型、整理后的基础地址、接口开放的型号，未传入时用 列表 []。
// 第 366 行：准备 native：把目录模型名转换为原生调用名（模型）。
// 第 368 行：优先使用当前接口确实返回的目录名或原生名。
// 第 369 行：如果 matches的length，结束当前函数，并返回 若 （检查 整理后的基础地址 是否符合 字符匹配规则 /openrouter\.ai/i 且 检查 matches 是否包含 模型的标识），用 模型的id；否则用 matches的第 [0] 项。
// 第 370 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；如果 （解析接口或资源网址（整理后的基础地址）的hostname 等于 “openrouter.ai”），结束当前函数，并返回 模型的id；捕获前面步骤的错误，按下面步骤处理。
// 第 371 行：结束当前函数，并返回 native。
// 第 372 行：结束前面的代码块、资料列表或函数调用。
// 第 373 行：定义函数 allModels：合并所有厂家的型号和兼容补充项；接收 保存的快照，未传入时用 内置厂家和型号快照。
// 第 374 行：结束当前函数，并返回 列表 [展开或收集 逐项转换 保存的快照的providers 后合并列表、展开或收集 兼容型号补充表]。
// 第 375 行：结束前面的代码块、资料列表或函数调用。
// 第 376 行：定义函数 interfaceModels：去重并过滤适合文本请求的接口型号；接收 项目列表、厂家标识，未传入时用 “custom”。
// 第 377 行：过滤列表前先建立去重集合。
// 第 378 行：结束当前函数，并返回 逐项转换 从 若 检查 项目列表 是否为列表，用 项目列表；否则用 列表 [] 保留满足 下方处理函数 的项，转换规则为 一组字段（id: item的标识、name: typeof item.name === 'string' && item.name.length <= 200 ? item.name : item 的计算结果、沿用已有字段）。
// 第 379 行：准备 id（标识）：item（存在时）的id。
// 第 380 行：空型号、过长型号、含空白或重复项都排除。
// 第 381 行：准备 input（输入值）：（item的input_modalities 或 item的architecture（存在时）的input_modalities）。
// 第 382 行：准备 output：（item的output_modalities 或 item的architecture（存在时）的output_modalities）。
// 第 383 行：接口已说明能力时，必须支持文本输入且只输出文本。
// 第 384 行：结束当前函数，并返回 否（false）。
// 第 386 行：Voxtral 有语音型号，因此必须由接口明确声明文本能力才能进入候选。
// 第 387 行：结束当前函数，并返回 否（false）。
// 第 388 行：已过期型号排除。
// 第 389 行：按名称排除嵌入、排序、图像、语音和实时等非本任务类型。
// 第 390 行：准备 family：把 把 标识 中匹配 字符匹配规则 /^ft:/ 的内容换成 “” 中匹配 字符匹配规则 /^models\// 的内容换成 “”。
// 第 391 行：选择官方目录厂家时，型号必须属于该厂家；自定义网关不做这种厂家限制。
// 第 392 行：将 标识 加到 seen；结束当前函数，并返回 是（true）。
// 第 393 行：id 字段设为 item的id；name 字段设为 若 （（item的名称的数据类型 等于 “string”） 且 （item的名称的length 小于等于 200）），用 item的name；否则用 item的id。
// 第 395 行：重复整理或缓存后仍保留 Voxtral 已确认的文本能力。
// 第 396 行：结束前面的代码块、资料列表或函数调用。
// 第 398 行：定义异步函数 fetchInterface：带当前 Key 查询模型列表并分类错误；接收 接口连接资料。
// 第 399 行：准备 baseUrl（整理后的基础地址），暂不赋值。
// 第 400 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；整理后的基础地址 改为 检查地址并去掉末尾接口路径（接口连接资料的接口基础地址）。
// 第 401 行：捕获前面步骤的错误，按下面步骤处理；结束当前函数，并返回 一组字段（ok: 否（false）、code: “address”、error: “接口地址无效，请检查配置。”）。
// 第 402 行：取得当前连接的 Key 并去掉两端空白。
// 第 403 行：如果 不满足（API Key），结束当前函数，并返回 一组字段（ok: 否（false）、code: “key_missing”、error: “请先填写 API Key。”）。
// 第 404 行：总查询任务最多等待 20 秒。
// 第 405 行：初次失败可再尝试一次。
// 第 406 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 407 行：准备 res（接口响应）：等待 向 拼接文字和变量（整理后的基础地址） 发出网络请求 完成。
// 第 408 行：查询 /models 时携带 Key，禁用缓存并使用超时信号。
// 第 409 行：结束前面的代码块、资料列表或函数调用。
// 第 410 行：如果 不满足（接口响应的ok），执行下面这一组步骤。
// 第 411 行：服务器错误首次发生时等待 300 毫秒再试。
// 第 412 行：等待 建立稍后完成或失败的 Promise 任务 完成；跳过本轮余下步骤，进入下一轮循环。
// 第 413 行：结束前面的代码块、资料列表或函数调用。
// 第 414 行：准备 code（代码特征）：（一组字段（401: “key_invalid”、402: “balance”、403: “forbidden”、404: “unsupported”、429: “rate_limit”）的第 [接口响应的status] 项 或 “service”）。
// 第 415 行：结束当前函数，并返回 一组字段（ok: 否（false）、code、status: 接口响应的状态、error: 拼接文字和变量（接口响应的status））。
// 第 416 行：结束前面的代码块、资料列表或函数调用。
// 第 417 行：准备 payload，暂不赋值。
// 第 418 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；payload 改为 等待 读取并解析响应的 JSON 完成。
// 第 419 行：超时发生时继续报告超时；普通 JSON 解析失败返回格式错误。
// 第 420 行：如果 signal的aborted，报告错误并中断当前正常流程：错误。
// 第 421 行：结束当前函数，并返回 一组字段（ok: 否（false）、code: “format”、error: “模型接口未返回有效 JSON。”）。
// 第 422 行：结束前面的代码块、资料列表或函数调用。
// 第 423 行：兼容模型列表必须有 data 数组。
// 第 424 行：整理去重并排序所有接口型号名，同时返回过滤后的文本型号资料。
// 第 425 行：entries 字段设为 去重并过滤适合文本请求的接口型号（payload的数据）。
// 第 426 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 427 行：如果 （（signal的aborted 或 （错误的name 等于 “TimeoutError”）） 或 （错误的name 等于 “AbortError”）），执行下面这一组步骤。
// 第 428 行：结束当前函数，并返回 一组字段（ok: 否（false）、code: “timeout”、error: “获取模型列表超时。”）。
// 第 429 行：结束前面的代码块、资料列表或函数调用。
// 第 430 行：如果 （attempt 等于 0），执行下面这一组步骤；等待 建立稍后完成或失败的 Promise 任务 完成；跳过本轮余下步骤，进入下一轮循环。
// 第 431 行：结束当前函数，并返回 一组字段（ok: 否（false）、code: “network”、error: “无法连接模型接口，请检查网络。”）。
// 第 432 行：结束前面的代码块、资料列表或函数调用。
// 第 433 行：结束前面的代码块、资料列表或函数调用。
// 第 434 行：结束前面的代码块、资料列表或函数调用。
// 第 435 行：定义异步函数 refresh：不带用户 Key 刷新公开型号资料；接收 previous，未传入时用 内置厂家和型号快照。
// 第 436 行：准备 res（接口响应），暂不赋值。
// 第 437 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 438 行：公开目录刷新使用 20 秒超时和不缓存请求，不发送用户连接资料。
// 第 439 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 440 行：如果 （（错误的name 等于 “TimeoutError”） 或 （错误的name 等于 “AbortError”）），执行下面这一组步骤。
// 第 441 行：报告错误并中断当前正常流程：建立错误信息（“公开模型目录请求超时（20 秒），请检查网络后重试”）。
// 第 442 行：结束前面的代码块、资料列表或函数调用。
// 第 443 行：报告错误并中断当前正常流程：建立错误信息（）。
// 第 444 行：结束前面的代码块、资料列表或函数调用。
// 第 445 行：如果 不满足（接口响应的ok），报告错误并中断当前正常流程：建立错误信息（）。
// 第 446 行：准备 payload，暂不赋值。
// 第 447 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；payload 改为 等待 读取并解析响应的 JSON 完成。
// 第 448 行：捕获前面步骤的错误，按下面步骤处理；报告错误并中断当前正常流程：建立错误信息（“公开模型目录未返回有效 JSON，请检查网络或代理响应”）。
// 第 449 行：如果 不满足（检查 payload的数据 是否为列表），报告错误并中断当前正常流程：建立错误信息（“公开模型目录格式无效，保留已保存列表”）。
// 第 450 行：准备 timestamp：调用 toISOString（所属对象：取得日期时间）。
// 第 451 行：准备 existing：校验目录快照，缺失数据使用内置资料（previous）。
// 第 452 行：准备 updated：0。
// 第 453 行：准备 providers：逐项转换 existing的providers，转换规则为 下方处理函数。
// 第 454 行：按厂家前缀从公开列表选型号，并逐项检查资料。
// 第 455 行：继续前一行的变量定义；本行补充 !/[\s:]/.test(m.id) && m.id.length <= 200 && typeof m.name === 'string' &&。
// 第 456 行：继续前一行的变量定义；本行补充 m.name.length <= 200 && Number.isFinite(m.created) && m.created > 0 &&。
// 第 457 行：继续前一行的变量定义；本行补充 m.created * 1000 <= Date.now() + 86400000 &&。
// 第 458 行：只接受文本输入、且输出类型仅为文本的型号。
// 第 459 行：继续前一行的变量定义；本行补充 m.architecture?.output_modalities?.length === 1 && m.architecture.output_modalities[0] === 'text' &&。
// 第 460 行：继续前一行的变量定义；本行补充 (!m.expiration_date || Date.parse(m.expiration_date) > Date.now()))。
// 第 461 行：按目录上架时间从新到旧排序，同时间按名称排序。
// 第 462 行：同名型号去重。
// 第 463 行：保存型号名、去厂家前缀的显示名和上架时间。
// 第 464 行：某厂家没有有效新型号时，保留旧资料并标 stale。
// 第 465 行：updated 加 1。
// 第 466 行：结束当前函数，并返回 一组字段（沿用已有字段、models: 选中的任务或文字、updatedAt: timestamp、stale: 否（false））。
// 第 467 行：结束前面的代码块、资料列表或函数调用。
// 第 468 行：如果 不满足（updated），报告错误并中断当前正常流程：建立错误信息（“目录没有提供可用的文本模型，保留已保存列表”）。
// 第 469 行：返回新目录时间、来源和各厂家资料。
// 第 470 行：结束前面的代码块、资料列表或函数调用。
// 第 471 行：把目录、查询、过滤和型号转换工具公开为 AIModelCatalog。
// 第 472 行：providerFor 字段沿用同名值；normalizeSnapshot 字段沿用同名值；resolveId 字段沿用同名值；allModels 字段沿用同名值；interfaceModels 字段沿用同名值；fetchInterface 字段沿用同名值；refresh 字段沿用同名值。
// 第 473 行：结束初始化函数并立即执行，完成本文件的注册。
