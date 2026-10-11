# 开发、运行与验收

## 环境与目录

这是直接加载的 Manifest V3 浏览器扩展，没有开发服务器、打包流程或 npm 依赖。扩展运行需要支持 MV3 的 Edge / Chrome；静态检查需要 Node.js，版本管理需要 Git。当前机器已核实的版本和起始状态见 [WORK_ENVIRONMENT.md](WORK_ENVIRONMENT.md)。

当前使用说明见 [README.md](../README.md)，2026-10-11 项目状态、分支分叉、功能与验收边界见 [交接.md](../交接.md)。交接文档为接手快照，实时 Git 状态仍需在任务开始核实。

2026-10-11 两个子 agent 的版本残留与逻辑对抗式审查见 [ADVERSARIAL_REVIEW.md](ADVERSARIAL_REVIEW.md)，包含未修复发现、源码定位、可复现证据和验证边界。其模拟/页面样本结果不替代完整扩展或真实 API 验收。

在 PowerShell 中进入项目：

```powershell
Set-Location -LiteralPath 'C:\Users\siwen\Desktop\Workspace\工具\AI-translator-extension'
git status --short --branch
```

根目录继续放扩展运行文件。scripts/ 放可复用开发脚本；docs/ 放最终说明和验收摘要。docs/materials/ 可放公开原材料及来源记录；.local/materials/ 放私有材料，.local/tmp/ 放临时工作文件，.local/browser-profile/ 放隔离的浏览器配置。生成证据放 artifacts/qa/，分发产物放 artifacts/releases/。私有和生成目录不进入 Git。

## 静态检查

