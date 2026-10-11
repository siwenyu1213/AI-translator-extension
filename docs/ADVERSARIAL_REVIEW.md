# 对抗式代码审查：版本残留与逻辑错误

后续验证：见 [ADVERSARIAL_VALIDATION.md](ADVERSARIAL_VALIDATION.md)。2026-10-11 已在新分支实际加载 Edge 扩展复现 R01–R15；R05/R09 的真实 Worker 时序及 R04 应用请求/网络连接的边界已补充。本报告以下保留初次审查的历史证据等级。

日期：2026-10-11，北京时间。审查源码基线：`9f860f956da17e25f95e1908d2e906f7088e74aa`，分支 `codex/openai-compatible-api`，扩展版本 4.4.0。开始时工作区干净，远程为 `origin https://github.com/siwenyu666-beep/AI-translator-extension.git`。本轮没有 fetch、切换分支、修改产品源码或真实供应商请求；新增本报告和开发说明入口，Description.md 仅本地维护。

## 审查方法与结果

按用户要求启动两个子 agent：legacy_review 检查历史配置、迁移、模型目录和设置页；logic_review 检查后台、划词、全文 DOM 和异步状态。主 agent 审查跨模块调用并补划词复现。双方交换结论并尝试反驳，主 agent 独立重跑两个子 agent 的全部复现脚本。

确认 15 项问题：5 项 P1、10 项 P2。P1 表示优先修复，可能丢失网页当前状态、处理可编辑内容、突破请求上限或继续使用过期配置；P2 表示特定路径下行为错误。所有结果仍是审查发现，尚未修复。现有静态检查和后台回归通过，不能覆盖以下新增边界。

工具：Node.js v24.18.1、headless Edge 154.0.4258.62、已有 bundled Playwright，无新增 npm 依赖。

证据目录：`artifacts/qa/adversarial-review-2026-10-11/`，由 .gitignore 排除。页面复现是在 Edge DOM 内执行未修改的 content.js / content-fullpage.js，chrome 端口、storage 和模型响应为合成测试替身；后台和设置页为 Node VM 执行当前源码，配置读取时间由测试控制。它们不等于加载完整扩展后的端到端验收，更不等于真实 API 验收。

## 优先修复的问题

### R01 / P1：网页当前文字被旧译文覆盖，取消又恢复更早的文字

定位：`content-fullpage.js:174-189` 原文快照与恢复，`content-fullpage.js:359-404` 任务准备和完成落盘。

复现：开始翻译一个段落，等待响应期间网页将同一文本节点改成新的内容，再返回旧内容的译文并取消。实际返回时覆盖了网页的新内容，取消后恢复初始旧内容。当前会话的 sessionId 未改变，因此取消/重启隔离不处理这种页面更新。

影响：实时数据、SPA 视图、编辑内容会被旧状态改写。最小修复方向：请求前记录节点与原文版本；落盘和恢复前验证节点归属及当前值，只恢复扩展自己改写且未被网页再次更新的节点。失效任务应重新采集，而不是覆盖网页的新状态。

证据：`logic/fullpage-repro.json` 的 `app_text_update_overwritten`。

### R02 / P1：移动已翻译段落会永久丢失原文恢复能力

定位：`content-fullpage.js:809-817`，MutationObserver 的 done 删除分支。

复现：翻译 P 元素后用 appendChild 将同一 P 移到另一个容器，等待 MutationObserver，再取消。实际 P 仍显示译文，`data-ds-translated` 仍为 true。移除事件清掉原文快照，新增事件又因翻译标记跳过它；重新启动也会跳过该段落。

边界：是真实移动、元素仍连接到 document，不是已经删除的节点无需恢复。最小修复方向：处理 removedNodes 时检查最终 isConnected 和节点归属，区分移动与删除，移动时保留任务、快照和计数。

证据：`logic/fullpage-repro.json` 的 `moved_translated_block_never_restores`。

### R03 / P1：全文扫描会处理可编辑草稿，并绕过祖先保护

定位：`content-fullpage.js:67-83` isSkippable；`content-fullpage.js:150-160` 块收集。

复现：三个样本分别为祖先带 `data-ds-skip` 的 P、PRE 下的 DIV、contenteditable 容器内的 P。三者均进入请求并被改写，草稿样本为 `My unsaved draft content.`。

影响：可编辑草稿可能被提交给用户所选接口并改写；祖先标记和代码保护失效。测试没有真实外发，外发风险来自实际请求路径。最小修复方向：检查 isContentEditable、编辑器角色和祖先跳过规则；直接文本递归也应遵守后代保护。祖先规则本身是 P2，但可编辑内容提升该组为 P1。

证据：`logic/fullpage-repro.json` 的 `skip_ancestors_ignored`。

### R04 / P1：批量失败后的单块回退突破 50 路并发

定位：`content-fullpage.js:630-643` 回退分支；`content-fullpage.js:466-486` 队列 active 结算。

复现：512 个可见块，批量响应全部报错，单块请求保持未完成。实际产生 64 个批量请求、512 个单块请求，最大同时单块请求为 512。

