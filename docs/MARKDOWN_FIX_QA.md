# Markdown 浮层审查问题修复与回归

日期：2026-10-11，Asia/Shanghai。开始分支 `codex/markdown-result-renderer`，HEAD `eeb5ed60042820a3702103eb30123076bfe3340c`，工作区干净。核对 origin 并执行 git fetch origin；复用现有任务分支，未合并上游或推送。版本仍为4.6.0，本轮为已有行为的修复，不发布新功能版本。

用户要求修复上一轮审查问题并回归。本轮完成F1～F5，以及观察器重复扫描和缓存失效范围问题；顺带修复长首段直接滚到末尾。阅读模式、MD导出、公式/高亮等新功能建议没有实现。原解释/翻译提示词保持不变。

## 改动与对应验收

| 问题 | 修复行为 | 实际Edge回归 |
| --- | --- | --- |
| F1 回答增长后操作区出屏 | 卡片纵向flex布局和视口高度预算，正文/思考区可收缩滚动；ResizeObserver节流重定位，resize也重新约束；左右/上下均留10px边界 | 1000×600长回答、320×360及320×240并显示长思考内容，卡片及操作区均在视口内；截图已实际查看 |
| F2 重绘丢失键盘焦点 | Markdown渲染前保存代码/表格/链接身份、内容前缀及同项顺序，替换后preventScroll恢复；横向位置继续保留 | PRE、表格区域、外链分别验证中途更新和最终刷新，焦点始终停留在对应项 |
| F3 浮层自身选区成为锚点 | 原文snapshot Range作为定位来源，折叠或脱离DOM时保留文档坐标回退；排除浮层Range | 选中结果再滚网页100px，浮层仍跟随原文锚点，顶部327→227；折叠选区后的右下角回退也在屏幕内 |
| F4 隐藏后仍进入Tab序列 | 初始/隐藏状态设置inert和aria-hidden，显示时恢复；关闭时移出内部焦点，优先返回打开前元素；补关闭按钮名称和按钮focus-visible | Esc关闭后Tab不进入透明卡片，再次打开后关闭按钮可以正常聚焦 |
| F5 下载失败显示成功 | DOWNLOAD保留异步消息通道，后台返回启动成功或失败；前端显示下载中/失败重试/已开始下载，避免把下载ID视为文件完成；晚回包不能覆盖新结果 | 注入API拒绝、无响应、延迟ID；失败可重试，等待中不显示成功；关闭重开后旧响应不改新按钮；原23项Markdown回归另验证真实downloads API文件落盘及内容 |
| 首次长回答滚到结尾 | 空容器首次渲染从顶部显示，之后继续保留原有向上阅读/接近尾部跟随规则 | 长首chunk完成后scrollTop0；原有滚动保持回归通过 |
| 全文观察器重复扫描浮层 | scan在创建TreeWalker前排除扩展浮层和工具栏子树；正常网页保护属性变化仍继续扫描/恢复 | 2000条列表5次重绘，旧版额外遍历36048个浮层Text，修复后0；新增翻译请求均0；保护/动态文字/隐藏展开/取消恢复旧回归通过 |
| 展示数据写入清回答缓存 | 任意本地保存仍失效配置快照、增加configRevision，保留共享pending与防陈旧读；只让生成字段/连接语义变化增加cacheRevision及清回答缓存 | 目录时间、展示名、模型列表顺序和已确认连接的刷新时间保留缓存；同一选区刷新后重放无新增生成POST；语言/型号/思考/厂家/Key/地址/可用型号变更仍清缓存 |

连接比较保留apiBaseUrl、apiKey、规范化可用型号与“是否已确认列表”的语义，忽略modelEntries展示信息和具体查询时间。有效空列表的首次确认仍会改变生成校验条件，不能将这一状态当作纯展示时间。缓存不持久化；页面和后台重载仍可能自然失去会话缓存。

