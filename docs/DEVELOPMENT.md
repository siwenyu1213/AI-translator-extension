# 开发、运行与验收

## 环境与目录

这是直接加载的 Manifest V3 浏览器扩展，没有开发服务器、打包流程或 npm 安装步骤。Markdown解析及清理由本地vendor脚本提供，不从CDN执行代码。扩展运行需要支持 MV3 的 Edge / Chrome；静态检查需要 Node.js，版本管理需要 Git。当前机器已核实的版本和起始状态见 [WORK_ENVIRONMENT.md](WORK_ENVIRONMENT.md)。

当前使用说明见 [README.md](../README.md)，2026-10-11 项目状态、分支分叉、功能与验收边界见 [交接.md](../交接.md)。交接文档为接手快照，实时 Git 状态仍需在任务开始核实。

2026-10-11 修复源分支 `codex/verify-adversarial-findings` 的主分支合并入口为 [PR #10](https://github.com/siwenyu1213/AI-translator-extension/pull/10)。用户确认GitHub账号改名为 `siwenyu1213` 后，本仓库origin的fetch/push地址统一更新为 `https://github.com/siwenyu1213/AI-translator-extension.git`，并执行fetch确认可访问。PR #9/#10已合并，main中的准确提交与PR状态用fetch和gh查询核实。

2026-10-11 两个子 agent 的版本残留与逻辑对抗式审查见 [ADVERSARIAL_REVIEW.md](ADVERSARIAL_REVIEW.md)，包含未修复发现、源码定位、可复现证据和验证边界。其模拟/页面样本结果不替代完整扩展或真实 API 验收。

v4.6 Markdown浮层的两子agent对抗性审查与安全清理见 [MARKDOWN_ADVERSARIAL_REVIEW.md](MARKDOWN_ADVERSARIAL_REVIEW.md)：5项功能问题、全文观察器重复扫描、阅读/导出功能建议，以及移除28行无用代码后的差分与实际Edge回归。通过回归不表示所列未修复问题已解决。

这些问题随后已修复，见 [MARKDOWN_FIX_QA.md](MARKDOWN_FIX_QA.md)：25项实际Edge定向回归、13项旧提交负向对照、完整相关回归和剩余限制。`scripts/verify-markdown-fixes.mjs` 默认断言修复行为；加 `--ref eeb5ed6 --expect-vulnerable` 加载临时基线副本复现旧缺陷，不改当前Git工作区。生成证据在artifacts/qa/markdown-fix-2026-10-11/。

自定义接口缺少地址时曾回退到 OpenAI，修复及负向对照见 [CUSTOM_ENDPOINT_QA.md](CUSTOM_ENDPOINT_QA.md)。`scripts/verify-custom-endpoint.mjs` 执行64项Node VM和12项隔离Edge检查；`--node-only` 只运行离线部分，`--ref 4c1cc3b --expect-vulnerable` 用临时基线副本复现旧行为（64项VM和8项Edge），不切换或改写当前工作区。非本机请求全部拦截，仅本机HTTP接口接收合成Key；真实供应商生成未验收。生成报告和截图在 `artifacts/qa/custom-endpoint-2026-10-11/`，运行方法见对应验收文档。

随后在 `codex/verify-adversarial-findings` 的实际扩展复现见 [ADVERSARIAL_VALIDATION.md](ADVERSARIAL_VALIDATION.md)，修复和最新回归见 [ADVERSARIAL_FIX_QA.md](ADVERSARIAL_FIX_QA.md)。三个 adversarial 工具当前默认断言修复行为，退出0表示所列回归通过；历史缺陷复现脚本保存在提交 `bfb3f65`，旧证据不覆盖。browser/config 使用已有 Playwright、隔离 Edge profile 和本机合成接口；background 提供离线时序对照，也支持在旧源码上使用 `--expect-vulnerable`。profiles 每轮独立且保留，浏览器与服务器结束时关闭。

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

2026-10-12 `codex/deepseek-thinking-off` 试用分支：规范化端点的hostname精确等于`api.deepseek.com`时，后台在缓存键计算前把有效thinkingEnabled设为false，请求显式发送`thinking: { type: 'disabled' }`且省略reasoning_effort。不写入/重置已有思考设置，设置页提示该分支覆盖开关；模型名不用于判定厂家，其他域名和第三方网关保持原参数行为。包括划词、旧解释、解释此句及全文单条/批量共用路径。离线工具新增32组官方地址/开关/路由组合及4组非官方端点对照；实际Edge工具新增真实扩展端口检查和设置提示检查。试用方法、保留证据及真实API边界见 [DEEPSEEK_THINKING_OFF_QA.md](DEEPSEEK_THINKING_OFF_QA.md)。

2026-10-13 从该分支的 `655bb12` 新建 `codex/local-classified-prompts`，保留官方 DeepSeek 显式关闭思考，重写划词提示词及本地材料选择。此前试用分支保留；当前任务没有恢复接口默认思考、改动原有保存值或增加分类请求。新设计与验证边界见 [LOCAL_CLASSIFIED_PROMPTS_QA.md](LOCAL_CLASSIFIED_PROMPTS_QA.md)。

同日按用户授权，将 `codex/local-classified-prompts` 的 `c0db5ee` 合入已更新到 `9eec6f4` 的 `main`，无冲突。整合包含浮层拖动、提示词风格、DeepSeek关闭思考和本地分类四个提交；设置提示改为当前版本行为。主分支保护与有效rulesets经GitHub API核验后，使用普通推送保留历史，不强推。合并复核和证据见上述验收文档末节。

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

`AIConfig.endpointFor(provider, entry)` 是后台归一化/生成与设置页查询共用的地址选择入口：官方厂家返回固定预设，自定义只接受自身非空字符串地址，不回退到默认地址。`connectionFor` 在自定义地址缺失时抛出配置错误，所有生成路径在fetch前停止；设置页禁用该连接的型号选择并停止后台/直接查询。迁移已有v4配置时不为缺地址的Key猜厂家；新安装默认OpenAI和旧v3清除未知专用Key的行为保留。无法从历史存储中的明确OpenAI地址判断它是用户填写还是旧代码回填，因此保留该值并提示用户核对。

设置页地址与 Key 随当前标签和厂家显示；切换前保留连接草稿，保存设置时写入各厂家的连接。官方地址只读，所有自定义/网关地址须选择 custom；厂家地址即使被改写到 storage，也由固定预设还原。保存新自定义地址在同一次 storage.set 中清除该连接列表和使用 custom 的已保存型号，地址保存使用持久化 Key，不顺带保存 Key 草稿。查询/检测完成时检查厂家、标签、地址和 Key 是否仍一致，期间切换则不写入返回结果。后台解释和 A/C/D 分类读取解释连接，B 分类及全文 STREAM_BATCH 读取翻译连接，缺少该厂家 Key 时不发请求。

验证新增 10 家地址联动、独立 Key 恢复、旧网关迁移、厂家路由、未配置拦截与异步切换处理。浏览器内官方域名请求由 Worker fetch 模拟拦截，仅核对路由/消息/SSE，不向供应商发送合成 Key。真实公开目录仍联网；本机模拟接口继续验证完整划词与全文路径。端点来源、地域和真实凭据缺口见 [PROVIDER_ENDPOINTS_QA.md](PROVIDER_ENDPOINTS_QA.md)。

## 精简设置与接口开放列表（v4.4）

窗口移除调用名编辑/新增/删除、通用控件和常驻 API 地址；通用配置仍取读取时的保存值，首次默认启用扩展、使用上下文与自动触发。Key 保存后输入区隐藏，只留重填按钮，取消重填从已保存连接恢复，空输入不会清除旧 Key。官方地址自动匹配，自定义地址只在单独 dialog 中编辑。

`usePageContext` 隐藏后仍沿用旧值，不强制开启。划词由 `selection.js` 保存真实 Range，按 1500/2500 字符预算选取所在句及必要材料，长选区额外预算800；后台再限制补充材料最多3000字符。当前本地分类与上下文取舍见下文2026-10-13章节。相同文本按位置和上下文区分；右键与解释按钮复用快照。无法确认选区时只处理文字，不搜索猜位置；不发送网页地址。全文脚本不采用划词前后文：单条 `buildTranslatePrompt` 没有 before/after 时不加入上下文，批量 `buildBatchTranslatePrompt` 使用标题，但不读取 url。旧停用值继续保留，但设置页提供仅停用时可见的启用按钮。

`LIST_MODELS` 保留原 IDs，并增加过滤后的 `entries`（ID/名称）；有效空列表也是成功结果。`AIModelCatalog.interfaceModels` 排除重复、非法 ID、明确非文本模态/过期和常见嵌入/图像/音频等用途，按型号归属筛当前厂家；自定义接受该接口的文本型号。字段不完整时采用名称规则，不能据此证明 Chat Completions 的全部能力。

`providerConnections` 新增 `modelEntries` / `modelsCheckedAt`。首次无 Key 无列表时禁用下拉并提示填写 Key；不从公开目录、历史兼容或全局保存列表补入选项。每次打开、切换已配置厂家和保存 Key/设置时，`refreshProviderModels` 查询对应接口，保存独立缓存；公开目录仅辅助展示名。请求按厂家及地址/Key 去重，旧请求晚返回不覆盖新连接；失败显示简短红字并保留相同连接缓存，换 Key/地址使旧缓存失效。完整 Key 不出现在错误或证据中。

接口已确认列表外的模型由后台拒绝；空模型保持空，不回填全局预设。成功空列表会清除旧选项；若当前型号不再开放，更新已保存用途为列表首项或空值。没有 `/models` 且无缓存的服务在精简页不能新选型号，手动调用名入口已按用户要求隐藏。旧模型 ID、厂家归属和其他配置仍保存在 storage。

浏览器验证使用明确的厂家模型响应模拟（包括其他厂家/非文本、空列表、503、迟到旧请求）及本机真实 HTTP 流，公开目录真实联网；不向厂商发送合成 Key。当前证据见 [COMPACT_SETTINGS_QA.md](COMPACT_SETTINGS_QA.md)。

### v4.4 模型查询失败修复

`AIModelCatalog.fetchInterface(connection)` 是后台 `listModels` 和设置页通信恢复共用的账号列表查询。使用同一归一化地址和 Bearer Key，请求禁用缓存；网络或 5xx 最多重试一次，两个尝试共用 20 秒 AbortSignal。401/402/403/404/429、超时、非法 JSON/data 分别返回固定 `code` 和必要 HTTP `status`，不回显服务端正文、Key 或底层异常。

`requestProviderModels` 在 `LIST_MODELS` 无回复或通道未建立/已断开时直接调用共享查询。后台明确返回的 API 错误不触发此恢复，避免把鉴权失败当作通信问题。顶部根据错误类型显示简短原因，有旧缓存时追加保留提示；控制台只记录厂家 ID、错误代码和 HTTP 状态。原有连接签名检查、独立缓存、成功静默和 Key 收起继续生效。

浏览器工具另用不带凭据的实际 DeepSeek `/models` 请求检查 Edge Worker 到官方域名的连通性，预期 401。这只能证明测试 profile 当时的网络可达与鉴权入口，不能判断用户 Key 的有效性；日常 profile 的代理/网络也可能不同。列表成功、权限、生成仍使用明确模拟或本机 HTTP 样本。修复证据与未确认的用户失败原因见 [COMPACT_SETTINGS_QA.md](COMPACT_SETTINGS_QA.md)。

## 保持行为的维护与清理

`AIConfig.load` 按字段比较归一化前后的值，仅写变化字段，避免顶层键顺序变化导致全量重写；旧配置字段仍按原规则移除。后台传入可选 `isCurrent`，失效读在迁移写入前返回 null 后重读；共享 pending 避免重复读。该机制不是跨上下文原子事务。`popup.js` 的两种模型查询共用 `queryWithFallback`，保留无回复/通信故障才恢复、明确接口错误不绕过的规则。2026-10-11 全文代码已重写为 Text 节点任务，旧块级遍历/首次节点覆盖/段首指示器不再使用。

内置目录采用每款模型一行的格式，保留完整对象、顺序及所有元数据；修改这类静态数据格式时先与旧版本深度比较，不能用格式压缩删减型号。未引用函数和已移除控件样式可清除，当前 DOM 状态需做实际浏览器对比。

任务结束仅清理该会话生成的临时脚本、独立 QA profiles 和过期生成证据；保留最新机器报告、关键截图、可复用工具及历史文档。旧验收文档所列生成文件可能已清理，保留的摘要是历史记录，当前证据以最新报告为准。2026-10-10 审查、验证与完整清理结果见 [MAINTENANCE_QA.md](MAINTENANCE_QA.md)。

## 与 main 整合后的全文翻译与划词

2026-10-11 整合 `origin/main` 的 PR #8 修复，保留 v4.4 设置和最小通用 API 参数。`STREAM_TRANSLATE_BATCH` 通过共享 `handleStreamRequest` 使用翻译标签的厂家连接，按块 ID 解析；缺项、重复/未知 ID 或流错误触发前端逐块回退，无效结果不缓存。生成网络/429/5xx 最多退避重试三次，等待期间取消立即生效；账号模型列表仍使用原有最多重试一次、20 秒规则。

上述 main 整合记录是历史基线。当前全文批量/回退共享最多 50 个实际端口请求配额，每批最多 8 个 Text 片段/3500 字符；长片段单独处理。任务 Map 以节点身份及 expected 值丢弃失效响应；restore 仅还原仍由扩展拥有的写入。MutationObserver 覆盖新增行内节点、characterData、保护属性、style/class/hidden/open；祖先过滤覆盖可编辑、代码、SVG/MathML 和 translate=no。详细回归、质量边界见 [ADVERSARIAL_FIX_QA.md](ADVERSARIAL_FIX_QA.md)。

v4.6划词正文采用下节Markdown节流渲染，思考内容保留帧播放队列，单条消息最多2048字符，兼容返回的reasoning_content。点击卡片内部、鼠标移出或选区折叠不误关，点击外部/Esc可关闭；当前端口检查防止旧流更新新卡片。历史验证与整合取舍见 [MERGE_CONFLICT_QA.md](MERGE_CONFLICT_QA.md)。

## v4.5 选区分析与上下文回归

`manifest.json` 在 `content.js` 前注入 `selection.js`；v4.6同时加载下节的Markdown依赖。`AISelection.analyze` 提供可独立验证的语言、内容类别、可信度、依赖信号和A/B/C/D路由，现行实现另将选取位置与完整性分别保存；`capture` 提取有边界和预算的DOM材料；`same` 对比位置及快照。`background.js` 正常选区和旧兼容路径都使用下文的统一请求构建器；全文批量保留独立协议。

无需为扩展安装依赖；使用本机已有 Playwright 验证实际 Edge 扩展：

```powershell
node scripts/verify-selection.mjs --node-only
node scripts/verify-selection.mjs --playwright '<已安装的 playwright 包目录>'
```

脚本先在 Node VM 检查文本语料，再在隔离 Edge 中验证真实 Range、DOM过滤、预算、模型路由、右键消息及本机HTTP SSE。`--node-only` 不加载 Playwright、不运行浏览器，只保存 `artifacts/qa/selection/node-report.json`。完整模式只使用合成凭据和合成页面；报告及截图在 `artifacts/qa/selection/`，独立profile在 `.local/browser-profile/selection/run-<时间戳>/`，结束关闭浏览器和服务器，保留profile复查。固定输出不证明真实模型的解释准确率、耗时或token账单。早期修改报告见 [SELECTION_CONTEXT_QA.md](SELECTION_CONTEXT_QA.md)，现行回归见 [LOCAL_CLASSIFIED_PROMPTS_QA.md](LOCAL_CLASSIFIED_PROMPTS_QA.md)。

## 2026-10-13 本地分类与按需请求

`background.js` 通过 `importScripts` 加载 `selection.js` 和 `selection-prompts.js`。前者的 `analyze` 不依赖 DOM，可供没有分析快照的旧消息本地分类；DOM 访问只发生在网页调用 `capture` 时。后者仅在后台加载，暴露 `AISelectionPrompts.SYSTEM`、`taskFor` 和 `build`，统一正常划词、旧兼容入口及“解释此句”的请求构建；不新增网页注入脚本或模型分类调用。

请求分为统一 system 要求、当前类型的一段任务要求和 JSON 编码的材料。`taskFor` 根据内容类别、语言路由及明确任务，在词语、句段、翻译、短回应、片段、代码、公式、数据、表格、引用、标题等要求中选择一项。分类标签、可信度、判断理由和分类示例留在本地，不直接写入任务指令。短回应规则区分独立应答与句中作用，领域明确的术语优先采用该领域定义。材料使用 `选中文字`、`所在句子`或`所在句片段`、相关标题/语言声明及必要前后文等字段；JSON 用于区分数据与指令，模型回答仍仅允许 Markdown 正文。

内容类别与位置分别保存：句中完整词语保持词语类别；真正截断的拉丁单词、明确指代或不完整关系使用片段类别。所在句由真实 Range 的两侧构成，发送时用 `【】` 标出短选区；`complete:false` 或后台裁剪的句子标为句片段。普通完整词语不为用满预算扩展到相邻块；明确的指代定义可保留前文，回应、片段和代码/表格等内容按需补充材料。实际 `lang="ja"` 辅助识别的纯汉字可发送语言元信息，不发送介绍语言规则的网页段落作为通用指令。隐藏内容、导航和扩展浮层继续过滤，章节/消息/列表边界、上下文关闭、无可靠 Range 的回退及右键/再次解释快照继续保留。

捕获时的1500/2500/800字符预算包含所在句两侧、标题、结构信息和语言声明；后台补充材料上限3000字符，包含组装后的短选区所在句。所选正文是任务输入，短所在句中的选区重复用于明确位置；超长选区不重复组装所在句。这些是字符上限，不是精确token限制，也不代表本地规则能判定所有语言或复杂DOM。

共同输出要求主动加粗核心定义、结论或译文，有不同层次时用简短小标题，并列信息用列表；与通常含义一致时省略重复语境，含义转移时重点说明文中含义。未知细节简短说明，不穷举猜测或重复改写；禁止表格和非Markdown正文形式。格式要求属于模型提示，渲染器仍保留原有Markdown兼容能力。全文 `buildTranslatePrompt` 的纯译文和 `buildBatchTranslatePrompt` 的ID协议不接入这套划词要求。

无需依赖的分类和请求构建检查：

```powershell
node scripts/verify-selection-prompts.mjs
```

该工具在Node VM执行实际 `selection.js` / `selection-prompts.js`，核对类别对应任务、共用system、材料选择、转义、预算和兼容输入，报告在 `artifacts/qa/selection-prompts-2026-10-13/offline-report.json`。它不运行DOM、浏览器或供应商请求。实际选区/消息/SSE证据使用上述Edge工具；真实厂家准确率、首个正文耗时、思考量及输出格式遵守情况需用有效凭据另行比较。修改范围、操作与验证结果见 [LOCAL_CLASSIFIED_PROMPTS_QA.md](LOCAL_CLASSIFIED_PROMPTS_QA.md)。

## v4.6 Markdown浮层与回答格式

自动注入顺序：selection.js → vendor/marked/marked.umd.js → vendor/dompurify/purify.min.js → markdown.js → content.js。固定版本、本地来源与许可证见 [vendor/README.md](../vendor/README.md)。不引入包管理或构建环境；不要在扩展中加载CDN脚本。markdown.js使用独立Marked实例和DOMPurify标签/属性白名单，在内容脚本隔离环境中工作。

正文两处入口（划词、解释此句）使用AIMarkdown.createStreamingRenderer，每150～600ms重新解析累计原文，完成时立即刷新，取消时清定时器。思考文本继续使用createStreamingTextRenderer。保留Markdown原文用于复制/现有TXT下载，不再调用cleanMarkdown。样式只作用于结果区域；表格和代码块可横向滚动，正文保持阅读位置。

当前浮层以原文snapshot Range及文档坐标回退定位，尺寸/窗口变化节流重新约束；整体高度受视口限制，关闭状态inert。Markdown重绘恢复代码/表格/链接焦点，首次整答从顶部显示。DOWNLOAD使用异步消息确认，只显示“已开始下载”而不声称文件已完成；失败可重试并隔离晚回包。全文scan提前跳过扩展UI子树。后台每次local保存继续失效配置读，仅生成字段或连接语义变化清结果缓存，展示元数据刷新保留缓存。

浮层使用标题区 Pointer Events 拖动及捕获/取消清理。2026-10-13 按用户要求删除“拖动”字样、方向/自动定位按钮与对应键盘移动逻辑；标题由按钮改为普通文本容器，不再点击展开控件。顶部默认 `cursor: default`，主指针左键按下后立即加入 `ds-dragging` 显示 `grabbing`，释放、取消、失焦或关闭时移除；右键不启动拖动，关闭按钮仍显示点击光标。自动定位依次检查选区下/上/右/左，四周无法容纳自然高度时缩小到上下较大空间。手动位置用视口坐标保存，流式增长和页面滚动保留位置，窗口缩小时边界约束；新选区清除手动位置。原文 Range 继续用于自动定位。空间铺满时无法保证无重叠。验证工具与证据边界见 [TOOLTIP_POSITION_QA.md](TOOLTIP_POSITION_QA.md)：

```powershell
node scripts/verify-tooltip-position.mjs --playwright '<已安装的playwright包目录>'
```

工具使用隔离的实际 Edge 扩展、合成网页/Key/本机 SSE 和真实鼠标/键盘事件；外部网络被拦截，不读取日常浏览器配置。当前生成报告与截图在 `artifacts/qa/tooltip-header-2026-10-13/`，此前2026-10-12证据在 `artifacts/qa/tooltip-position-2026-10-12/`；独立 profile 在 `.local/browser-profile/tooltip-position/run-<时间戳>/`。结束关闭浏览器和本机服务器，保留 profile 复查。

2026-10-12的回答风格调整曾在background.js共用SELECTION_SYSTEM_PROMPT、MEANING_EXPLANATION_GUIDANCE和MARKDOWN_OUTPUT_GUIDANCE，历史验证见 [PROMPT_STYLE_QA.md](PROMPT_STYLE_QA.md)。2026-10-13改为前文 `selection-prompts.js` 的统一system与单项任务要求；语言和模型路由、DeepSeek官方思考覆盖以及全文纯译文/ID协议继续保留。提示词对思考和格式的要求不构成接口token、耗时或强制过滤保证，合成渲染与真实模型生成须分别验收。

```powershell
node scripts/verify-markdown.mjs --playwright '<已安装的playwright包目录>'
```

该工具加载实际扩展和隔离Edge profile，用本机HTTP SSE返回合成Markdown；检查流式/最终结构、复制/下载、缓存回放、提示词、再次解释、链接/HTML处理、节流、宽内容/窄屏/键盘滚动、取消与错误重试。提示词检查实际发出10个请求，覆盖正常A/B/C/D、旧兼容A/B/C/D、旧解释与解释此句，确认指导一致、一次生成及模型路由；包含表格的合成回答用于保留渲染兼容回归，不表示模型遵守了表格禁令。下载TXT在context关闭前保存为artifacts/qa/markdown/markdown-download.txt；报告和截图在同目录。profile在.local/browser-profile/markdown/run-<时间戳>/，结束关闭浏览器和服务器，保留profile复查。合成回答不代表真实模型遵守了新提示词；真实生成需有效凭据单独验收。完整结果与限制见 [MARKDOWN_RENDERING_QA.md](MARKDOWN_RENDERING_QA.md) 与 [PROMPT_STYLE_QA.md](PROMPT_STYLE_QA.md)。