```powershell
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

检查脚本使用 Node.js 内置模块，无需 npm install，不联网，不调用供应商 API，不启动浏览器。退出码 0 表示脚本所列检查通过，非 0 表示失败。JSON 报告包含时间、工具版本、运行时检查对应的 HEAD、未提交文件状态及逐项结果。报告的 HEAD 是检查开始时的版本；若检查的是未提交修改，须结合 workingTree 记录判断范围。

检查覆盖：仓库源码中的 .js/.mjs 文件语法、Manifest V3 基本入口、manifest 声明的资源、popup.html 中的本地 JS/CSS 引用、background.js 中 files 字面量引用与 importScripts 本地共享脚本、设置页版本与 manifest 版本一致性。不完整校验 Manifest schema、HTML/CSS 渲染、chrome.* API、真实流式交互或供应商模型可用性。

## 加载与更新扩展

1. 打开 Edge 的 edge://extensions，开启开发人员模式。
2. 点击“加载解压缩的扩展”，选择项目根目录。
3. 打开设置页，选择厂家、填写并保存 Key，等待接口模型列表后选择模型并保存。自定义地址通过“配置自定义接口”弹窗输入；通用设置控件已隐藏，但保存值继续生效。
4. 修改源码或 git pull 后，在扩展管理页点击该扩展的重新加载按钮，并刷新已打开的测试网页，使旧内容脚本更新。
5. 检查扩展管理页的错误信息，必要时打开服务工作线程的开发者工具。

浏览器内部页面等受限制页面不能作为内容脚本功能的有效验收样本；使用普通 HTTP/HTTPS 测试网页。模型调用名及账号权限以实际供应商接口结果为准，仓库中的展示文字不能作为在线可用性证据。

## 功能验收清单

只要求覆盖本次修改影响的路径；整体发布时覆盖下列路径。每项记录通过、失败或未执行，不能统一推断为通过。

| 路径 | 最低验收内容 |
| --- | --- |
| 加载与设置 | 扩展成功加载、设置页显示正常、两个标签独立保存、重新打开后配置保留、无相关浏览器报错 |
| 模型列表 | 仅当前接口/厂家的文本型号；无 Key、非文本/其他厂家、有效空列表、失败缓存和中途换 Key；精简页不提供手动调用名入口 |
| 划词 | 自动和右键触发；外语短词/长段、中文短字/长段分类及对应输出；Esc 关闭 |
| 流式请求 | 文本逐步显示、完成状态正确；测试相关断网、无效 Key、取消或重载情况，记录实际错误处理 |
| 全文翻译 | 右键空白处启动、滚动新内容、原文/译文切换、取消恢复；检查链接/图片及页面布局 |
| 复制与下载 | 剪贴板内容、TXT 文件内容与浏览器实际下载位置 |
| 兼容接口 | 当前 Base URL + Bearer Key 的模型发现、真实模型、流式与失败路径；查询列表不等于生成已通过 |

可使用 .local/materials/ 下的样本，经本地 HTTP 服务访问；若需临时服务，从样本目录运行 python -m http.server 8765 --bind 127.0.0.1，并在验收后停止。浏览器自动化脚本会在 127.0.0.1 的随机端口启动临时样本和模拟 API，并在结束时停止。

## 证据与交付

每个完成点在 docs/ 中保存简短验收摘要：

```text
日期与时区：
检查时的提交及未提交范围：
Node / 浏览器版本：
变更目的：
运行或重新加载步骤：
已执行：命令或操作、预期、实际、退出码/结果
证据：artifacts/qa/ 下报告、日志、截图的相对路径
未验证：项目、缺口、下一步需要什么
本地提交：提交号或通过 git log 查找的唯一提交主题
GitHub 状态：已推送 / 未推送
```

生成证据默认只保存在本机；需要向他人交付时附上已脱敏的证据文件或精简的可提交样本，不能仅提供一个他人无法访问的本机路径。

## 保存版本与同步

任务开始记下已有改动。新功能通常先从合适的基线创建分支，例如 git switch -c codex/feature-name。验证通过后检查并暂存明确文件，再提交：

```powershell
git diff --check
git diff
# 按任务列出具体文件，不使用全目录暂存
git add -- AGENTS.md docs/DEVELOPMENT.md
git diff --cached
git commit -m "docs: describe extension development workflow"
```

上述文件列表仅为示例，实际提交须包含本任务的完整且准确范围。需要上传时按用户授权执行 git push；出现 PR 时先审核/验收、在 GitHub 合并，再在干净的本地 main 上执行 git pull --ff-only origin main。若本地 main 有自己的未推送提交，先比较两边历史再决定整合方式。

## 通用接口实现与回归工具

`config.js` 是后台与设置页共享配置入口：后台通过 `importScripts` 加载，设置页在 `popup.js` 前加载；两端先加载 `model-catalog.js`。它负责默认值、模型列表、Base URL 归一化以及 v3→v4 的一次性迁移。更新时同步 `manifest.json` 与 `popup.html` 的版本显示。

无需任何第三方依赖的后台模拟回归：

```powershell
node scripts/verify-api.mjs
```

该脚本在 Node VM 中执行实际 `config.js` / `background.js`，模拟 chrome.storage 与网络响应。结果为 `artifacts/qa/api-simulation.json`，不代表浏览器或真实 API 已验收。

如果本机已经有 Playwright，可运行可选的实际 Edge 验收（不执行 npm install，不改变扩展运行依赖）：

```powershell
node scripts/verify-browser.mjs --playwright '<已安装的 playwright 包目录>'
# 自定义 Edge 可再加 --edge '<msedge.exe 绝对路径>'
# 检查样式简化是否改变界面，可再加 --compare-ref '<优化前提交>'
```

每轮在 `.local/browser-profile/api-qa/run-<时间戳>/` 创建新的独立 profile，避免旧 Worker 脚本缓存，并启动 headless Edge 加载本仓库实际扩展。脚本只写入合成测试 Key，刷新真实公开模型目录，启动本机模拟 HTTP API，检查设置持久化、消息、SSE、划词与全文恢复，并保存 `artifacts/qa/browser-check.json` 和截图。结束后关闭浏览器、核对绝对路径并删除仅本轮创建的 profile，报告 `profileCleanup`；删除失败使验收非零退出。它会重置这个专用 QA profile 中的扩展设置，不读取用户日常浏览器配置。`--compare-ref` 在首次 Key、Key 已保存、自定义 dialog 三种状态下比较当前和指定 Git 提交的完整计算样式及元素矩形，不改产品样式。

实际设置页在扩展页面中直接打开，划词通过页面 mouseup 路径触发，全文翻译通过真实后台 tabs 消息启动。原生工具栏弹出层及右键菜单鼠标操作仍需人工检查；真实供应商仍需使用其有效凭据检查成功、失败与模型能力。

## 厂家目录维护

`model-catalog.js` 内置从公开 `/api/v1/models` 取得的 10 家文本目录及获取时间，供两端共用；v4.2 首次快照有 210 款，数量随来源变化。动态刷新返回纯数据，使用白名单厂家与字段、长度/时间/模态检查；不加载远程 JavaScript，也不发送用户 API Key、Base URL、浏览器 storage 或网页数据。去重并按目录上架时间排序，不截断为 3 款；一家有 1 款也可正常更新，完全缺失则保留该厂家缓存。规范化缓存同样不截断。

后台 `REFRESH_MODEL_CATALOG` 消息协调并发刷新并保存 `catalogSnapshot`。设置页每次初始化都自动请求，即使上次刚更新也不跳过；没有手动刷新按钮、15 分钟节流、来源卡片或成功提示。先显示缓存，成功后静默更新；失败显示顶部红字，部分厂家未更新显示简短部分失败提示。选择和输入草稿在请求完成时保留；目录中下架的非选定、非手动、非接口模型从自动列表移除。v4.3 两个厂家选择器还决定各自连接；模型 ID 分别按对应地址及该厂家接口列表适配。当前接口返回的模型精确 ID 优先；公开目录无法证明某个网关或账号权限。

如果后台刷新消息无回复，或消息通道未建立/已断开，设置页调用同一份目录刷新逻辑并保存成功快照；后台明确返回的 HTTP/格式等失败不会被当成通信故障重试。恢复仍只访问公开目录，不读取或发送 Key，成功不显示反馈。底层仍区分连接、20 秒超时、HTTP 状态、非 JSON 和后台无效回复，技术原因记录为设置页控制台 warning，用户只看到简短红字。浏览器脚本通过模拟无回复与通道断开验证恢复，真实网络验证每次打开自动刷新；新增草稿保留、目录下架清理、部分失败提示、错误颜色以及重开后恢复静默等检查。历史原因见 [CATALOG_REFRESH_FIX.md](CATALOG_REFRESH_FIX.md)，当前验收见 [AUTO_MODEL_CATALOG_QA.md](AUTO_MODEL_CATALOG_QA.md)。

v4.0 已保存的配置通过 `modelCatalogVersion` 一次追加目录，不重复清 Key。`modelManufacturers` 记录自定义型号归属，`hiddenCatalogModels` 记录删除/修改的目录项，`availableModels` 记录当前接口返回的 ID；连接变更使当前接口列表失效。历史 v4.1 的最近三款记录见 [MANUFACTURER_MODELS_QA.md](MANUFACTURER_MODELS_QA.md)；v4.2 已取消这个数量限制。

## 厂家连接配置（v4.3）

`AIConfig.PROVIDER_ENDPOINTS` 固定 10 家官方兼容地址；厂家字段 `explainManufacturer` / `translateManufacturer` 显式决定路由，不根据模型名覆盖用户选择。`providerConnections` 按厂家记录 Key 与 `/models` ID，自定义额外记录可编辑 Base URL。`providerConfigVersion: 1` 表示新结构，读取时只做一次迁移：原地址匹配该厂家预设才交给该厂家，其他原连接保留为 custom，不借用全局 Key。旧顶层 `apiBaseUrl/apiKey/availableModels` 保留兼容存储，新后台请求读取 `connectionFor(config, kind)`。

设置页地址与 Key 随当前标签和厂家显示；切换前保留连接草稿，保存设置时写入各厂家的连接。官方地址只读，所有自定义/网关地址须选择 custom；厂家地址即使被改写到 storage，也由固定预设还原。改变地址或 Key 仅使该连接的接口列表失效。查询/检测完成时检查厂家、标签、地址和 Key 是否仍一致，期间切换则不写入返回结果。后台解释和 A/C/D 分类读取解释连接，B 分类及全文 STREAM_BATCH 读取翻译连接，缺少该厂家 Key 时不发请求。

验证新增 10 家地址联动、独立 Key 恢复、旧网关迁移、厂家路由、未配置拦截与异步切换处理。浏览器内官方域名请求由 Worker fetch 模拟拦截，仅核对路由/消息/SSE，不向供应商发送合成 Key。真实公开目录仍联网；本机模拟接口继续验证完整划词与全文路径。端点来源、地域和真实凭据缺口见 [PROVIDER_ENDPOINTS_QA.md](PROVIDER_ENDPOINTS_QA.md)。

## 精简设置与接口开放列表（v4.4）

窗口移除调用名编辑/新增/删除、通用控件和常驻 API 地址；通用配置仍取读取时的保存值，首次默认启用扩展、使用上下文与自动触发。Key 保存后输入区隐藏，只留重填按钮，取消重填从已保存连接恢复，空输入不会清除旧 Key。官方地址自动匹配，自定义地址只在单独 dialog 中编辑。

`usePageContext` 隐藏后仍沿用旧值，不强制开启。划词 `getPageContext` 通常取选区前后各最多 300 字符，并为部分提示词提供页面标题；无块级容器时可能取页面前 800 字符，不包含网页地址。全文脚本不采用划词前后文：逐块 `buildTranslatePrompt` 没有 before/after 时不加入上下文，批量 `buildBatchTranslatePrompt` 使用标题，但不读取 url。这些行为以源码为准，真实账号保存偏好需在其浏览器中确认。

`LIST_MODELS` 保留原 IDs，并增加过滤后的 `entries`（ID/名称）；有效空列表也是成功结果。`AIModelCatalog.interfaceModels` 排除重复、非法 ID、明确非文本模态/过期和常见嵌入/图像/音频等用途，按型号归属筛当前厂家；自定义接受该接口的文本型号。字段不完整时采用名称规则，不能据此证明 Chat Completions 的全部能力。

`providerConnections` 新增 `modelEntries` / `modelsCheckedAt`。首次无 Key 无列表时禁用下拉并提示填写 Key；不从公开目录、历史兼容或全局保存列表补入选项。每次打开、切换已配置厂家和保存 Key/设置时，`refreshProviderModels` 查询对应接口，保存独立缓存；公开目录仅辅助展示名。请求按厂家及地址/Key 去重，旧请求晚返回不覆盖新连接；失败显示简短红字并保留相同连接缓存，换 Key/地址使旧缓存失效。完整 Key 不出现在错误或证据中。

接口已确认列表外的模型由后台拒绝；空模型保持空，不回填全局预设。成功空列表会清除旧选项；若当前型号不再开放，更新已保存用途为列表首项或空值。没有 `/models` 且无缓存的服务在精简页不能新选型号，手动调用名入口已按用户要求隐藏。旧模型 ID、厂家归属和其他配置仍保存在 storage。

浏览器验证使用明确的厂家模型响应模拟（包括其他厂家/非文本、空列表、503、迟到旧请求）及本机真实 HTTP 流，公开目录真实联网；不向厂商发送合成 Key。当前证据见 [COMPACT_SETTINGS_QA.md](COMPACT_SETTINGS_QA.md)。

### v4.4 模型查询失败修复

`AIModelCatalog.fetchInterface(connection)` 是后台 `listModels` 和设置页通信恢复共用的账号列表查询。使用同一归一化地址和 Bearer Key，请求禁用缓存；网络或 5xx 最多重试一次，两个尝试共用 20 秒 AbortSignal。401/402/403/404/429、超时、非法 JSON/data 分别返回固定 `code` 和必要 HTTP `status`，不回显服务端正文、Key 或底层异常。

`requestProviderModels` 在 `LIST_MODELS` 无回复或通道未建立/已断开时直接调用共享查询。后台明确返回的 API 错误不触发此恢复，避免把鉴权失败当作通信问题。顶部根据错误类型显示简短原因，有旧缓存时追加保留提示；控制台只记录厂家 ID、错误代码和 HTTP 状态。原有连接签名检查、独立缓存、成功静默和 Key 收起继续生效。

浏览器工具另用不带凭据的实际 DeepSeek `/models` 请求检查 Edge Worker 到官方域名的连通性，预期 401。这只能证明测试 profile 当时的网络可达与鉴权入口，不能判断用户 Key 的有效性；日常 profile 的代理/网络也可能不同。列表成功、权限、生成仍使用明确模拟或本机 HTTP 样本。修复证据与未确认的用户失败原因见 [COMPACT_SETTINGS_QA.md](COMPACT_SETTINGS_QA.md)。

## 保持行为的维护与清理

`AIConfig.load` 按字段比较归一化前后的值，仅写变化字段，避免顶层键顺序变化导致全量重写；旧配置字段仍按原规则移除。`popup.js` 的两种模型查询共用 `queryWithFallback`，保留无回复/通信故障才恢复、明确接口错误不绕过的规则。全文翻译用 `visitDirectTextNodes` 保持读取/落盘范围一致，取消和重新开始共用 `restoreOriginalBlocks`，不改变标签过滤与恢复顺序。

内置目录采用每款模型一行的格式，保留完整对象、顺序及所有元数据；修改这类静态数据格式时先与旧版本深度比较，不能用格式压缩删减型号。未引用函数和已移除控件样式可清除，当前 DOM 状态需做实际浏览器对比。

任务结束仅清理该会话生成的临时脚本、独立 QA profiles 和过期生成证据；保留最新机器报告、关键截图、可复用工具及历史文档。旧验收文档所列生成文件可能已清理，保留的摘要是历史记录，当前证据以最新报告为准。2026-10-10 审查、验证与完整清理结果见 [MAINTENANCE_QA.md](MAINTENANCE_QA.md)。

## 与 main 整合后的全文翻译与划词

2026-10-11 整合 `origin/main` 的 PR #8 修复，保留 v4.4 设置和最小通用 API 参数。`STREAM_TRANSLATE_BATCH` 通过共享 `handleStreamRequest` 使用翻译标签的厂家连接，按块 ID 解析；缺项、重复/未知 ID 或流错误触发前端逐块回退，无效结果不缓存。生成网络/429/5xx 最多退避重试三次，等待期间取消立即生效；账号模型列表仍使用原有最多重试一次、20 秒规则。

全文采用最多 50 个并发批量请求，每批最多 8 个相邻块、合计最多 3500 字符；单个长块单独处理。原文保存文本节点引用和值，原文/译文切换与取消不重建 innerHTML；会话 ID 隔离取消/重新开始后的旧端口及队列结算。浏览器工具验证真正批量成功、乱序 ID、格式错误回退、节点引用保留、请求途中显示原文及取消重启；这些结果使用本机模拟 API。

划词采用帧播放队列，单条消息最多 2048 字符，兼容返回的 reasoning_content。点击卡片内部、鼠标移出或选区折叠不误关，点击外部/Esc 可关闭；当前端口检查防止旧流更新新卡片。验证与整合取舍见 [MERGE_CONFLICT_QA.md](MERGE_CONFLICT_QA.md)。
