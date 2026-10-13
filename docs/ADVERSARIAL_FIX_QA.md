# 对抗式问题修复与回归验收

本文主体记录修复完成提交 `7b4912a` 时的验证和上传状态；后续主分支合并记录见末节，不能把主体中的“未推送”当作后续实时状态。

日期：2026-10-11，北京时间。分支：`codex/verify-adversarial-findings`。修复起点：`bfb3f658800cb712f00827d1a854873bcffdd5d9`，工作区干净；该提交是此前15项缺陷的实际扩展复现版本。远程仍为 `origin https://github.com/siwenyu666-beep/AI-translator-extension.git`，本轮仅保存本地版本，没有推送、合并或发布。

## 修复结果

[原审查](ADVERSARIAL_REVIEW.md) 和 [实际复现](ADVERSARIAL_VALIDATION.md) 的 R01–R15 已修复，各项修复行为在实际加载的 Edge 扩展中通过回归。两个原审查子 agent 分别负责后台/划词与配置/设置修复，主 agent 重写全文、审阅跨层改动并独立执行回归；后台 agent 又只读对抗复核全文新实现。

| ID | 原错误 | 当前实现及实际验证 |
| --- | --- | --- |
| R01 | 请求/恢复覆盖网页同节点新状态 | Text 任务身份与 expected 值检查；旧响应被丢弃，新状态重新翻译，取消恢复最新网页原文 |
| R02 | 移动已翻译节点丢失原文 | 同一轮 DOM 移动按 isConnected 区分真删除，节点引用和原文保留，移动后取消正确恢复 |
| R03 | 可编辑/保护祖先内容外发 | 逐祖先检查可编辑、代码、data-ds-skip、translate=no、role=textbox及SVG/MathML；本机请求不含保护样本 |
| R04 | 批量失败回退突破50并发 | 批量与单条均占一个实际端口请求配额，回退重新排队；512片段压力回退完整完成，最大同时待完成原生fetch为50 |
| R05 | 旧配置读晚到重新填充缓存 | 配置revision与共享pending；失效时重读，并向迁移load传isCurrent；实际新地址/型号/语言生效 |
| R06 | 整段结果清空链接文字 | 每个Text节点独立映射，不清空其他节点；真实链接文字非空、href/元素身份/事件保持，取消恢复 |
| R07 | 拉丁字母=英语、汉字=日语的误跳过 | 移除字符集语言猜测；法语→英语和中文→日语均发送实际本机请求 |
| R08 | 新行内文本/characterData遗漏 | 新Text及行内子树扫描，字符更新建立新任务；追加SPAN和原节点更新均翻译并恢复 |
| R09 | 配置读取期间取消仍发POST | 第一个await前安装取消监听，安全发送/关闭覆盖所有出口；实际端口取消后0POST |
| R10 | 意外断流不能重试同一文本 | 统一ds-error状态、清理端口和导出；可见错误卡片直接同文触发产生新请求并成功 |
| R11 | 解释失败复制旧译文/型号标签过期 | 开始清currentExplanation、隐藏导出及清型号；失败不可导出，成功显示实际解释型号并可复制；标题切换为语境解读 |
| R12 | 第二个重复词取得第一处上下文 | 按Range实际起止节点及offset提取前后；重复bank及跨行内节点选区均核对本机提示词 |
| R13 | 旧停用状态无启用入口 | 仅停用时显示启用按钮；普通保存保留偏好，明确启用后保存/重开不会再次停用 |
| R14 | 新自定义地址沿用旧型号 | 同一次storage.set清连接列表和已保存custom型号；404后后台不生成，旧查询晚到不写回，地址保存不带Key草稿 |
| R15 | 原生Mixtral被过滤 | 补厂家识别；真实popup可选native/namespaced Mixtral，非文本/其他厂家仍排除；Voxtral需明确文本模态 |

