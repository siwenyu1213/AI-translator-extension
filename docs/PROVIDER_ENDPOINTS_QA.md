# v4.3 厂家地址自动填写与独立连接验收

日期：2026-10-10（北京时间）。扩展版本：4.3.0。

问题：原厂家选择器只筛选模型，所有调用仍用同一个手填地址和 Key。现在选择官方厂家立即填写对应兼容地址，地址只读；选择“自定义接口”才允许修改地址。各厂家分别保存 Key 和接口模型 ID，解释与全文翻译各自选择厂家并读取对应连接。

## 官方端点来源

以下地址于 2026-10-10 对照官方文档核实；扩展在其后追加 `/chat/completions` 或 `/models`。文档核实不代表真实账号生成已验收。

| 厂家 | 自动填写的 Base URL | 官方来源 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | [API 概览](https://developers.openai.com/api/reference/overview) |
| DeepSeek | `https://api.deepseek.com` | [首次调用](https://api-docs.deepseek.com/) |
| Anthropic | `https://api.anthropic.com/v1` | [OpenAI SDK 兼容层](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | [OpenAI 兼容接口](https://ai.google.dev/gemini-api/docs/openai) |
| 阿里千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [百炼 OpenAI 兼容](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | [Kimi API Key 与调用示例](https://platform.kimi.com/docs/get-api-key) |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | [OpenAI 兼容调用](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction) |
| MiniMax | `https://api.minimax.io/v1` | [OpenAI 兼容文本 API](https://platform.minimax.io/docs/api-reference/text-openai-api) |
| xAI | `https://api.x.ai/v1` | [快速开始](https://docs.x.ai/developers/quickstart) |
| Mistral AI | `https://api.mistral.ai/v1` | [Chat API](https://docs.mistral.ai/api/endpoint/chat) |

千问默认百炼北京旧域名，官方文档说明仍可使用；美国、新加坡或工作空间专属地址须选择自定义。MiniMax 默认国际平台，其他地域使用自定义地址及匹配的 Key。Anthropic 官方兼容层支持基础 Chat Completions 和流式输出；部分多工作空间账号可能要求额外 `anthropic-workspace-id`，当前扩展不提供自定义请求头输入。预设仅覆盖本扩展的文本对话协议，不代表所有原生 API 功能。

## 配置与保留行为

- `config.js` 定义 10 家固定端点以及 `providerConnections`。各厂家 Key 和 `/models` ID 分别保存；自定义连接另外保存 Base URL。两个标签选同一家时共用该厂家的连接。
- `explainManufacturer` / `translateManufacturer` 是显式接口选择。解释及 A/C/D 分类使用解释连接，B 分类及全文翻译使用翻译连接；模型名称不会覆盖用户选择。
- v4.2 旧连接只在地址与所选厂家预设一致时归入该厂家，否则归入自定义，保留地址、Key 和选定模型。再次打开保持显式选择。新厂家未配置时 Key 留空，后台不会借用另一个厂家或旧全局 Key。
- 获取接口列表和模型检测使用当前输入，成功才保存；异步请求期间改变厂家、标签、地址或 Key 时拒绝应用返回结果。自定义地址在保存/查询时归一化。
- 公开目录仍在每次打开时无 Key 静默刷新；模型数量不限三款，失败顶部红字。公开目录不保证覆盖厂家的全部官方型号或账号权限。
- 模型调用名和通用设置保持可见，用户尚未确认隐藏。

## 执行证据

起始分支 `codex/openai-compatible-api`，起始 HEAD `a9d0c00757f8a9f7bafffa42277725f9d1bcf0a1`，工作区干净。已执行 `git fetch origin` 检查上游，没有覆盖原有成果或推送 GitHub。

待提交范围：`config.js`、`background.js`、`popup.js`、`popup.html`、`manifest.json`、两个功能验证脚本、README、开发说明及本摘要。`Description.md` 已同步，但仍通过 `.git/info/exclude` 排除，未跟踪、不提交。

工具：Node.js v24.18.1；实际 Edge 154.0.4258.62；使用本机已有 Playwright，不引入 npm 依赖。

| 执行 | 预期与实际结果 | 证据 |
| --- | --- | --- |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 17 项通过，0 失败；语法、MV3 入口、本地资源、两处版本一致 | `artifacts/qa/static-check.json` |
| `git diff --check` | 退出码 0，无空白错误 | 终端记录 |
| `node scripts/verify-api.mjs` | 29 组通过，0 失败；含网关迁移、固定厂家端点、自定义、独立路由、缺 Key 拦截和原 SSE 错误处理 | `artifacts/qa/api-simulation.json` |
| `node scripts/verify-browser.mjs --playwright '<本机已有包目录>'` | 16 组通过，0 失败，页面异常 0；真实扩展加载、10 家地址自动填写/只读、自定义可编辑、独立 Key 与重新打开、异步切换、实际端口路由、划词与全文路径 | `artifacts/qa/browser-check.json` |
| 视觉检查 | 已查看 DeepSeek 设置截图：自动地址、Key、厂家/模型入口可读，调用名和通用设置可见 | `artifacts/qa/popup-provider-autofill.png` |

最后 Edge 验收时间为北京时间 2026-10-10 22:07:59。浏览器使用 `.local/browser-profile/api-qa/run-<时间戳>/` 新建独立配置，不读取日常浏览器 storage。公开模型目录使用真实网络；划词和全文生成使用本机 HTTP 模拟接口；DeepSeek/Gemini 官方域名请求由 Worker fetch 拦截模拟，核对地址、Key 匹配和模型，再返回模拟 SSE，合成 Key 不外发。报告记录路由与鉴权匹配布尔值，不导出 Key 或私有网页。

## 加载与未验证项

在 `edge://extensions` 对本项目点“重新加载”，刷新旧网页，再打开扩展。解释/全文翻译标签中选择厂家与模型，填写对应厂家 Key，点“保存设置”。第三方网关、其他地域或本机接口选择“自定义接口”填写服务商地址。若接口不支持 `/models`，可关闭保存前检测。

未验证：10 家账号的真实成功/失败生成、各型号权限与参数支持、原生工具栏弹出层和右键菜单鼠标操作。需对应有效凭据及日常浏览器人工验收；模拟结果不代表真实模型已经可用。用户原来的更新失败原因不能仅凭模拟证明，当前仍保留缓存和顶部错误提示。

本地版本保存主题：`feat: autofill provider endpoints and isolate API connections`。仅本地提交，未推送 GitHub。
