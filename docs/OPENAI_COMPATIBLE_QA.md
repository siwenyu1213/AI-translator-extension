# OpenAI 兼容接口升级与验收

日期：2026-10-10，北京时间（UTC+8）。版本：4.0.0。

## 变更及起始状态

开始时 `main` 工作区干净，HEAD 为 `5c25631fe68988df1d63364db455dc769ba793fd`。已执行 `git fetch origin`，当前分支比远程领先两个本地文档/环境提交，没有落后或分歧。保留历史与 origin（`https://github.com/siwenyu666-beep/AI-translator-extension.git`），从该 HEAD 创建 `codex/openai-compatible-api`。

移除千问与 DeepSeek 的专用 Key、固定端点、模型前缀路由、专用思考参数及界面品牌。统一使用用户配置的 Base URL + Bearer API Key，保留解释/全文翻译独立模型。新增 10 个可编辑预设、在线模型发现、可关闭的保存前模型检测以及任意模型 ID 输入。版本显示与 manifest 同步为 4.0.0。

支持范围：HTTP/HTTPS，Bearer Key 鉴权，Chat Completions 的 messages 请求及 SSE `choices[0].delta.content` 响应。`/models` 是可选能力；仅支持 Responses 或其他原生协议/鉴权方式的服务需另行适配。服务商自己的 Key 不可用 OpenAI 官方 Key 代替。预设及模型发现均不代表实际账号有生成权限。

`config.js` 同时供 Worker 和设置页使用，避免迁移规则不一致。首次升级清空旧供应商 Key，移除旧专用预设，关闭旧专用思考设置，保留语言、触发方式和其他自定义模型。迁移后须重新填写接口与 Key；新版手动输入的模型名原样保留。

后台默认省略 temperature 与 token 上限等差异参数，开启思考时才发送 `reasoning_effort`。流式解析覆盖紧凑 `data:`、CRLF、末尾无换行、finish_reason 结束、空输出、错误和截断；60 秒无响应时中止并提示。配置变更清理缓存并更新缓存代数，避免跨连接或旧在途请求误用缓存。

本任务文件：`background.js`、`config.js`、`content.js`、`content-fullpage.js`、`manifest.json`、`popup.html`、`popup.css`、`popup.js`、`README.md`、`docs/DEVELOPMENT.md`、本摘要及 `scripts/verify.mjs`、`scripts/verify-api.mjs`、`scripts/verify-browser.mjs`。本地 `Description.md` 同步更新，通过 `.git/info/exclude` 排除，未暂存。

## 已执行检查

工具：Node.js `v24.18.1`，实际 Edge `154.0.4258.62`。Playwright 使用 Codex 已有运行库，未安装 npm 依赖。Edge 使用 headless 独立 profile `.local/browser-profile/api-qa/`，未修改日常浏览器配置。

| 检查 | 操作与预期 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 静态检查 | `node scripts/verify.mjs --report artifacts/qa/static-check.json`；语法、入口、资源和版本一致 | 16 项通过，退出码 0 | `artifacts/qa/static-check.json` |
| 后台模拟回归 | `node scripts/verify-api.mjs`；执行真实后台代码，模拟 chrome.storage 与网络 | 20 组通过，退出码 0；包括迁移、端点、Bearer、模型发现/无效 ID、401/403/404/429/500、最小参数、独立模型、缓存、流式错误/截断 | `artifacts/qa/api-simulation.json` |
| 实际 Edge 扩展验收 | `node scripts/verify-browser.mjs --playwright '<已有 Playwright 包目录>'`；加载源码，使用本机 HTTP 模拟 API 与合成 Key | 7 组通过，退出码 0；无相关页面异常 | `artifacts/qa/browser-check.json` |
| 视觉检查 | 打开设置页两标签、划词卡片、全文结果截图 | 已查看，新增控件与模型调用名显示正常，无文字重叠 | `artifacts/qa/popup-explain.png`、`popup-translate.png`、`selection-stream.png`、`fullpage-stream.png` |
| 空白与本地说明保护 | `git diff --check`；`git check-ignore -v -- Description.md`；`git ls-files -- Description.md` | diff 无错误；匹配 exclude；Description.md 未跟踪 | Git 命令输出 |

Edge 的 7 组路径具体为：

1. 真正加载 MV3 Worker 和设置页，旧专用设置迁移后出现 10 个预设，并保留一个合成自定义模型。
2. 使用尚未总保存的输入地址/Key，经实际 runtime 消息查询 `/models`，归一化完整端点并保存。
3. 拒绝无效模型，列表内模型选择、删除跨标签同步；关闭检测后新增、修改手动模型。
4. 解释/翻译独立模型保存，重开设置页后仍保留，端点切换生效。
5. 页面选区与 mouseup → 实际内容脚本 → Worker → 本机 HTTP SSE → 卡片文本、完整模型名；Esc 关闭。
6. 后台 tabs 消息启动全文翻译，实际按需注入脚本；使用翻译模型，切换原文/译文并取消恢复。
7. 错误 Key 显示鉴权失败，查询失败不覆盖之前成功保存的连接，无相关页面异常。

所有测试 Key 均为合成字符串，报告记录的是鉴权匹配布尔值及请求模型/参数名，不记录授权头、用户 storage 或私有网页。报告 HEAD 是检查时的基线，运行的是本任务未提交源码；结合上方文件范围和本地提交确认版本。

## 重新加载与配置

在 `edge://extensions` 点击该扩展的重新加载按钮，并刷新已经打开的普通网页；首次安装则开启开发者模式，加载本仓库根目录。打开设置页，填服务商的 Base URL 与对应 Key，获取模型列表或手动填写模型 ID，分别选解释/翻译模型，点击保存设置。没有 `/models` 时关闭保存前检测。模型不支持思考参数时保持思考关闭。

## 验证边界与版本保存

真实供应商请求未执行：本任务没有提供目标服务的有效凭据。因此真实模型权限、余额、质量及供应商网络/流式差异尚未验证。本机模拟 API 的成功与失败结果只证明上述扩展交互和兼容协议路径。

未进行原生工具栏弹出层与右键菜单鼠标操作；测试是在实际扩展设置页直接打开控件、通过真实内容脚本 mouseup 触发划词、通过后台 tabs 消息触发全文。未对任意网站布局、滚动和动态内容作全面回归；沿用现有全文翻译逻辑。

本地提交主题：`feat: support configurable OpenAI-compatible translation APIs`，可用 `git log -1` 查找提交号。GitHub：未推送；只保存本地完成点。没有剩余的已发现失败，真实 API 与上述人工浏览器检查需补充对应条件后验收。

协议参考：[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[模型列表](https://developers.openai.com/api/reference/resources/models/methods/list)。模型预设参考 OpenAI 模型目录及 GPT-4.1 mini、GPT-5 mini、o4-mini 的官方模型页面，读取日期为 2026-10-10。