全文的旧块级覆盖、字符集误判和散发回退逻辑已删除。进度改为文本片段数量，状态统一显示在顶部工具栏，不向正文插入段首指示器；相应未使用CSS已移除。批量协议仍是最多8项/3500字符和ID映射，单个长片段单独请求，厂家路由、Key和SSE协议保持原有方式。取消显式结算端口请求并清定时器，不依赖本端disconnect必然收到本端onDisconnect。

## 执行环境、范围与证据

Node.js **v24.18.1**，Edge **154.0.4258.62**，使用本机已有 bundled Playwright，没有 npm install、构建或新增运行依赖，扩展版本仍为4.4.0。

产品改动：`background.js`、`config.js`、`content-fullpage.js`、`content.js`、`content.css`、`model-catalog.js`、`popup.js`、`popup.html`。工具改动：三个verify-adversarial脚本及verify-browser。同步README、开发说明、交接和历史报告入口；新增本验收摘要。Description.md仅本地维护，按.git/info/exclude排除。

以下报告在修复待提交状态生成，其HEAD是起始bfb3f65，须结合workingTree和聚合报告的源码SHA-256读取；不能将HEAD单独当作被测源码版本。聚合证据为 `artifacts/qa/adversarial-fix-2026-10-11/summary.json`，保存各报告数量与运行源码哈希。

| 检查 | 实际结果 | 证据路径（仓库相对） |
| --- | --- | --- |
| 静态入口检查 | 20通过，0失败 | artifacts/qa/static-check.json |
| 原有后台模拟 | 43通过 | artifacts/qa/api-simulation.json |
| 缺陷/边界浏览器回归 | 12项R01–R12＋6项新增边界全部通过，另3组对照通过 | artifacts/qa/adversarial-fix-2026-10-11/browser/results.json |
| 设置回归 | R13–R15＋Key草稿/迟到查询共5组通过 | artifacts/qa/adversarial-fix-2026-10-11/config/results.json |
| 后台时序回归 | R05/R09＋8组正向/异常边界，共10组通过 | artifacts/qa/adversarial-fix-2026-10-11/background/results.json |
| 原有实际Edge验收 | 23组通过；无相关页面异常 | artifacts/qa/browser-check.json |
| Git差异检查 | git diff --check通过 | 聚合summary及本地命令 |

六个新增浏览器边界：请求期间原文切换/网页再更新/重新启动；删除请求中节点后重插；SVG/MathML和大写NO保护、隐藏文字显现及details展开；远处内容先延期、滚动后翻译；解释成功后实际型号/标题/剪贴板；跨文本节点选区上下文。已有验收还覆盖批量ID乱序、最小请求参数、接口失败/恢复、连接切换、Key收起、消息/SSE和取消重启。

R04测量实际Worker内原生fetch调用及待完成数量，包含在浏览器连接池等待的请求；本机服务同时收到的数量受HTTP池限制。50不是50条已建立TCP连接或真实厂家计费事件的证明。压力场景故意让批量格式错误、单条保持等待，再逐次放行以验证限额和最终完成；取消恢复首段并验证无卡住进度。

主 agent视觉检查链接非空、解释失败隐藏导出、停用恢复入口和Mistral设置截图；配置 agent检查了启用前后及换址状态。截图位于同目录的 `browser/R06-link.png`、`browser/R11-export-disabled.png` 和 `config/R13-disabled.png`、`R13-enabled.png`、`R14-new-address.png`、`R15-mistral-options.png`。

中间检查失败保留可追溯记录：浏览器断开计数未初始化、真实点击样本位于固定工具栏覆盖区，以及原verify-browser等待已移除段首指示器。修正计数初始化、将链接样本放在工具栏下方、改用接口实际收到请求确认取消时点；不是忽略断言或强制点击。原工具失败保存在 `browser/original-browser-initial-failed.json`，adversarial各轮报告保留时间戳副本。新全文审查发现的SVG大小写、动态显示/open和NO大小写遗漏已修复并加入C03，进度同值写入触发MutationObserver循环的问题也已消除。

## 重复执行

