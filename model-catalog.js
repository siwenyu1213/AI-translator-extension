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
