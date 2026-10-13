# 说文 · LingoClarify 开发、运行与验收

当前扩展版本 **4.6.0**。用户功能见 [README](../README.md)，文件职责和接手边界见 [交接](../交接.md)。本手册描述现有入口；带日期的QA和审查文档记录各自提交，不替代当前源码。

## 环境与目录

原生JavaScript / HTML / CSS的Manifest V3扩展，根目录直接加载，不需要构建、开发服务器或npm安装。Marked与DOMPurify固定版本保存在 `vendor/`，不能在运行时加载CDN脚本；来源和许可证见 [vendor说明](../vendor/README.md)。

运行需要支持MV3的Edge；静态与模拟使用Node.js，版本管理使用Git。浏览器工具使用本机已有Playwright，不给扩展新增运行依赖。Chrome及其他浏览器需另行验收。

| 路径 | 用途 |
| --- | --- |
| 根目录、`vendor/` | 运行源码、本地依赖与许可证 |
| `scripts/` | 可复用验证工具 |
| `docs/` | 开发说明和可提交验收摘要 |
| `docs/materials/` | 有来源说明的公开、合成材料 |
| `.local/materials/` | 私有网页样本 |
| `.local/tmp/` | 一次性脚本、缓存、下载 |
| `.local/browser-profile/` | 隔离浏览器配置 |
| `artifacts/qa/`、`artifacts/releases/` | 生成证据与分发产物，不进入Git |

本机工作目录仍为：

```powershell
Set-Location -LiteralPath 'C:\Users\siwen\Desktop\Workspace\工具\AI-translator-extension'
```

GitHub入口为 `https://github.com/siwenyu1213/LingoClarify`。本地目录与品牌名可以不同，继续使用既有加载路径。存在 `Description.md` 时同步维护，保持本地忽略、不提交。

## 加载与更新

1. 打开 `edge://extensions`，开启开发人员模式。
2. 加载包含 `manifest.json` 的根目录。
3. 在“说文 · LingoClarify”设置页分别配置解释与翻译的厂家、Key、模型和语言；自定义连接先保存地址。
4. 修改源码或更新Git后重新加载扩展，并刷新测试网页。
5. 核对管理页错误，必要时打开服务工作线程开发者工具。

用普通HTTP/HTTPS页面测试，浏览器内部页面和受限制商店页不能作为注入验收样本。

## 当前调用关系

- 后台加载 `model-catalog.js`、`config.js`、`selection.js`、`selection-prompts.js`；只使用选区模块的无DOM分析。
- 自动内容注入：`theme.js` → `selection.js` → Marked → DOMPurify → `markdown.js` → `content.js`，样式为 `theme.css`、`content.css`。
- 设置页加载 `model-catalog.js`、`config.js`、`theme.js`、`popup.js`，共用配置与查询逻辑。外观模块独立保存 `uiTheme`，只更新扩展根元素，默认钴蓝纸页；字体和引号图标本地打包。
- 全文由后台按需注入 `content-fullpage.js`，通过端口取得单条或批量结果。

划词本地分类选择单项任务，以统一system要求和JSON材料发送一次生成。外语完整句段用翻译连接，其余解释用解释连接；“解释此句”使用解读任务。所在句及必要材料有预算，回答仍为Markdown正文。全文纯译文和批量ID协议独立。

设置在 `chrome.storage.local`。Key与账号模型缓存位于 `providerConnections`；`AIConfig.connectionFor`选择实际连接。custom缺地址在请求前停止，改地址清除关联型号与缓存。迁移字段属于兼容实现。

DeepSeek官方hostname精确匹配后关闭有效思考，发送 `thinking.disabled` 且不发送 `reasoning_effort`；第三方网关不凭模型名套用。其他服务按已有设置处理。

## 最低检查

每次改动至少运行：

