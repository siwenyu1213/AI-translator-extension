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

设置页首选390px宽，高度随内容自然增减；主页面无可见滚动条，受限视口仍支持滚轮和键盘访问底部操作。自绘菜单长列表独立滚动。

## 当前调用关系

- 后台加载 `model-catalog.js`、`config.js`、`selection.js`、`selection-prompts.js`；只使用选区模块的无DOM分析。
- 自动内容注入：`theme.js` → `selection.js` → Marked → DOMPurify → `markdown.js` → `content.js`，样式为 `theme.css`、`content.css`。
- 设置页加载 `model-catalog.js`、`config.js`、`theme.js`、`popup.js`、`select-menu.js`，共用配置与查询逻辑。外观模块独立保存 `uiTheme`，只更新扩展根元素，默认纸本文笺；cobalt/playful/vellum分别对应纸本文笺、清浅青、冷灰蓝，三配色共用词典布局，字体本地打包。
- 全文由后台按需注入 `content-fullpage.js`，通过端口取得单条或批量结果。
- 全文工具栏桌面宽度为视口的约三分之一、水平居中，窄屏最小宽度受视口限制。下方单个 `ds-tb-toggle` 方框箭头控制 `ds-tb-panel` 整体收起/展开，按钮持续保留且焦点不变；收起内容设为inert并从辅助技术隐藏。180ms收起/浮现动画遵从减少动画偏好，任务、进度与主题继续运行。隐藏状态再次注入时只打开当前工具栏；取消移除整个入口，新启动默认展开，不保存全局偏好。

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

北京时间2026-10-16，首版基线 `84ffd62`，完成本地提交 `1c1f242` 后按用户要求改用栏下方的单个方框箭头、取消文字入口，并将进度栏收窄为居中约三分之一。复用干净的 `codex/tooltip-header-cleanup`，fetch后当前分支比上游领先2个提交，没有落后。本次范围为 `content-fullpage.js`、`content.css`、`scripts/verify-fullpage-toolbar.mjs`、README 与本手册；本地 `Description.md` 同步维护但忽略、不提交。版本仍为4.6.0，不发布或推送。

工具为Edge 155.0.4283.45、Node v24.18.1、Playwright 1.62.1。隔离profile加载真实解压扩展，通过扩展消息启动合成网页全文翻译，真实后台端口请求本机SSE：点击栏下方方框箭头，确认整栏收起且焦点保留，只有向下箭头可见；隐藏期间等待完成并新增动态文字，再用点击/Enter/Space展开，确认最新计数、原文切换、取消恢复及新任务默认展开。再次触发隐藏的全文任务仅打开现有进度，不重新发请求。三主题及260px/390px控件边界和实际配色、1000px/1440px/1920px视口居中与精确三分之一宽度、减少动画偏好及收起控件不可聚焦均验证。11项定向检查通过；18项既有对抗浏览器回归及3项对照、50项静态与diff空白检查通过。

本版定向报告与截图为 `artifacts/qa/fullpage-toolbar-arrow/report.json` 及同目录PNG，首版历史证据保留在 `artifacts/qa/fullpage-toolbar/`。既有回归为 `artifacts/qa/adversarial-fix-2026-10-11/browser/results.json`（以报告内2026-10-16时间为准），静态报告为 `artifacts/qa/static-check.json`；详细记录在 `.local/materials/fullpage-toolbar-2026-10-16.md`。已查看展开、隐藏及窄屏截图，测试浏览器和本机服务已关闭，隔离profile保留。未验证真实供应商生成与原生右键菜单的鼠标点击；合成响应不证明模型质量或速度。

2026-10-16 箭头外观微调：基线 `21bdcf9`，用户要求缩小边框；仅将按钮32×32px改为24×20px、SVG18px改为14px，圆角4px，边框按主题减淡，阴影缩为1px/3px。同步既有验证脚本的尺寸与证据目录，真实Edge155.0.4283.45/Node24.18.1/Playwright1.62.1的11项定向检查及50项静态、diff检查通过；已查看局部、窄屏及收起截图。新证据 `artifacts/qa/fullpage-toolbar-compact/report.json`、`toolbar-detail.png`，此前证据保留。本轮仅样式微调，未重复执行上一段的18项广泛回归或真实供应商/原生右键鼠标验收；测试浏览器与服务已关闭。Description同步但不提交，版本保持4.6.0，仅本地保存。

