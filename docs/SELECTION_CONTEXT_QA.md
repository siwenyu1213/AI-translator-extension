# v4.5 选区判断与上下文修改报告

日期：2026-10-11，北京时间。分支：`codex/selection-context-optimization`。基线：`373ff17c1a98d7bc231bd1841a24816234b44e4b`，开始时工作区干净。仅保存本地版本，未推送或合并。最终本地提交可用 `git log -1 --oneline` 查看，提交主题为 `feat: analyze selections with bounded richer context`。

## 修改目的和结果

旧实现把含外语字符的内容按10个空白词分为翻译/解释，把中文按10个UTF-16码元分为术语/长段；上下文固定前后各300字符。结果包括短完整句被当成短语、中文长名称被当成段落、同一词在不同位置不重新请求，以及选区折叠后解释丢失上下文。

新实现将文字构成、表面结构、语境依赖和模型路由分开。优先读取所在段落的剩余文字，加入有限的相邻正文、标题或表头；选中文字独立出现一次。只有一次生成请求，不先请求AI分类。不确定类别使用解释连接，由这次生成理解语义；不能在生成途中更换厂家。

版本由4.4.0同步更新为4.5.0，根目录仍直接在Edge加载，没有增加框架、npm环境或运行依赖。新增 `selection.js` 必须在 `content.js` 之前注入。

## 分类和行为

| 输入/位置 | 当前类别 | 请求行为 |
| --- | --- | --- |
| 独立“好的”“是的”“不是”“可以”，含常见句末标点也可 | response，中文短回应 | 解释连接，要求结合材料判断，不把词表当作含义证据 |
| “这是一个好的开始”中只选“好的” | fragment，句子局部 | 解释选区，参考原句 |
| 英文单词bank、短语break the ice | word / phrase | 中文译文及简短解释 |
| I love you、I'm ready、Open the door，无句末标点 | sentence | 翻译连接，目标语言译文 |
| Open source、class action lawsuit、function of temperature | phrase | 避免仅凭Open/class/function误判句子或代码 |
| 中华人民共和国行政强制法 | phrase | 不因超过10字而强制判成长段；可由模型理解具体名称 |
| 我喜欢你、该行为不构成犯罪 | sentence | 中文句意解释 |
| 多句、多段 | passage | 外语翻译，中文解读 |
| 法/德/西/葡/俄/阿拉伯语部分常见句式，日/韩常见句末 | sentence | 样本通过；规则不覆盖所有语言的句法 |
| reconstruction内只选construct | fragment，单词内部 | 提供前后拼接材料，避免当作完整单词 |
| 中文夹外语、结构不足的无标点长内容 | mixed / uncertain | 解释连接；模型可以按实际结构翻译或解释 |
| 代码、SQL、命令、报错 | code | 解释连接，不执行材料 |
| 3.5 元、5 kg、日期、百分比 | data | 解释指标，材料不足时保留不确定性 |
| λ、P(A\|B)、3 + 2 | formula | 解释符号与定义，不猜未知变量 |
| URL、路径、E01、式（3） | reference | 解释用途，不假装访问链接 |
| 标题、表格单元格 | heading / table | 补正文或简单表头，解释结构内含义 |

中文判定按字母中的汉字占比，混合内容不强行当纯外语；假名/韩文有独立信号，纯汉字日文参考最近lang声明。Intl.Segmenter用于词和句子信号，有缺失时回退。类别和可信度是本地结构提示，不代表精确语义识别。回应表、部分句式和长度只作为组合信号。

## 选区与上下文

- 保存真实Range起止节点/偏移和上下文字符串；跨行内标签、重复词、跨段和单字都有回归。
- 去重同时比较文字、起止位置和上下文；同一bank在河岸和金融语境可以重新请求。
- 右键时捕获材料，后台消息到达时使用快照；“解释此句”使用原选中文字与快照，选区折叠不丢材料。
- 默认额外预算1500字符。指代、代码、表格、公式、路径/编号等2500字符。选区本身超过1500字符时额外预算800。标题和结构信息计入预算，后台另有3000字符上限。
- 同块文字优先，上下文初始分配偏向前文。剩余预算用于相邻块：上文最多500，下文最多400，标题下正文最多900字符。尽可能保留完整句子；超长句采用字符截取。
- 小标题优先，缺少结构信息时使用最多120字符页面标题。简单表格可附caption、当前行th与首行对应列th。不会加入网页URL。
- 过滤隐藏、CSS不可见、导航、按钮、脚本、样式、编辑控件及浮层；按已识别的article/section/消息/列表项等范围停止扩展。
- 前后文字从选区边界附近遍历；有文本节点锚点时按方向读取，不从全文开头搜索重复词。限制局部文字量与节点访问；没有可靠Range时不猜位置。
- 旧 `usePageContext:false` 继续有效，实际请求不带主题、上文、下文或结构材料。