## 工具与证据

Node v24.18.1、Edge154.0.4258.62，使用本机已安装Playwright，无npm安装或新增扩展依赖。

新增可复用 `scripts/verify-markdown-fixes.mjs`。它加载实际解压扩展、创建隔离profile，运行本机合成页面和HTTP SSE，明确标记下载故障注入。`--ref eeb5ed6 --expect-vulnerable` 将Git基线文件写入 `.local/tmp/markdown-fix-baseline/<commit>/` 并加载该副本，不切换或覆盖当前工作区。使用Git NUL分隔文件名读取，支持中文文件名。13项基线对照的passed表示预期缺陷成功复现，不能解读成旧版正常。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 新增实际Edge定向回归 | 25项通过 | `artifacts/qa/markdown-fix-2026-10-11/fixed/report.json` |
| 旧提交负向对照 | 13项成功复现预期缺陷/对照行为 | `artifacts/qa/markdown-fix-2026-10-11/baseline/report.json` |
| 原Markdown实际Edge回归 | 23项通过，含原生剪贴板/文件下载/取消/断流重试 | `artifacts/qa/markdown/report.json` |
| 划词工具，本地语料/后台模拟/实际Edge路径 | 68项通过，不把全部68项称为浏览器操作 | `artifacts/qa/selection/report.json` |
| 原设置、消息、划词与全文实际Edge回归 | 23项通过 | `artifacts/qa/browser-check.json` |
| 对抗浏览器及正向对照 | 18项和3个对照通过 | `artifacts/qa/adversarial-fix-2026-10-11/browser/results.json` |
| 对抗配置 | 5项通过 | `artifacts/qa/adversarial-fix-2026-10-11/config/results.json` |
| 后台离线API模拟 | 43组通过 | `artifacts/qa/api-simulation.json` |
| 后台配置时序和取消模拟 | 2项和8个对照通过 | `artifacts/qa/adversarial-fix-2026-10-11/background/results.json` |
| 最低静态与diff | 31项静态通过、git diff --check通过 | `artifacts/qa/static-check.json` |

定向报告含检查时HEAD及workingTree。除基线负向对照外，所有回归使用eeb5ed6加本轮未提交修改；原套件运行后补了一处右键回退横向边界约束，该最终边界由完整25项定向回归覆盖。生成证据属于本机文件，不进入Git。截图 `fixed/growth.png`、`fixed/compact.png` 已用视觉工具查看。浏览器和HTTP服务器结束时关闭，隔离profile保留复查。

运行命令：

```powershell
node scripts/verify-markdown-fixes.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-markdown-fixes.mjs --playwright '<已有的playwright包目录>' --ref eeb5ed6 --expect-vulnerable
node scripts/verify-markdown.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-selection.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-adversarial-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-adversarial-config.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-api.mjs
node scripts/verify-adversarial-background.mjs
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

## 保存与使用

本地提交主题 `fix: preserve Markdown reading and report download results`，准确提交号用git log查询。受跟踪范围：background.js、content.js、content.css、content-fullpage.js、markdown.js、新回归脚本、新验收文档与README/开发/审查入口说明。Description.md已同步但继续被本地exclude忽略，不暂存、提交或上传。未推送GitHub。

在edge://extensions重新加载本项目扩展，再刷新已打开网页，使内容脚本与后台同时更新。无需重新填写原有Key或更改设置。

验证边界：页面、Key、生成结果均为合成；原浏览器工具另检查真实公开目录及不带凭据的官方401连通性，这不证明真实账号生成。没有使用真实供应商凭据验证回答质量、格式遵守或耗时。代码仍采用累计Markdown整块重绘，流式期间的手动文字选区仍可能被清除，上一版已披露这一独立限制；本次恢复的是键盘焦点与滚动位置。未覆盖任意网页的强制样式、Shadow DOM、所有缩放/视口和特殊宿主布局。
