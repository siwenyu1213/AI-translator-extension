# 说文 · LingoClarify 开发、运行与验收

当前扩展版本 **4.6.0**。用户功能和文件职责见 [README](../README.md)。本手册描述现有入口与验收方法；交接材料和逐次任务QA、审查、环境记录仅本地保存，不随GitHub分发。

## 环境与目录

原生JavaScript / HTML / CSS的Manifest V3扩展，根目录直接加载，不需要构建、开发服务器或npm安装。Marked与DOMPurify固定版本保存在 `vendor/`，不能在运行时加载CDN脚本；来源和许可证见 [vendor说明](../vendor/README.md)。

运行需要支持MV3的Edge；静态与模拟使用Node.js，版本管理使用Git。浏览器工具使用本机已有Playwright，不给扩展新增运行依赖。Chrome及其他浏览器需另行验收。

| 路径 | 用途 |
| --- | --- |
| 根目录、`vendor/` | 运行源码、本地依赖与许可证 |
| `scripts/` | 可复用验证工具 |
| `docs/DEVELOPMENT.md` | 公开开发说明与必要验收摘要 |
| `docs/materials/` | 有来源说明的公开、合成材料 |
| `.local/materials/` | 私有网页样本、逐次任务记录及交接材料 |
| `.local/tmp/` | 一次性脚本、缓存、下载 |
| `.local/browser-profile/` | 隔离浏览器配置 |
| `artifacts/qa/`、`artifacts/releases/` | 生成证据与分发产物，不进入Git |

克隆后进入包含 `manifest.json` 的仓库根目录，例如：

