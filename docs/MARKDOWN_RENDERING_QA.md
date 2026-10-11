# v4.6 Markdown浮层与回答格式验收

日期：2026-10-11，北京时间。新分支：`codex/markdown-result-renderer`。基线：`ce12f4ee9ba8b07e4e9a130813d298567db8bcaf`，起始工作区干净，来自已同步的`codex/selection-context-optimization`。开始已fetch origin并核对原分支与上游为0/0。保留v4.5选区与上下文成果，本任务仅保存本地提交，不推送或合并。

## 行为和提示词

- 划词正文与“解释此句”采用方案二：不断累计Markdown原文，定时重新解析已收到的完整文本。基础间隔150ms，每增加20000字符增加50ms，最高600ms；结束时取消待执行定时器并立即完整渲染，随后显示操作按钮。思考内容保留原有纯文本帧队列。
- 支持标题、加粗、斜体、有序/无序/嵌套列表、引用、行内代码和代码块、GFM表格、HTTP/HTTPS链接、删除线、任务列表与分隔线。普通文本和换行仍可读。
- 表格和长代码行在各自区域内横向滚动，提供键盘焦点；正文长词换行。每次重渲染保留向上阅读时的scrollTop和表格/代码区域的scrollLeft，读者停在底部时跟随新内容。
- 模型HTML转义为文字，解析结果通过DOMPurify标签/属性白名单。不插入脚本、样式、iframe或图片；Markdown图片只显示说明文字，不自动联网。仅HTTP/HTTPS链接保留可点击地址，使用noopener/noreferrer新标签打开。
- 解释优先用Markdown清晰、结构化表达，不强制简短、固定开场方式、编号列表或要点数；按内容需要选择段落、小标题、重点、列表、引用、表格、代码块。不要用代码围栏包住整篇答案，不用HTML。
- 浮层翻译A/B模式要求给出“原意译文”和“文中含义”，不提供例句。A为中文，B使用目标语言；两种含义一致时可说明一致，资料不足时保留歧义。结构不确定但需要翻译的情况也采用原意与语境说明。
- 只处理选中文字、将网页材料视为数据、不猜测未知定义/背景等要求保留。全文单条与批量继续使用纯译文和ID标记协议，不把语境解释写入网页。
- 移除cleanMarkdown对最终答案的格式清除。复制保留模型Markdown原文；下载仍为含选中原文和Markdown回答的TXT，没有新增导出格式。

## 文件职责

| 文件 | 改动 |
| --- | --- |
| markdown.js（新增） | 本地解析与白名单清理、链接/图片规则、表格包装、150～600ms流式调度、最终刷新和取消 |
| vendor/（新增） | 固定版本Marked 18.1.0、DOMPurify 3.4.16、许可证、source maps、来源及哈希；无需npm环境 |
| content.js | 正文两处接入Markdown renderer，保存原始回答，删除cleanMarkdown；保留端口隔离和思考帧队列 |
| content.css | 浮层范围内Markdown排版、表格/代码滚动、长词换行、可见键盘焦点、减少动画偏好 |
| background.js | 正常选区和旧兼容入口提示词更新，共用Markdown指导；全文协议保留 |
| manifest.json、popup.html | 本地依赖加载顺序；同步版本4.6.0 |
| scripts/verify-markdown.mjs（新增） | 实际Edge扩展、合成本机SSE、剪贴板/下载、排版/流式/取消/失败验收 |
| scripts/verify-selection.mjs | 结果从纯Text变为HTML段落后，完成断言忽略段落序列化末尾换行；原内容断言保留 |
| README.md、docs/DEVELOPMENT.md、本报告 | 当前行为、加载及检查入口、验收边界 |
| Description.md | 本机文件清单/调用关系/维护记录同步，继续.git/info/exclude排除，不暂存、不提交 |

## 已执行检查

工具：Node v24.18.1、Edge 154.0.4258.62、机器已有Playwright。所有生成返回、页面和Key为合成；没有读取用户浏览器storage或使用真实厂家生成凭据。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Markdown实际Edge验收 | 23项通过，含完整渲染、流式中已排版、原文复制/下载、缓存回放、提示词、再次解释、HTML/链接处理、节流、阅读滚动、360px窄屏、键盘横向滚动、取消和错误重试 | artifacts/qa/markdown/report.json |
| 选区/上下文回归 | 68项通过，分类语料及真实Range/Worker组合路径 | artifacts/qa/selection/report.json |
| 原后台模拟 | 43项通过；离线模拟，不能证明真实接口 | artifacts/qa/api-simulation.json |
| 原设置/划词/全文Edge回归 | 23项通过；生成模拟或本机HTTP，公开目录与无凭据401探测真实联网 | artifacts/qa/browser-check.json |
| 原对抗Edge回归 | 18项及3组对照通过，涵盖网页恢复、实际50请求限额、取消、配置时序、剪贴板等 | artifacts/qa/adversarial-fix-2026-10-11/browser/results.json |
| 静态检查 | 30项通过，包括所有本地vendor/renderer脚本和manifest资源 | artifacts/qa/static-check.json |
| git diff --check | 退出0 | 本次命令 |
| 像素检查 | 已打开并查看实际Edge的正文顶部、代码/表格、翻译、窄屏截图 | artifacts/qa/markdown/*.png |

最近一轮100个快速SSE片段在合成样本中合并为7次DOM更新；23788字符/500条结构化内容完整渲染，自动化往返约127ms。这些是单轮本地测量，不能推断任意长文本、网站或真实API耗时；重跑后的值以report.json为准。

截图：streaming.png、rendered-top.png、rendered-table-code.png、translation.png、narrow.png。真实chrome.downloads生成的TXT在浏览器关闭前读取并复制为artifacts/qa/markdown/markdown-download.txt以保留证据；Playwright管理的下载临时文件会随context关闭删除。隔离profile保留在.local/browser-profile/markdown，浏览器与本机HTTP服务器已关闭。

## 重跑和加载

```powershell
node scripts/verify-markdown.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-selection.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-api.mjs
node scripts/verify-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-adversarial-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

在edge://extensions重新加载项目根目录对应扩展，再刷新已打开网页，保证新manifest依赖注入。配置继续使用已有厂家、Key和模型；未设置时按README配置。提交主题：`feat: render streaming Markdown and structure contextual answers`；最终提交号用git log -1查看。本地保存不代表上传GitHub。

## 未验证和限制

没有验证真实供应商对新提示词的遵守、解释质量、输出长度/费用或生成延迟；提示词不构成格式保证。没有限制输出要点数或新增max_tokens参数。更完整的回答可能增加输出量，实际取决于模型。

尚未闭合的加粗、表格、引用或代码围栏会随新增文本重新解释；完整重渲染可能打断正文内部的鼠标文字选择。正文复制按钮始终导出完整原始Markdown。未覆盖任意网站的高优先级/important样式、Shadow DOM、所有视口和超大输出的性能。

没有代码语法高亮、LaTeX公式或Mermaid图渲染；Markdown图片仅显示替代文字，原始HTML作为文字显示。外链是否正确/可达未验证。Markdown扩展方言并非全部支持，其他阅读器渲染未验证。未操作用户日常Edge原生右键菜单或扩展工具栏弹出层。

现有历史QA文档保持原日期含义；本次真实模型边界仍未通过。生成报告/截图/下载/profile不进入Git，Description.md仅本地。
