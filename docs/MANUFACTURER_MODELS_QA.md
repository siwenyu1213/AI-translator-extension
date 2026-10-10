# 厂家联动、近期型号目录与实时更新验收

日期：2026-10-10，北京时间 UTC+8。扩展版本：4.1.0。

## 起点与变更

起始分支 `codex/openai-compatible-api`，工作区干净，HEAD `6b547a4d8032214f643a744c4a23c034a7f6e26f`。已 fetch origin，保留原有三个本地提交和远程配置，复用任务分支。本次未推送 GitHub。

两个标签各增加“模型厂家 → 该厂家模型”选择。至少 10 家：OpenAI、DeepSeek、Anthropic、Google、阿里千问、月之暗面、智谱、MiniMax、xAI、Mistral；另有其他/自定义入口。公开目录每家显示 3 款，当前接口返回的 ID、手动型号和 DeepSeek 常用/历史入口另外保留。厂家只筛选模型，不改后台端点；请求继续走已配置 Base URL + Key。

`model-catalog.js` 在背景与设置页共用，内置公开目录快照。刷新从 `https://openrouter.ai/api/v1/models` 取纯 JSON；无用户授权头、Key、Base URL 或网页数据。字段和厂家白名单过滤，只保留可输入文本且仅输出文本的型号，排除重复 ID、batch/free 等后缀和已过期项；按 created 降序取每家 3 款。

打开设置页时，如果距上次目录检查超过 15 分钟则自动检查；“实时更新厂家模型”按钮立即请求。显示来源、更新时间与加载/失败反馈。失败不覆盖缓存或当前选择；厂家不足 3 款保留该厂家旧目录并标注。旧目录上的已选型号不会因为出现新款而被自动替换。

