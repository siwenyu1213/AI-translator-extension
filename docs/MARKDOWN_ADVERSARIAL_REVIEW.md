# Markdown 浮层对抗性审查与安全清理

日期：2026-10-11，Asia/Shanghai。审查基线 `codex/markdown-result-renderer@35c1d0232927fb967803e67342de552c17c67272`，开始时工作区干净。origin 为 `https://github.com/siwenyu1213/AI-translator-extension.git`。复用现有任务分支，版本仍为 4.6.0。

用户要求两个子 agent 对功能和冗余代码进行对抗性审查，随后明确授权直接清理已证实不影响使用的冗余代码并测试。功能 agent 独立验证交互、长回答与流式阅读；清理 agent 验证调用关系、兼容路径和全文观察器。主 agent 核对源码、报告、截图，并独立比较实际修改与 Git 基线，复现隐藏焦点和下载失败反馈。两位子 agent 均未修改受跟踪文件。

## 本次已清理

仅修改 `content.js` 的运行代码：

- 删除思考纯文本渲染器无人调用的 `setFinal`、`onIdle`、`idleCallback`、`finishIfIdle` 及配套分支，共 26 行。两处正文 `setFinal` 调用属于 `AIMarkdown.createStreamingRenderer`，继续保留。思考过程的逐帧播放、每帧 2048 字符上限、`push`、`cancel` 均保留。
- 删除选区坐标和右键回退坐标中无人读取的两个 `viewportLeft` 字段。
- 文本节点不再重新赋值，将其声明改为 `const`。

净减少 28 行运行代码。没有调整提示词、生成协议、配置迁移或用户存储。之前用户要求的解释结构化 Markdown、无固定要点数、翻译原意与文中含义且无例句继续生效。

## 已确认的功能问题，尚未修复

下面行号对应清理后的源码。P2 表示应修复的正常使用问题，不表示阻断所有功能；不能将通过原有回归解读为这些问题已解决。

| 编号 | 位置 | 触发与证据 | 建议 |
| --- | --- | --- | --- |
| F1 / P2 | `content.js:101`，`positionTooltip` | 1000×600 视口，原文 y300，35 个短段生成后浮层 bottom736，操作区 top660，复制/下载移出屏幕。初始按空卡片定位，回答增长未重新约束位置。主 agent 已查看实际截图 | 观察卡片尺寸和视口变化，节流重新定位；为整张卡片分配视口高度预算，保证按钮可见 |
| F2 / P2 | `markdown.js:43` | 首段聚焦代码 `PRE`，右箭头滚到 scrollLeft40；下一段到达后 activeElement 变为 BODY，scrollLeft 仍40。现有横向位置检查不足以覆盖键盘焦点 | 保存焦点块/链接的稳定身份，在流式和最终刷新后 `focus({preventScroll:true})`；逐步减少整块 DOM 替换 |
| F3 / P2 | `content.js:632-638` | 生成结束后选择浮层中的 Paragraph 0，网页滚动100px，浮层 top327→10；原文选区对照327→227→127。当前滚动处理读取全局 Selection，可能以浮层自身为锚点 | 使用已捕获原文 Range 或坐标，排除浮层内部选区；与 F1 统一设计定位逻辑 |
| F4 / P2 | `content.js:130` | Esc 关闭后，从网页按钮按 Tab，焦点进入透明浮层的 ds-close；浮层 ds-hidden、opacity0。鼠标无法命中不代表键盘无法聚焦 | 隐藏时设置 inert/hidden 等适合现有动画的机制，显示时恢复；补按钮 focus-visible 与合理焦点返回 |
| F5 / P2 | `content.js:375-388`；`background.js:691-722` | 在独立 Edge Worker 中对 downloads API 注入 Promise 拒绝，确认调用一次，按钮仍显示“已下载”。内容脚本立即改标签，后台吞掉失败。属于实际消息/UI 路径的故障注入，不是供应商或用户浏览器实际下载失败 | 下载消息返回成功/失败，按钮等待结果；失败显示可重试提示，避免过早声称文件已下载 |

F1、F2、F3：`artifacts/qa/markdown-review-2026-10-11/feature/report.json`，截图 `feature/tooltip-offscreen-growth.png`、`feature/scroll-card-selection.png`。F4、F5 和修改后的思考过程：`root/edge-probes.json`。相应临时复现脚本位于 `.local/tmp/markdown-review-feature/reproduce.mjs` 与 `.local/tmp/markdown-review-root/verify.mjs`。

## 性能与可维护性