```powershell
Set-Location -LiteralPath '<本机仓库目录>'
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
- 全文工具栏内部的 `ds-tb-panel` 可隐藏，右上角 `ds-tb-reopen` 提供恢复入口；仅切换 DOM 可见性并转移按钮焦点，任务、进度与主题同步继续运行。隐藏状态再次注入时只打开当前工具栏；取消移除整个入口，新启动默认展开，不保存全局偏好。

划词本地分类选择单项任务，以统一system要求和JSON材料发送一次生成。外语完整句段用翻译连接，其余解释用解释连接；“解释此句”使用解读任务。所在句及必要材料有预算，回答仍为Markdown正文。全文纯译文和批量ID协议独立。

设置在 `chrome.storage.local`。Key与账号模型缓存位于 `providerConnections`；`AIConfig.connectionFor`选择实际连接。custom缺地址在请求前停止，改地址清除关联型号与缓存。迁移字段属于兼容实现。

DeepSeek官方hostname精确匹配后，分别读取 `explainDeepSeekThinkingEnabled` / `translateDeepSeekThinkingEnabled`，显式发送 `thinking.enabled/disabled`。默认关闭；关闭时归一化该用途的深度思考为false、不发送 `reasoning_effort`。打开总开关后，原 `*ThinkingEnabled` 控制是否发送强度。两层开关均纳入请求缓存与配置失效判断；第三方网关不凭模型名套用。

设置页共用“划词触发方式”位于两面板的思考强度区域下方，保存 `triggerMode: auto/contextMenu`；已有网页通过storage变化即时更新。原生选区菜单始终注册，两种模式均可点击。

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
| 划词触发方式、DeepSeek两层开关/保存/端口参数与失败反馈 | `scripts/verify-settings-controls.mjs` |
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
| 全文进度栏隐藏/打开、继续翻译、动态计数、键盘及主题/窄屏 | `scripts/verify-fullpage-toolbar.mjs --playwright '<已有包目录>'` |
| 换址、Key草稿、迟到响应和型号过滤 | `scripts/verify-adversarial-config.mjs` |
| 后台时序与配置读取 | `node scripts/verify-adversarial-background.mjs` |

浏览器工具需传入已有包目录：

```powershell
node scripts/verify-markdown.mjs --playwright '<已安装的 playwright 包目录>'
node scripts/verify-tooltip-position.mjs --playwright '<已安装的 playwright 包目录>'
```

传入本机实际安装的Playwright包目录，不依赖维护者的个人路径。默认使用Edge；支持 `--edge` 的工具可指定可执行文件。普通回归不要加旧源码对照参数，只有验证特定缺陷时根据工具源码中的参数说明使用 `--ref` 或 `--expect-vulnerable`。

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

必要的可复查摘要集中在本手册记录日期/时区、基线/待提交范围、工具版本、步骤/预期/实际、报告路径和未验证项；逐次详细记录放 `.local/materials/`，报告和截图放 `artifacts/qa/`。根目录的 `交接.md`、除本手册外的 `docs/*.md` 历史记录以及 `vendor/**/*.map` 由 `.gitignore` 排除；本机保留的旧记录可继续查阅，新克隆不包含这些文件。

主题与设置回归传入 `--playwright`，只使用隔离profile、合成Key和本机SSE。清单的 web_accessible_resources 仅公开注入界面需要的本地图标和字体，静态工具逐一检查这些资源存在。原生系统右键菜单的鼠标点击需人工补验。

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

## 2026-10-16 全文进度栏隐藏/打开验收

北京时间2026-10-16，基线 `84ffd62`，复用干净的 `codex/tooltip-header-cleanup`；fetch 后当前分支比上游领先1个本地回退提交，没有落后。待提交范围为 `content-fullpage.js`、`content.css`、`scripts/verify-fullpage-toolbar.mjs`、README 与本手册；本地 `Description.md` 同步维护但忽略、不提交。版本仍为4.6.0，本次不发布或推送。

工具为Edge 155.0.4283.45、Node v24.18.1、Playwright 1.62.1。隔离profile加载真实解压扩展，通过扩展消息启动合成网页全文翻译，真实后台端口请求本机SSE：进行中点击“隐藏”，确认顶部栏收起且焦点移至右上角恢复按钮；隐藏期间等待完成并新增动态文字，再用点击/Enter/Space重新打开，确认最新计数、原文切换、取消恢复及新任务默认展开。再次触发隐藏的全文任务仅打开现有进度，不重新发请求。三主题及260px/390px控件边界和实际配色均验证，10项定向检查通过；18项既有对抗浏览器回归及3项对照、50项静态与diff空白检查通过。

定向报告与截图为 `artifacts/qa/fullpage-toolbar/report.json` 及同目录PNG，既有回归为 `artifacts/qa/adversarial-fix-2026-10-11/browser/results.json`（以报告内2026-10-16时间为准），静态报告为 `artifacts/qa/static-check.json`；详细记录在 `.local/materials/fullpage-toolbar-2026-10-16.md`。已查看展开、隐藏及窄屏截图，测试浏览器和本机服务已关闭，隔离profile保留。未验证真实供应商生成与原生右键菜单的鼠标点击；合成响应不证明模型质量或速度。

## 2026-10-13 最小上传整理验收

基线 `16a4992`，当前任务分支与 `origin/main` 一致且工作区干净。停止跟踪27个文件：交接1份、历史任务记录24份、第三方调试source map 2份；原文件仍完整保留在本机。上传清单83→56个文件，运行源码、清单、图标、字体、第三方脚本与许可证、可复用验证工具均未修改，扩展版本保持4.6.0。

使用Node v24.18.1、Git 2.55.0.windows.3核验：本机静态49项通过；仅复制上传清单得到的独立目录静态49项通过；50个保留文件与基线Git内容一致；27个本地材料内容一致且已忽略；公开文档10个本地链接均指向上传文件；diff空白检查通过。详细本机证据为 `artifacts/qa/minimal-upload-2026-10-13/audit.json`，精简目录报告为该目录下的 `upload-snapshot-static.json`。本轮只整理跟踪范围与文档，未重新执行Edge交互或真实供应商请求；静态结果不表示这些功能已重新验收。