2026-10-16 文字按钮精简：基线 `6610767`，将“显示原文/译文”和“取消翻译”按钮由最小32px高改为26px，水平内边距10→8px，显式内容宽度、禁止flex拉伸、文字水平/垂直居中，清除网页可能施加的最小宽度和缩进。既有定向工具加入合成网页button宽190px、flex拉伸及左对齐干扰，利用真实Range检查文字与按钮中心偏差，三主题均通过。Edge155.0.4283.45、Node24.18.1、Playwright1.62.1下11项定向、50静态和diff检查通过，已查看 `artifacts/qa/fullpage-toolbar-buttons/toolbar-detail.png`；报告为同目录 `report.json`。浏览器及服务已关闭；真实供应商、原生右键鼠标及18项广泛回归本轮未重复执行。仅本地提交，不推送，Description继续本地忽略。

## 2026-10-13 最小上传整理验收

基线 `16a4992`，当前任务分支与 `origin/main` 一致且工作区干净。停止跟踪27个文件：交接1份、历史任务记录24份、第三方调试source map 2份；原文件仍完整保留在本机。上传清单83→56个文件，运行源码、清单、图标、字体、第三方脚本与许可证、可复用验证工具均未修改，扩展版本保持4.6.0。

使用Node v24.18.1、Git 2.55.0.windows.3核验：本机静态49项通过；仅复制上传清单得到的独立目录静态49项通过；50个保留文件与基线Git内容一致；27个本地材料内容一致且已忽略；公开文档10个本地链接均指向上传文件；diff空白检查通过。详细本机证据为 `artifacts/qa/minimal-upload-2026-10-13/audit.json`，精简目录报告为该目录下的 `upload-snapshot-static.json`。本轮只整理跟踪范围与文档，未重新执行Edge交互或真实供应商请求；静态结果不表示这些功能已重新验收。

## 2026-10-16 三方向 UI 对比

基线为d680413，创建分支codex/ui-reading-redesign；本轮实现澄净阅读、纸本文笺、精密工具三个可切换方案。uiTheme仍使用cobalt/playful/vellum，已有配置沿用原标识；三套新外观均为浅色。设置页采用分段标签、开关控件和更清晰的字段层级，纸本方向使用宋体标题与页签，工具方向使用更紧凑的布局。theme.css统一配色、划词批注、Markdown标题和全文工具栏轮廓；popup.css负责各方向设置布局，沿用390px首选宽度、510px内部滚动及340/260px断点。本轮未改变请求或配置协议，未发布版本，仍为4.6.0。

设计参考用户提供的[Anthropic frontend-design指南](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)，预览与设计取舍记录仅本地存于.local/materials/ui-reading-redesign/。主题与全文工具栏验证工具新增可选--output以保留各轮证据，并同步当前配色断言；公开README截图更新为默认澄净阅读的合成材料。

北京时间2026-10-16，以Edge155.0.4283.45、Node24.18.1、Playwright1.62.1完成19项主题检查、17项定位拖动检查、11项全文工具栏检查及50项静态检查；git diff --check通过。主题检查涵盖即时同步、保存重开、草稿隔离、文字对比度、本地字体、键盘、实际标签页150/200%缩放、三方向260/320/390px及自定义地址弹窗，确认高度上限与所有关键控件可滚动访问。全部使用隔离profile、合成Key及本机SSE，不代表真实模型效果。报告分别为artifacts/qa/ui-reading-redesign/report.json、artifacts/qa/tooltip-header-2026-10-13/report.json（按报告内本轮时间）、artifacts/qa/ui-reading-redesign/toolbar/report.json、artifacts/qa/static-check.json；对比截图为ui-reading-redesign/compare-settings.png及compare-results.png。

原生Edge中chrome.action.openPopup调用成功，但Computer Use无法可靠识别当前浏览器URL，按策略停止窗口截图检查；因此原生弹出层视觉尺寸、真实供应商、原生右键鼠标操作和其他浏览器仍未验证。验收浏览器与本机服务已关闭，profile保留。工作区中原有及并行产生的流式播放修改继续保留，不纳入本次UI提交；Description.md已同步、继续本地忽略。

