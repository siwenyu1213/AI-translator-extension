# 划词回答风格与思考提示词验收

日期：2026-10-12，北京时间。起始 HEAD `5e0dceee6fc23d41cd9073fabc985c0ecfcc5422`，分支 `codex/markdown-result-renderer`，工作区干净。执行 `git fetch origin` 后任务分支领先上游 1 个提交、落后 0 个；复用现有分支和成果。

## 修改范围与目的

用户要求自然、结构化地解释“是什么”，减少上下文复述和机械拆解，根据通常含义与文中用法差异分配篇幅，只输出 Markdown 正文、禁止表格，并在提示词中减少不必要思考。

- `background.js`：正常 A/B/C/D、旧兼容 A/B/C/D、旧解释入口及“解释此句”统一系统提示词、释义和输出指导。开头直接说明整体含义，必要时补机制、区别或一个概念例子；语境没有新增信息时合并或省略，含义转移时重点解释文中用法。取消强制“原意译文／文中含义”双栏目和扩展背景要求，禁止表格及非正文输出。
- `background.js`：系统提示词要求只做最少必要思考，含义明确时直接作答，避免反复推演、穷尽方案和长时间猜测，不在正文输出思考或分类过程。保留材料作为数据、证据不足保留歧义的要求。
- `scripts/verify-markdown.mjs`：更新旧风格断言，实际检查10条生成路径发出的请求、模型路由、单次生成、思考参数与指导一致性；合并式翻译回答通过真实内容脚本流式显示。
- README、开发说明和本地 Description 同步。扩展版本仍为4.6.0，模型、语言、思考开关、`reasoning_effort`、流式显示与全文翻译协议沿用现有实现。

## 验证步骤与结果

Node.js `v24.18.1`，隔离 headless Edge `155.0.4283.45`。只用合成网页、合成凭据和本机 HTTP SSE，不读取日常浏览器配置。

```powershell
node scripts/verify-markdown.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify-api.mjs
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

- 实际 Edge Markdown 回归：23项通过，包括10条提示词生成路径、正常划词/解释此句、缓存、流式、复制/下载、格式安全、取消及失败重试；JavaScript错误和页面额外网络请求均为0。证据：`artifacts/qa/markdown/report.json`；合并式翻译截图：`artifacts/qa/markdown/translation.png`。
- 后台离线模拟：43项通过，包括独立厂家/模型路由、思考开启时的既有请求参数、SSE与失败处理，以及全文纯译文/批量ID协议。证据：`artifacts/qa/api-simulation.json`。
- 静态检查：33项通过、0项失败，证据：`artifacts/qa/static-check.json`。`git diff --check`通过。

10条路径检查在真实Worker中调用后台生成入口，接收端为测试端口对象；正常划词与“解释此句”另经真实内容脚本和扩展端口验收。Edge报告中的HEAD是检查开始时的基线，结合workingTree中的待提交文件判断实际检查范围。浏览器和本机服务器已关闭，隔离profile保留在报告指定路径。含表格/HTML的合成回答用于既有渲染与安全回归，不是新提示词的合规回答样本。已查看合并式翻译截图，正文和操作按钮显示正常。

## 加载与验证边界

在 `edge://extensions` 对本项目扩展点击“重新加载”，再刷新已打开的网页。沿用现有厂家、模型、Key和思考设置即可；后台重启后使用新提示词及新会话缓存。

真实供应商生成、解释质量、表格禁令遵守、思考token和首字耗时未验证，缺少本任务可使用的真实生成凭据与模型对照样本。提示词只能引导最少必要思考，未加入时间/token硬限制，不能据此宣称速度已经提高。接口单独返回的reasoning_content仍由原有思考区显示；禁止思考过程的要求作用于模型正文，不改变该展示逻辑。

本次只保存本地Git版本，提交可用唯一主题 `fix: focus selection explanations and discourage excessive reasoning` 查询；未推送GitHub。Description.md继续仅本地忽略，不暂存、不提交。