```powershell
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

静态工具检查JS语法、MV3基本字段、声明资源、设置页本地引用、后台字面量注入及importScripts资源、版本显示。报告记录时间、Node、HEAD、工作区及逐项结果。它不完整验证Manifest schema、界面、chrome.* API或真实供应商。

## 按影响范围选择回归

| 范围 | 工具 |
| --- | --- |
| 主题持久化、草稿隔离、页面同步、图标/字体与键盘/窄屏 | `scripts/verify-themes.mjs` |
| 配置、后台、路由、SSE和失败的离线模拟 | `node scripts/verify-api.mjs` |
| 本地分类与提示词/材料构建 | `node scripts/verify-selection-prompts.mjs` |
| 选区分类离线语料 | `node scripts/verify-selection.mjs --node-only` |
| 自定义地址离线配置 | `node scripts/verify-custom-endpoint.mjs --node-only` |
| 设置持久化、消息、划词、全文与恢复 | `scripts/verify-browser.mjs` |
| 真实Range、DOM过滤、预算及路由 | `scripts/verify-selection.mjs` |
| Markdown、复制/TXT、流式与失败恢复 | `scripts/verify-markdown.mjs` |
| 定位、拖动、光标与窗口边界 | `scripts/verify-tooltip-position.mjs` |
| 焦点、下载错误、缓存和观察器 | `scripts/verify-markdown-fixes.mjs` |
| 全文Text任务、取消/重启和故障 | `scripts/verify-adversarial-browser.mjs` |
| 换址、Key草稿、迟到响应和型号过滤 | `scripts/verify-adversarial-config.mjs` |
| 后台时序与配置读取 | `node scripts/verify-adversarial-background.mjs` |

浏览器工具需传入已有包目录：

```powershell
node scripts/verify-markdown.mjs --playwright '<已安装的 playwright 包目录>'
node scripts/verify-tooltip-position.mjs --playwright '<已安装的 playwright 包目录>'
```

本机已核实目录为 `C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`。默认使用Edge；支持 `--edge` 的工具可指定可执行文件。普通回归不要加旧源码对照参数，只有验证特定缺陷时按对应QA说明使用 `--ref` 或 `--expect-vulnerable`。

每轮创建独立profile，使用合成页面、Key和本机HTTP/SSE，不读取日常存储。工具的外部请求拦截和profile保留方式以源码/报告为准；`verify-browser.mjs`结束自动删除本轮profile，其他工具通常保留。不得清除其他任务或用户配置。

## 功能验收要求

只覆盖本次改动影响的路径，整体发布时核对：

- 加载与设置：名称和版本正常，两个用途保存/重开保留，无浏览器错误。
- 模型与接口：列表、有效空列表、无Key/缺地址、错误缓存、换Key/地址和迟到响应。
- 划词：语言与结构、真实Range、上下文、再次解释、关闭与同文重试。
- 浮层：首次阅读位置、Markdown/键盘焦点、选区避让、顶部左键拖动与窗口约束。
- 全文：启动、滚动和动态文字、链接/图片/节点保持、原文切换、取消与重启。
- 导出：剪贴板Markdown、TXT原文/回答/名称、下载接受/完成状态和失败重试。
- 真实API：有效凭据、型号、SSE与失败处理；列表成功不能替代生成验收。

固定模拟回答不能证明语义质量、格式遵守、token账单或首字耗时。原生工具栏弹出层、原生右键鼠标操作及未覆盖网站单独记录。

## 证据与版本保存

在docs记录日期/时区、基线/待提交范围、工具版本、步骤/预期/实际、报告截图路径、未验证项、提交和GitHub状态。本次证据见 [BRANDING_QA](BRANDING_QA.md)。

当前三主题与引号图标改动见 [THEMES_QA](THEMES_QA.md)。主题回归同样传入 `--playwright`；清单的 web_accessible_resources 仅公开注入界面需要的本地图标和字体，静态工具逐一检查这些资源存在。

生成报告默认仅本机保留。对外截图去除Key、授权头和私有网页，附来源说明；不提交凭据或storage导出。

遵循AGENTS.md：记录工作区和远程，保留已有修改，先审阅diff再按明确文件暂存。使用当前任务分支，授权内正常提交推送；核对保护与rulesets，不强推或绕过。正式发布时同步manifest/popup版本；纯改名和文档整理保持4.6.0。

```powershell
git status --short --branch
git diff --check
git diff
# 按任务列出明确路径
git add -- README.md docs/DEVELOPMENT.md
git diff --cached --check
git diff --cached
```

GitHub同步必须核对远程提交和默认分支内容，不能把本地commit或模拟通过当作上传成功。