## 2026-10-16 第二轮结构排版原型

用户反馈第一轮布局区别不足，因此在codex/ui-reading-redesign的a2e788f上新增可复用的scripts/build-ui-layout-preview.mjs，以原生HTML/CSS/JS生成三种独立结构：侧栏工作台（侧向用途导航与连接主区）、双页词典（题签、词条、边注）、阅读控制台（语言舞台与上下衔接操作区）。这些是使用示例配置的交互原型，尚未替换根目录扩展UI；不读写chrome.storage、不请求模型、不保存Key，不改变扩展版本或运行依赖。

执行 `node scripts/build-ui-layout-preview.mjs`，默认输出到`.local/materials/ui-layout-round2/`，并更新第一轮预览入口`.local/materials/ui-reading-redesign/index.html`。首次更新前将原入口保存为同目录round1.html。可用`--output <目录>`指定单独原型输出目录；固定对比入口仍会更新。独立HTML与内嵌srcdoc对比页不依赖服务器、字体下载或外部库。按钮演示用途切换、键盘左右/Home/End、思考开关、连接dialog、取消/完成与保存提示；复制/下载仅展示反馈，没有实际剪贴板或下载行为。

北京时间2026-10-16，以Node24.18.1、Edge155.0.4283.45将新生成的自包含源字符串渲染到独立空白测试页面，完成对比页切换、三套用途/键盘/开关/弹窗/保存及260/320/390px边界检查；无脚本错误或外部请求。51项静态与git diff --check通过。证据为`artifacts/qa/ui-layout-round2/report.json`、`compare-settings.png`与`compare-results.png`；本轮不是扩展集成或真实API验收，不复用上轮19/17/11项结果作为新原型证据。浏览器工具因file协议限制拒绝读取用户现有标签页，因此没有操作该标签页；用户刷新原入口即可查看新原型。详细设计说明仅本地保存，根目录运行源码、并行流式修改和上轮公开截图保持原样，Description.md同步但不提交。

## 2026-10-16 选用词典式UI并精简说明

基线9b0c32f，复用codex/ui-reading-redesign。用户选定第二轮词典布局，并要求删除“当前用途·解释”“阅读设置”、将“模型连接”改为“当前模型”。本轮将所选布局接入根目录popup.html/popup.css及共享theme.css：大字题签、页签、厂家印记、当前模型、语言/触发行、底部保存；删去宣传语、重复型号/服务说明、Key编辑提示和主题保存成功小字，保留字段可访问标签、失败反馈、DeepSeek必要提示。结果浮层沿用纸页侧边与词条标题，移除底部重复模型/品牌署名。三配色共用词典布局，cobalt默认纸本文笺、playful清浅青、vellum冷灰蓝，存储标识不迁移。

popup.js仅将共用trigger-mode控件移动到当前用途的语言行，保留同一DOM控件和值，切换标签不会重置触发方式；主题保存成功静默，失败继续提示。DeepSeek层级、Key保存、供应商/模型查询与生成协议不变。更新原型生成器中的相关文字，当前本地入口改为所选界面的实际截图，旧三方案原型保留在.local/materials/ui-layout-round2/。扩展版本保持4.6.0。

北京时间2026-10-16，在隔离Edge155.0.4283.45、Node24.18.1、Playwright1.62.1中完成19项主题/布局、9项设置与DeepSeek端口、17项定位拖动、11项全文工具栏及51项静态检查，git diff --check通过。新增断言验证指定文案精简、共用触发控件随Tab移动且保留值；覆盖无Key初始态、两用途保存重开、开关联动、主题草稿隔离、错误、自定义接口dialog、260/320/390px、150/200%实际标签页缩放。200%时长型号曾差0.6px被裁切，已在260px以下调小字号并改为底部单列；复验通过。截图已目视复核，默认已配置状态的保存按钮完整位于510px窗口内；首次配置/展开更多字段仍可内部滚动。