```powershell
node scripts/verify.mjs --report artifacts/qa/static-check.json
node scripts/verify-api.mjs
node scripts/verify-adversarial-background.mjs
node scripts/verify-adversarial-browser.mjs --playwright '<已有playwright包目录>'
node scripts/verify-adversarial-config.mjs --playwright '<已有playwright包目录>'
node scripts/verify-browser.mjs --playwright '<已有playwright包目录>'
git diff --check
```

本机Playwright目录为 `C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，浏览器工具可追加 `--edge '<msedge.exe>'`。adversarial脚本当前默认要求修复行为，失败返回非零；原缺陷脚本可在历史bfb3f65独立checkout运行。后台工具也支持旧源码上的 `--expect-vulnerable`，不要在本修复源码上把复现模式当作验收。

每轮使用隔离profile，只写合成Key/网页，不读取日常浏览器存储。adversarial profiles保留于.local/browser-profile，报告记录具体路径；原verify-browser仅删除其本轮profile。测试浏览器和本机服务器在完成时关闭。原adversarial-validation证据未覆盖。

## 加载与必要配置

当前根目录就是修复运行成果。在edge://extensions对这个目录加载的扩展点击重新加载，并刷新已打开的网页。保留既有厂家Key和偏好；旧停用时点击设置页启用按钮。换过自定义地址的用户须等待新接口列表，重新选模型并保存。没有Key或没有接口开放型号时，后台不会生成请求。

本地完成提交主题：`fix: resolve adversarial findings and add regression coverage`；准确提交号用 `git log -1 --oneline` 查。没有上传GitHub、改远程main或发布版本。

## 验证边界与剩余限制

15项已确认问题的对应路径和上述边界已修复并通过回归，未发现这些用例范围内仍存在的逻辑错误；测试和代码审查不能证明所有状态、所有网站或未来供应商行为不存在任何逻辑错误。

真实加载的popup/storage/Worker/端口/按需注入/DOM与本机HTTP/SSE已经执行；R05/R09人工控制原生storage读取交付时序，未替换AIConfig.load或产品处理器。Mistral和其他厂家响应使用合成拦截，不向官方发送合成Key；原验收联网刷新公开目录，并确认无凭据DeepSeek入口返回401，仅证明可达。

未使用用户有效凭据验证供应商生成、模型质量、权限、reasoning_effort兼容性、真实限流/计费；未执行原生工具栏弹出层或右键菜单鼠标操作、任意网站/iframe/Shadow DOM兼容验收。

按Text片段翻译保住链接/强调文字及结构，但行内分句可能影响翻译语序和质量；取消恢复以节点当前值仍等于扩展写入为依据。固定顶部工具栏可能遮挡页面顶端内容，未重写通用布局方案。配置迁移isCurrent防止已确认的旧读晚到写回，但chrome.storage没有跨上下文CAS，本修复不提供所有并发写的原子事务保证。

## 后续主分支合并（2026-10-11）

用户要求合并后，fetch确认原开发分支已通过PR #9合入origin/main，基线为 `f3b51241946853ea9d7a174ac37597509283b9cf`；本地主分支仅落后17个提交，无独有提交。`git merge-tree --write-tree origin/main codex/verify-adversarial-findings` 无冲突，结果树 `c76906840f3eb8e24885408b3d2d0e03300f067e` 与修复提交7b4912a的完整树一致。因此没有新的运行代码组合，无需将此前完整浏览器回归重复当作本轮新执行。

修复源分支已推送，主分支合并入口为 [PR #10](https://github.com/siwenyu1213/LingoClarify/pull/10)，采用merge保留审查、复现与修复提交。仓库canonical地址已迁移至 `siwenyu1213/AI-translator-extension`，原origin地址仍有效并保留。README改用main安装入口、交接标记旧分支快照；Description.md仅本地更新。合并前再次执行20项静态与git diff --check通过，GitHub检查列表为空，不代表远程CI通过。

最终PR状态、merge提交、同步结果和运行文件哈希核对保存在 `artifacts/qa/adversarial-merge-2026-10-11/merge-result.json`；准确GitHub合并结果以PR记录为准。已有真实供应商及复杂网站的未验证边界继续保留。