## 改动文件

| 文件 | 修改 |
| --- | --- |
| selection.js（新增） | 本地分析、Range快照、过滤和预算、位置去重 |
| content.js | 接入快照、单字触发、右键材料保存、后续解释复用 |
| background.js | 接收analysis；选区与上下文分开的单次提示词，额外材料上限；保留旧请求/全文路径 |
| manifest.json、popup.html | 注入顺序与4.5.0版本显示 |
| scripts/verify-selection.mjs（新增） | 语料及实际Edge选区回归，本机模拟SSE与合成凭据 |
| scripts/verify-adversarial-browser.mjs | 更新两处旧提示词格式断言，仍检查同一真实Range上下文 |
| README.md、docs/DEVELOPMENT.md、本报告 | 当前行为、加载方式、检查入口和验收边界 |
| Description.md | 同步本机文件职责和维护记录，继续通过.git/info/exclude排除，不提交 |

## 已执行验证

工具：Node v24.18.1，Edge 154.0.4258.62，外部已有Playwright。未给扩展安装依赖。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 新增选区回归 | 68项通过：54条分类语料、1组文字构成/分词回退、13组实际Edge/Worker组合场景 | artifacts/qa/selection/report.json |
| 原后台模拟 | 43项通过 | artifacts/qa/api-simulation.json |
| 原Edge设置/划词/全文验收 | 23项通过，生成使用模拟响应或本机HTTP；公开目录与无凭据401探测使用真实网络 | artifacts/qa/browser-check.json |
| 原对抗Edge回归 | 18项及3组对照通过，包括50请求配额、取消、网页更新、重复词、跨标签选区 | artifacts/qa/adversarial-fix-2026-10-11/browser/results.json |
| 原配置回归 | 5项通过 | artifacts/qa/adversarial-fix-2026-10-11/config/results.json |
| 原后台时序回归 | 2项及8组对照通过 | artifacts/qa/adversarial-fix-2026-10-11/background/results.json |
| 静态检查 | 23项通过，包含新增脚本及Manifest资源 | artifacts/qa/static-check.json |
| git diff --check | 通过 | 本次命令退出0 |
| 结果卡片视觉检查 | 查看实际Edge截图，合成结果显示、复制/下载按钮及模型标识可见 | artifacts/qa/selection/selection-result.png |

新增脚本检查实际HTTP请求中的模型与提示词，确认单字解释仅一个生成请求、短句走翻译模型、点击解释回到解释模型、上下文关闭时没有附带材料。生成输出固定为Synthetic QA result.，不是模型答案。

回归过程中修复了韩文短语回退、短回应被句式信号抢先分类、自然语言class/function误判代码、单词内部选区识别和BR上下文分隔。旧R12/C06检查最初因提示词从“上文：...”变为“参考上文：\n...”失败；只更新格式断言，保留完整前后文字与第二次出现位置检查，重跑通过。

## 重跑与使用

```powershell
node scripts/verify-selection.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-api.mjs
node scripts/verify-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-adversarial-browser.mjs --playwright '<已有的playwright包目录>'
node scripts/verify-adversarial-background.mjs
node scripts/verify-adversarial-config.mjs --playwright '<已有的playwright包目录>'
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

Edge打开edge://extensions，重新加载本扩展，并刷新原有测试网页，以更新content_scripts。已有厂家、Key、模型和上下文偏好保留；使用原设置中的有效连接。生成和模型质量需要相应真实凭据。

## 未验证和限制

不能保证任意语言、任意无标点句子或名称都精确分类；尤其短词与专名、纯汉字日文、缺少句式信号的外语内容存在歧义。uncertain回退会让模型继续判断，路由仍使用解释连接。

没有使用用户凭据验证真实生成质量、首字时间、输入/输出token或账单；本地capture耗时只记录少量合成样本，不能推断所有网站性能。更多上下文增加输入，具体收益和token开销需实际模型对照。

没有覆盖全部网站DOM、Shadow DOM、跨iframe选择、原生右键菜单鼠标操作、复杂rowspan/colspan表格、网站私有回复关系与全部编辑器。消息/评论边界仅识别常见结构，不自动读取另一条独立消息；聊天“好的”可能需要模型说明缺少被回复内容。没有新增键盘选区自动触发。

正文容器不规范或超长句仍可能只能截取部分材料。准确的定义或证据不在附近时，上下文预算无法保证补全。系统提示词要求把材料当数据，不构成对所有提示词注入的安全证明。

隔离profiles保留在.local/browser-profile，生成证据在artifacts/qa；浏览器与服务已在脚本结束时关闭。API Key只使用合成测试值，不读取或导出用户浏览器storage。