证据为artifacts/qa/lexicon-ui/report.json、cobalt-settings.png、cobalt-result.png、同目录toolbar/report.json，以及artifacts/qa/settings-controls-2026-10-13/report.json和artifacts/qa/tooltip-header-2026-10-13/report.json（按报告内本轮HEAD/运行信息识别）。设置工具的date字符串为旧固定日期，以本段当轮记录为准。静态报告artifacts/qa/static-check.json。全部使用合成Key、本机接口与SSE，不证明真实供应商或模型效果。未操作用户现有file标签页；原生Edge工具栏弹出层视觉与原生右键鼠标仍未验收。测试浏览器和本机服务均已关闭；并行流式修改继续保留、不纳入本次提交，Description同步且本地忽略。

## 2026-10-16 模型下拉框去除重复焦点描边

基线db49d6f，复用codex/ui-reading-redesign。用户指出厂家菜单打开时出现额外绿色框；原因是popup.css通用:focus-visible在厂家容器1px边框外再次添加2px主题色outline。本轮仅对.model-pair内的select取消outline，覆盖解释/翻译两个用途的厂家与型号控件；原有容器边框和其他按钮/输入框焦点样式保留。

北京时间2026-10-16，在隔离Edge155.0.4283.45、Node24.18.1中用合成厂家/型号验证：重加旧规则时复现2px实线，修复后三配色×两用途×厂家/型号共12种状态均无额外outline，厂家原边框仍1px；保存按钮键盘焦点仍为实线。51项静态和git diff --check通过；报告及前后局部截图为artifacts/qa/model-focus/report.json、before.png、after.png，静态报告artifacts/qa/static-check.json。未执行真实供应商或原生工具栏窗口截图，本轮不重复整套功能回归。验收浏览器已关闭；仅本地提交UI小修，并行流式修改未纳入，Description.md同步且继续本地忽略，版本4.6.0。

## 2026-10-16 自绘下拉菜单与本地设计字体

基线3a485a3，复用codex/ui-reading-redesign。按用户要求替换灰色系统下拉列表，并移除界面中宋体/黑体等系统字体的显式指定。新增select-menu.js，在popup.js之后加载：原select继续承载配置与change事件，自绘按钮负责显示，popover列表提供选中勾选、悬停、高度限制、长列表搜索、上下/Home/End/Enter/Escape/Tab和点击外部关闭；原生select不参与鼠标和Tab操作。菜单监听原选项/禁用状态变化，厂家切换、异步列表、无型号、用途切换及主题写入失败继续同步。搜索框blur/change不会触发菜单重绘，避免点击搜索结果时选项被提前移除。新增scripts/verify-select-menu.mjs，可用--playwright和--output复验。

字体改为本地霞鹜文楷屏幕阅读版v1.522处理中文、Space Grotesk处理英文正文与菜单、Syne处理英文标题；设置、结果、全文工具栏共用字体变量。新wenkai-screen.woff2保留完整字库，来源/许可/哈希及机械转换方式见vendor/fonts/README.md和wenkai-OFL.txt；仅用于网页嵌入，无CDN或系统字体安装，不新增扩展运行依赖。制作时使用的fontTools仅在.local/tmp中。压缩资源12,761,284字节，原始TTF与制作工具不纳入提交；清单只新增字体可访问资源。原型生成器的字体也同步更新，版本仍4.6.0。

北京时间2026-10-16，Edge155.0.4283.45、Node24.18.1、Playwright1.62.1隔离配置下7组菜单/字体验收通过，包括实际点击、搜索空结果和过滤选择回写、保存重开、两用途、停用/异步型号、键盘退出、三配色×260/320/390px边界、滚动关闭。CDP实际字形证据确认中文标题与结果正文由LXGW WenKai Screen自定义字体渲染，英文型号由Space Grotesk自定义字体渲染。19主题（含150/200%标签页缩放）、9设置/DeepSeek、17拖动、11全文工具栏及54静态检查、git diff --check通过，测试浏览器/本机服务均已关闭。