原因：回退直接逐个调用 translateSingleTask，没有 await 或单块队列限制，批量 Promise 随即 resolve，释放 active 后继续下一批。单块请求未计入 50 路配额。

最小修复方向：所有网络请求共享并发调度；回退进入同一配额，等待子任务结算后才完成批任务。仅 Promise.all 等待八个子任务仍不能保证最多 50 个实际请求。

证据：`logic/fullpage-repro.json` 的 `fallback_bypasses_concurrency`。

### R05 / P1：配置正在读取时发生保存，会将旧配置重新缓存

定位：`background.js:491-496` storage 失效处理和 getConfig。

复现：将 AIConfig.load 控制为尚未返回，在此期间发送 storage.onChanged，再让旧读取返回；随后提供新配置并再次 getConfig。实际返回旧配置，没有重新读取。

影响：后续生成可能继续用之前的厂家、Key、语言等，直到再次发生 storage 变化或 Worker 重启。问题是 await 返回后无版本检查地写入 configCache；同步清空无法阻止旧读取回填。

边界：Node VM 控制 load 时序，未在真实 Worker 内测量出现频率。最小修复方向：读取时记录配置修订号，完成后仅在修订号未变时缓存，否则重读；并合并同版本并发读取。

证据：`logic/background-repro.json` 的 `config_invalidation_lost_during_inflight_load`。

## 其他确认问题

| ID / 优先级 | 定位 | 触发、实际结果与影响 | 最小修复方向 |
| --- | --- | --- | --- |
| R06 / P2 | content-fullpage.js:195-199 | 段落包含正文和链接，全部译文写入第一个文本节点，后续节点被清空。链接节点及 href 保留，但链接文字变成空字符串，失去可见点击入口 | 保持文本片段与链接语义映射；逐片段翻译或带占位符恢复，不把整块译文集中到首节点 |
| R07 / P2 | content-fullpage.js:98-105 | 目标英语时法语段落被拉丁字母比例判为已是英语；目标日语时纯中文被汉字比例判为日语。两者均 0 请求，显示无需翻译 | 只在足够确定时跳过；拉丁字母不能证明英语，汉字不能证明日语 |
| R08 / P2 | content-fullpage.js:765-775、825 | 已翻译 P 新增 SPAN 时，新文字保持未翻译；现有文本节点更新也无 characterData 监听。只新增块元素的 SPA 路径不足 | 监听文本变化及内联新增，重新归属到可翻译块，并区分扩展自己的写入以避免循环 |
| R09 / P2 | background.js:146、262-263 | 请求等待读配置时端口已经断开，但取消 listener 尚未注册。之后仍发出一次未 aborted 的 fetch，最后向关闭端口发送时报错 | 在第一个 await 前安装断开监听，生成前检查是否已关闭，并保护关闭端口的发送 |
| R10 / P2 | content.js:250、341-351 | 连接意外断开后卡片可见，内容提示重试，却没有 ds-error 标记；再次右键解释同一文本被去重而无新端口 | 给失败/断开状态显式标记，去重只针对进行中或有效完成结果。普通外部左键关闭再划词可绕过，不能写完全无法重试 |
| R11 / P2 | content.js:516-517、566-572、441-467 | B 译文完成后点解释此句并失败，正文已显示错误，复制/下载仍保留操作按钮和旧 currentExplanation，复制实得 OLD TRANSLATION；模型标签也仍为翻译模型 | 发起新解释时重置结果及操作状态，失败时禁止导出过期结果；成功更新当前模型 |
| R12 / P2 | content.js:419-432 | 同段有两个 bank，选第二个河岸 bank 时 indexOf 找第一个金融 bank，实际 before 为 The，而不是第二个选区之前的文字 | 用真实 Range 计算段内偏移，处理多节点选区，不按选中文字第一次出现位置定位 |
| R13 / P2 | popup.js:288；config.js:32-35 | 旧 enabled:false 被迁移和保存保留，设置页没有启用控件，后台始终报扩展已禁用。填写 Key、选择模型、保存均不能恢复 | 保留偏好但提供重新启用入口；不能静默重置全部用户旧配置 |
| R14 / P2 | popup.js:269-277；background.js:222-226 | 自定义地址换址只清模型列表/查询时间，未清已保存 explain/translateModel。新地址 /models 返回404后，后台空列表校验条件被跳过，仍向新地址 POST 旧 old-chat | 地址变更同步使关联型号失效，并区分未查询、查询失败、已确认空列表的可用状态 |
| R15 / P2 | model-catalog.js:347、386-387；内置项311 | 内置目录含 mistralai/mixtral-8x22b-instruct，但 native ID mixtral-8x22b-instruct 被 providerFor 判为 custom，Mistral 接口过滤将它删掉 | 使用已有目录/厂家元数据补充归属；修正 family 规则。带 mistralai/ 前缀的 ID 已可识别；不声称当前真实账号一定提供此型号 |

