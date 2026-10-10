# v4.4 精简设置与当前接口模型验收

日期：2026-10-10，北京时间。版本：4.4.0。

按用户确认隐藏模型调用名、通用设置和常驻 API 地址。Key 填写保存后收起，只保留“重新填写 API Key”按钮。模型下拉只取当前厂家的接口开放列表，公开/历史/其他厂家的存储项不再额外进入选择器。

## 实现与配置行为

- 官方厂家地址仍由固定预设自动匹配，不在窗口显示；“自定义接口”提供独立配置入口，地址只在 dialog 内输入。
- 首次没有 Key 和接口缓存时提示“填写 API Key 后加载模型”。保存 Key 后自动请求该厂家的 `/models`，有缓存先显示缓存；每次打开、切换已配置厂家、保存设置时也自动更新。
- 接口模型通过 `AIModelCatalog.interfaceModels` 过滤：去重，检查 ID、模态与明确过期时间，排除常见嵌入/图像/音频等非对话用途，按型号归属筛当前厂家。自定义只列其接口返回的文本型号。字段不足时使用型号规则，无法证明全部协议能力。
- 名称优先使用接口 `name`，缺失时用当前厂家的公开目录名称或接口 ID；请求 ID 保持接口原值。公开目录仍无 Key 自动刷新，但只辅助名称，不增加下拉选项。历史兼容数据保留在工具内部，不参与当前窗口补项。
- `providerConnections` 独立保存 `availableModels`、`modelEntries`、`modelsCheckedAt`。换 Key/地址使旧缓存失效；改 Key 后清除对应已保存用途的旧型号，再等待新列表选择。请求按厂家/地址/Key 去重，旧响应晚返回不会覆盖新连接。
- 查询失败保留相同连接的缓存：有缓存提示“暂时无法获取模型，已保留已有列表。”，没有缓存提示“暂时无法获取模型，请稍后重试。”。成功静默；有效空列表清除旧选项并显示“暂无可用模型”。
- 后台阻止已确认接口列表外的型号；空模型保持空，避免旧迁移逻辑回填全局其他厂家预设。接口移除当前型号时，已保存用途选列表首项或空值。
- Key 保存立即收起，重新打开也保持收起；重填打开空输入，空值提示且不覆盖旧 Key，取消恢复已保存连接。Key 保存不等同于凭据或生成能力已验证，接口鉴权错误由自动列表查询提示。
- 原启用、上下文、触发方式保留已保存值；思考与语言选项仍显示。旧模型 ID、归属等存储未清空，手动新增/修改/删除入口已隐藏。

接口需提供兼容的 `/models`。没有该端点且没有缓存时，精简窗口无法新选型号，也不会恢复手动调用名入口。服务商返回模型在列表中不保证该账号可以生成或支持所有 Chat Completions 参数。

## 执行证据

起始分支 `codex/openai-compatible-api`，HEAD `06d65dcef7a80f225d560b2f265efe660e5fd63c`，工作区干净。已执行 `git fetch origin`；当前分支原有本地提交保留，未覆盖用户修改、未推送 GitHub。

检查范围：`popup.js/html/css`、`config.js`、`model-catalog.js`、`background.js`、版本清单、两项功能验证脚本、README、开发说明及本摘要。`Description.md` 本地同步，继续通过 `.git/info/exclude` 排除，不提交。

工具：Node.js v24.18.1、Edge 154.0.4258.62、本机已有 Playwright，无新增 npm 依赖。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 17 项通过，0 失败，包含语法、资源及版本同步 | `artifacts/qa/static-check.json` |
| `git diff --check` | 退出码 0 | 终端记录 |
| `node scripts/verify-api.mjs` | 32 组通过，0 失败；新增厂家/文本过滤、缓存字段、空模型及列表外模型拦截，兼容有效空列表 | `artifacts/qa/api-simulation.json` |
| `node scripts/verify-browser.mjs --playwright '<已有包目录>'` | 17 组通过，0 失败，页面异常 0；首次/已保存/重填/取消、不同厂家、重开、失败缓存、空列表、异步换 Key、自定义 dialog 和实际流式路径 | `artifacts/qa/browser-check.json` |
| 视觉检查 | 已查看保存 Key 后的实际截图：紧凑布局、厂家与模型、思考/语言、重填按钮及总保存；无调用名、通用控件或常驻地址 | `artifacts/qa/popup-compact-saved.png` |

最后 Edge 报告时间为北京时间 2026-10-10 22:34:07。专用配置目录 `.local/browser-profile/api-qa/run-<时间戳>/`，不读取日常浏览器设置。公开目录使用真实网络；厂家的模型列表和生成在 Worker 中明确模拟，合成 Key 不发送到供应商。本机接口通过实际 HTTP `/models` 与 SSE 验证 runtime、划词、B 翻译、全文注入及原文恢复。报告记录鉴权匹配布尔值，没有导出 Key。

附加截图：`popup-key-first.png` 为首次输入；`popup-interface-error.png` 为列表失败缓存；`popup-compact-final.png` 为自定义连接配置后的最终窗口。重填取消流程已由实际浏览器操作验证。

当前 DeepSeek 模型列表元数据与接口形式参考 [官方 Lists Models](https://api-docs.deepseek.com/api/list-models/)；厂商可提供显示名、模态和能力信息，但实际返回及生成权限仍需有效账号验证。

## 使用与未验证项

在 `edge://extensions` 对项目重新加载，刷新旧网页。先选厂家、填写并保存 Key，再选择接口返回的模型，点“保存设置”。自定义先通过“配置自定义接口”填写地址；修改 Key 使用“重新填写 API Key”，不再显示原 Key。

未验证：10 家真实账号 `/models` 的完整兼容性与成功/失败生成、全部型号能力、原生工具栏弹出层与右键鼠标操作。缺少相应有效凭据，厂家网络部分只能标为模拟；公开目录联网不代表厂家真实 API 验收。

本地提交主题：`feat: simplify settings and show provider API models only`。仅保存本地版本，未推送 GitHub。