本轮菜单报告与截图为artifacts/qa/select-menu/report.json、manufacturer-open.png、settings.png、result.png；主题与全文工具栏报告分别为同目录themes/report.json和toolbar/report.json；设置与拖动报告沿用各工具既有路径，以本轮HEAD/内容识别，设置工具日期字符串仍是旧常量。静态报告artifacts/qa/static-check.json。所有配置/模型及SSE均为合成，不证明真实供应商或模型质量；原生工具栏窗口视觉与其他浏览器仍未验收。当前本地预览与公开截图已更新，并行流式修改继续保留，Description同步且本地忽略。

## 2026-10-16 设置页按内容自适应高度

基线823160c，复用codex/ui-reading-redesign。按用户本轮要求，popup.css移除body的510px高度上限与container的510px最小高度，设置页随当前用途、思考强度和Key编辑内容自然增减。主页面滚动条隐藏；浏览器窗口空间受限时保留根页面滚轮与键盘滚动，底部保存仍可访问。此要求替代前述历史510px内部滚动约束，下拉菜单自己的长列表滚动继续保留。版本仍4.6.0。

北京时间2026-10-16，隔离Edge155.0.4283.45、Node24.18.1、Playwright1.62.1完成19项主题/布局、9项设置与DeepSeek模拟端口、7组菜单/字体、54项静态检查及git diff --check。自适应专项在390px宽度下测得合成配置收起高512.70px、展开思考强度与Key编辑高646.48px，收起恢复原高；420px受限视口验证滚轮、聚焦保存与逐个访问底部操作，260/320/390px及150/200%标签页缩放通过。窄屏断言允许不足1px的滚动坐标舍入差；未改动按钮布局。verify-settings-controls新增--output并使用实际运行时间记录证据。

报告为artifacts/qa/popup-auto-height/themes/report.json、settings/report.json、menus/report.json；截图themes/expanded.png、themes/translate.png和settings/deepseek-off.png，公开设置截图与本地预览已更新。全部使用合成配置/凭据与本机SSE；原生工具栏弹出层的最终尺寸、真实供应商及其他浏览器未验收。原生窗口的可用尺寸由浏览器决定。重新加载扩展后重开设置生效；本轮仅本地保存，已有流式改动不纳入提交，Description继续本地忽略。

## 2026-10-16 放大输出浮层的原文与回答字号

基线aad92fc，复用codex/ui-reading-redesign。用户以词典原型为参考，指出浮层原文字号过小。本轮仅在theme.css调整排版层级：原文由13px次要提示改为32px主题墨色词条标题，正文14→18px，h2为23px、h3为20px、其余小标题18px、代码12→15px；中文继续文楷屏幕版、英文继续本地Space/Syne。原文高度上限扩至min(124px,22vh)，长句换行并可独立滚动。保持原有定位、拖动、复制/下载与请求协议，版本4.6.0。

北京时间2026-10-16，以隔离Edge155.0.4283.45、Node24.18.1、Playwright1.62.1完成18项浮层检查及54项静态检查，git diff --check通过。原有选区避让、流式拖动、滚动/缩窗位置、关闭等17项继续通过；新增专项检查三配色×260/375/1000px，覆盖长中文原文、英文词条、正文/小标题/代码实际字号、内容无横向溢出、底部按钮在窗口内、宿主网页字体保持Arial。全部使用合成网页/Key和本机SSE，未验证真实供应商、其他浏览器与特殊网站样式。

证据artifacts/qa/result-type-scale/report.json、result.png及各配色/宽度截图；公开result截图和本地预览同步更新。verify-tooltip-position新增--output以独立保存证据。重新加载扩展并刷新网页后使用；仅本地保存，本轮不纳入原有流式源码与文档改动，Description同步且继续忽略。

## 2026-10-16 输出字号微调为28/14px

基线6f7c0a7，按用户要求将词条标题设为28px、正文设为14px。工作区已有标题28px及对应断言，本轮沿用并补齐正文14px与断言；其他现有流式修改保留。版本4.6.0。18项隔离Edge浮层检查（含三配色、长句/窄屏和拖动）与54项静态检查、git diff --check通过；合成配置/本机SSE，未验证真实供应商与其他浏览器。报告及截图artifacts/qa/result-type-28-14/，公开截图和本地预览同步，重新加载扩展并刷新网页生效，仅本地保存。