**来源边界：created 是 OpenRouter 上架时间，不是厂家全球首发日期，也不能保证目录覆盖厂家全部新型号。** [OpenRouter 官方字段说明](https://openrouter.ai/docs/guides/overview/models)对此有明确说明。因此 UI 使用“公开目录最近上架的 3 款”，而不是无来源的“官方最新”。

DeepSeek 常用入口：V4.1 Flash（`deepseek-flash`）、V4 Flash（`deepseek-v4-flash`，历史兼容）、V4 Pro（`deepseek-v4-pro`）。[DeepSeek 官方说明](https://api-docs.deepseek.com/quick_start/pricing-details-cny/)指出，旧 Flash / Vision Exp 已退役，官方接口将旧调用名转到 V4.1 Flash。UI 已提示这一点；其他网关以自己的映射为准。

从 v4.0 升级只追加厂家目录，不清空已保存的连接、Key 或选定模型。仍保留 v3→v4 的历史迁移。自定义 ID 记录厂家归属；修改/删除目录条目保存在 hiddenCatalogModels；当前接口返回的实际 ID 优先匹配，连接变化会让旧接口列表失效。无法匹配的 ID 可手动修改并检测。

## 本次取得的公开目录

实时网络验收取得时间：2026-10-10T12:44:08.674Z。按公开目录最近上架排序；以下每厂 3 款不包括额外兼容和自定义条目。

| 厂家 | 目录中的 3 款型号 |
| --- | --- |
| OpenAI | GPT-6.1 Sol Pro；GPT-6.1 Sol；GPT-6 Luna Pro |
| DeepSeek | DeepSeek V4.1 Flash；DeepSeek V4 Flash Vision Exp；DeepSeek V4 Pro 0813 |
| Anthropic · Claude | Claude Haiku 5.5；Claude Sonnet 5.5；Claude Opus 5.5 |
| Google · Gemini | Gemini 3.8 Flash；Gemini 3.7 Flash；Gemini 3.6 Flash |
| 阿里千问 · Qwen | Qwen3.8 Max Prime；Qwen3.8 Omni Flash；Qwen3.8 Max (0902) |
| 月之暗面 · Kimi | Kimi K3；Kimi K2.7 Code；Kimi K2.6 |
| 智谱 · GLM | GLM 5.3 Prime；GLM 5.3 FlashX；GLM 5.3 Flash |
| MiniMax | MiniMax M3；MiniMax M2.7；MiniMax M2.5 |
| xAI · Grok | Grok 4.7；Grok 4.6；Grok 4.5 |
| Mistral AI | Mistral Large 4；Mistral Medium 3.5；Mistral Small 4 |

官方名称/调用名另核对了 OpenAI 模型目录、Claude 模型说明、Gemini 模型目录、DeepSeek API 文档、GLM-5.3 文档、MiniMax 模型介绍、xAI 模型目录和 Mistral 模型目录。30 条动态排序以公开目录为准，不能把上述核对说成逐模型真实生成已通过。

## 已执行与证据

Node.js v24.18.1，Edge 154.0.4258.62；使用已有 Playwright，扩展没有新增 npm 依赖。每轮在 `.local/browser-profile/api-qa/run-时间戳/` 创建新 profile，避免复用缓存中的旧 Worker。测试只使用合成 Key 和合成网页。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 17 项通过、退出码 0；包括新目录脚本语法与共享资源 | `artifacts/qa/static-check.json` |
| `node scripts/verify-api.mjs` | 24 组通过、退出码 0；目录过滤/排序/缓存、ID 匹配、Key 保留以及原有流式回归；离线模拟 | `artifacts/qa/api-simulation.json` |
| `node scripts/verify-browser.mjs --playwright '<已有包目录>'` | 11 组实际 Edge 检查通过、退出码 0；其中公开目录刷新使用真实网络，推理 API 使用本机模拟 | `artifacts/qa/browser-check.json` |
| 视觉检查 | 已查看厂家入口、历史提示、两标签、划词卡片和全文结果截图，控件和文本无重叠 | `artifacts/qa/popup-deepseek.png`、`popup-explain.png`、`popup-translate.png`、`selection-stream.png`、`fullpage-stream.png` |
| `git diff --check` 和 Description.md 保护 | 无空白错误；本地 exclude 生效，Description.md 未跟踪 | Git 输出 |

11 组 Edge 路径：扩展与迁移加载；遍历 10 厂家并逐个验证 3 条近期项以及 DeepSeek 历史提示；真实公开目录更新；浏览器内模拟目录 503 验证保留缓存；当前连接模型查询；不同厂家独立保存并重开；模型增删改与错误阻止；端点及选定 ID 持久化；实际划词 SSE；实际全文翻译和恢复；错误 Key 不覆盖之前连接。

报告的 HEAD 为本次修改之前的基线，实际运行的是本任务未提交代码。变更范围：`model-catalog.js`、`background.js`、`config.js`、`popup.js`、`popup.html`、`popup.css`、`manifest.json`、两个 API/浏览器验证脚本、README、DEVELOPMENT 和本摘要；本地 Description.md 另更新但不提交。

## 加载与保存

在 `edge://extensions` 点击重新加载并刷新普通测试网页。打开设置页，先选厂家再选型号，确认调用名，填写/保留正确的兼容接口和对应 Key 后保存。切换厂家不会自动改接口；跨厂家需使用支持这些模型的网关，或者手动配置目标接口。实时目录更新无需 Key；获取当前接口列表和生成需该接口的有效 Key。

未验证：10 家真实模型生成、账号权限、输出质量、其他网关名称差异、原生工具栏弹层和右键菜单的鼠标操作。公开目录网络已验证，不能替代上述真实推理检查。当前没有已发现的检查失败。

本地提交主题：`feat: add manufacturer model selection and live catalog updates`。通过 `git log -1` 查提交号。只保存本地完成点，未上传 GitHub。v4.0 历史记录保留在 [OPENAI_COMPATIBLE_QA.md](OPENAI_COMPATIBLE_QA.md)。