1. 全文翻译和 Markdown 浮层同时工作时，`content-fullpage.js:108-111,253` 对新增浮层节点先创建 TreeWalker，再到每个 Text 才判定不翻译。实际 Edge：2000 条合成列表连续渲染5次，额外遍历36048个浮层 Text、6次 TreeWalker；取消全文翻译后的对照为0，新增翻译请求均为0。证据 `cleanup/observer-proof.json`。可对已知扩展浮层/工具栏提前跳过扫描；不能粗略跳过所有不符合条件的子树，保护属性变化仍需要恢复既有任务。这证明重复工作，没有证明生产网页卡死或回答外发。
2. `background.js:544-551` 对任意 local storage 写入清生成缓存，`popup.js:224` 的查询时间写入也触发。源码调用关系确认；此前延迟诊断已披露，本轮未重新测量延迟。建议只让影响生成的连接/配置变化清结果缓存，同时保留 config revision/pending 防陈旧读机制。
3. `background.js:183-226` 先构造旧提示词，再在有 analysis 时覆盖。可按条件只构造最终提示词；没有 analysis 的消息仍可达，旧 builder 不能整段删。
4. `content.js` 划词与“解释此句”两条生成流程重复。可共享端口、流式、完成、失败、取消过程；需要验证额外按钮和类型处理差异，不能机械合并。

## 可增加的功能，按收益排序

1. 阅读控制：首次显示/缓存完整回答从顶部开始；提供跟随尾部开关、展开/固定阅读、宽度和字号调整。实际长首 chunk 当前直接滚到底部：scrollTop1605，首标题坐标-1193。流式整块替换还会清正文手动选区，前一版 QA 已披露，此处作为已有改进项。
2. `.md` 导出和复制纯文本：当前已保留原始 Markdown，但下载仍为 TXT；给用户明确选择 Markdown 源文本或可粘贴的纯文本。继续保留选中文字和上下文来源有助于笔记复查。
3. 流中断保留已收到的回答，提供重试；只有接口和对话上下文支持时再提供继续生成。当前错误路径清除已有回答。
4. 本次结果切换翻译/解释，为本地分类不符合用户意图时提供纠偏。
5. 代码块复制、语法高亮、LaTeX 公式；Mermaid 和图片加载后置，根据实际需求决定是否增加依赖和渲染机制。

这些是建议，本次没有添加功能。

## 保留的候选与机制

`catalogLastCheckedAt`、`verifyModel`、`requiresApiSetup` 无当前消费者，适合另行停止新增字段/写点并验证配置迁移；不必清空用户已有存储。`VALIDATE_MODEL/validateModel` 和 `AIModelCatalog.resolveId` 仍有消息/测试入口，本轮保留。旧名称或隐藏控件不能直接证明无用途。

继续保留：思考渲染器本体、全文翻译单片段/失败回退的 STREAM_BATCH、配置 revision/pending/isCurrent、取消机制、仍生效的 enabled/usePageContext/triggerMode、参与迁移及型号检查的 modelList/默认型号/厂家归属/nativeAliases/COMPATIBILITY、仍被启用与重填 Key 按钮使用的 fetch-btn CSS、DOMPurify 和许可证。完整子 agent 证据在 `cleanup/review.md` 与 `feature/review.md`。

## 清理后的回归

工具：Node v24.18.1、实际 Edge 154.0.4258.62、已安装 Playwright；不引入 npm 安装或运行依赖。受测代码为基线35c1d02加本次未提交 content.js 清理。最终本地提交主题：`refactor: remove unused reasoning hooks and record Markdown review`，准确提交号用 git log 查询。源码、本文、开发入口和 README 是本次提交范围，Description.md 仅本地同步。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 实际 Git 基线与修改后思考渲染器 Node VM 差分，空/中文/多 chunk/20万字符/混合，正常及第0/3/25帧取消 | 20组一致，文本/帧数/待执行帧相同 | `artifacts/qa/markdown-review-2026-10-11/root/renderer-differential.json` |
| 实际 Edge Markdown：reasoning_content、正文/再次解释、流式、最终刷新、复制、原生下载、缓存、HTML/链接、窄屏、取消、失败/断流重试 | 23项通过 | `artifacts/qa/markdown/report.json` |
| 实际 Edge + 本地分类/后台模拟的划词工具：Range、上下文、自动触发、选区折叠后的右键消息回退 | 68项通过；不把全部68项称为实际浏览器检查 | `artifacts/qa/selection/report.json` |
| 修改后的实际 Edge 思考正文检查和两项对抗问题复现 | 思考通过；F4、F5成功复现，不是功能通过 | `artifacts/qa/markdown-review-2026-10-11/root/edge-probes.json` |
| 最低静态检查 | 30项通过 | `artifacts/qa/static-check.json` |
| git diff --check | 通过 | 终端退出0 |

命令：

```powershell
node .local/tmp/markdown-review-root/verify.mjs
node scripts/verify-markdown.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-selection.mjs --playwright '<已有的playwright包目录>'
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

所有 API 页面/回答/Key 为本机合成数据，真实供应商遵守提示词、回答质量及耗时未验证。既有后台协议未改，本轮未重复43组 API 和整套原设置/全文浏览器回归。浏览器与本机服务器已关闭，隔离 profile 保留。生成证据和临时脚本未提交。没有推送 GitHub。

使用清理后的代码：在 edge://extensions 重新加载本项目扩展，刷新已有网页，原有厂家/Key/模型配置继续使用。无需更改设置。