R06–R08 证据为 `logic/fullpage-repro.json`；R09 为 `logic/background-repro.json`；R10–R12 为 `root/content-results.json`；R13–R15 为 `legacy/reproduction.json`。

## 历史残留：清理候选与必须保留的兼容逻辑

| 代码 / 数据 | 当前证据 | 处理建议 |
| --- | --- | --- |
| config.js 的 verifyModel 默认字段 | 全仓库生产代码只定义该字段，无读取控制生成的路径 | 清理候选；移除时明确存储字段迁移，不宣称它现在能验证模型 |
| background.js 的 VALIDATE_MODEL 路由及 validateModel | 当前 popup 没有调用方，仅后台分支及模拟回归调用，内部是 /models 成员查询 | 旧手动检测入口的残留候选；若保留就说明兼容用途，不能称真实生成检测 |
| AIModelCatalog.resolveId | 当前生产调用链无调用，verify-api.mjs 仍测试它 | 旧目录到原生调用名适配的候选，删除需同步相关测试和职责说明 |
| config.js 的 modelList/DEFAULT_MODELS、modelManufacturers，目录 COMPATIBILITY/nativeAliases | modelList 仍参与已保存型号合法性和迁移；部分别名仍辅助展示，目录也用于旧数据转换 | 不是整段死代码；不能直接删，否则旧配置可能归零。先将迁移与现行运行职责分清 |
| 旧顶层 apiBaseUrl/apiKey/availableModels、apiConfigVersion/modelCatalogVersion/providerConfigVersion | 旧结构到厂家独立连接的一次性迁移仍读取这些字段 | 保留升级兼容；是否清理旧顶层 Key 需单独定义迁移和回退策略 |
| deepseek-* 的菜单、DOM、批量标记名称 | 当前 CSS、事件、注入与端口协议仍引用；名称来自旧版 | 命名债务，不是失效代码；改名需原子联动，无需优先修复 |
| 注释 fullpage / pdf 及历史 docs | 当前未见独立 PDF 实现；README 明确历史文档作为记录 | 修正文档/注释候选，不据此声称存在可用 PDF 翻译入口或删除历史验收记录 |

本轮未把兼容字段、旧名称或历史文档本身当作逻辑 bug。真正的升级残留缺陷是 R13 的隐藏状态不可恢复、R14 的连接切换保留旧型号，以及 R15 的目录和现行过滤不一致。

## 执行记录与复查方法

已执行：

1. `node scripts/verify.mjs --report artifacts/qa/static-check.json`：17 passed、0 failed。
2. `node scripts/verify-api.mjs`：43 组后台模拟 passed，报告 `artifacts/qa/api-simulation.json`。
3. `node artifacts/qa/adversarial-review-2026-10-11/legacy/reproduce.mjs`：三组旧配置/模型复现。
4. `node artifacts/qa/adversarial-review-2026-10-11/logic/repro-background.cjs`：两个后台时序复现。
5. `node artifacts/qa/adversarial-review-2026-10-11/logic/repro-fullpage.cjs`：八组页面样本，其中语种样本覆盖两个目标语言错误。
6. `node artifacts/qa/adversarial-review-2026-10-11/root/content-repro.cjs`：三个划词复现，截图 `root/stale-copy.png`。
7. `git diff --check`，确认生成证据被忽略，产品源码 diff 为空；文档保存前再次运行最低静态检查。

审查基线的运行文件 SHA-256、工具版本和检查副本见 `artifacts/qa/adversarial-review-2026-10-11/baseline.json`、`static-check.json`、`api-simulation.json`。脚本和页面数据均为合成样本，无用户 storage 导出、真实 Key 或私有网页。

主 agent 创建的隔离 Edge profile 位于 `.local/browser-profile/adversarial-root/`，浏览器已关闭。工具的自动审批策略拒绝了两次递归删除命令（仅返回 blocked by policy，未给更具体原因），该临时 profile 保留在被忽略的目录，未绕过限制。再次运行 root 脚本会复用这个只含合成页面的审查 profile。

未执行：完整扩展的新增边界 Edge 验收、原生右键菜单/工具栏弹窗鼠标验收、真实供应商的模型列表和生成、网络限流/计费测量、多站点兼容回归。现有 verify-browser.mjs 未重跑；新增页面复现不替代它。后台竞态通过可控时序证明，出现频率未测量。

审查没有改变扩展入口或版本；当前使用仍为 Edge 加载仓库根目录，已有加载无需为本轮文档审查重新加载。真实验证时按 README 配置对应厂家地址、有效 Key 和接口开放模型；之后在 edge://extensions 重新加载并刷新普通测试网页。

建议修复顺序：原文恢复/页面更新与编辑区域保护 → 共享并发配额与后台配置/取消竞态 → 链接和语言判断 → 设置升级陷阱及划词状态 → 无调用入口清理。每次修复将对应复现转为回归，再执行受影响的真实 Edge 扩展路径。

本地版本保存主题：`docs: record adversarial review and reproducible logic defects`。仅提交本报告与 docs/DEVELOPMENT.md；Description.md 不跟踪、不提交。GitHub 未推送。
