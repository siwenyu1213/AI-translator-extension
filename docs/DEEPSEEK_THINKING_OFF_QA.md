# DeepSeek 关闭思考试用分支

日期：2026-10-12，北京时间。起始工作区干净，HEAD为`8eb51e514137180e7d9457798a0b9dafde1ac861`。执行`git fetch origin`后原分支`codex/markdown-result-renderer`与上游为2/0，从当前成果新建并切换到`codex/deepseek-thinking-off`。

## 试用行为

用户要求开分支关闭DeepSeek思考后自行试用。依据[DeepSeek官方思考模式说明](https://api-docs.deepseek.com/guides/thinking_mode/)的显式关闭参数，后台对规范化Base URL的hostname精确匹配`api.deepseek.com`，固定发送`thinking: { type: 'disabled' }`、省略`reasoning_effort`。

覆盖正常划词A/B/C/D、旧解释、解释此句及全文单条/批量。即使之前保存了开启思考或高强度，本分支也关闭；有效开关在缓存键生成前归为false。原有配置、Key和模型不重置，设置页两处提示说明试用覆盖。直接使用官方地址的自定义连接同样适用；其他厂家、相似域名和第三方网关不根据模型名称添加DeepSeek参数。

只改请求参数及试用提示，本次不调整回答结构、上下文采集或解释提示词。扩展版本仍为4.6.0。

## 已执行验收

Node.js `v24.18.1`，隔离headless Edge `155.0.4283.45`。测试使用合成凭据/页面；官方URL在真实Worker中拦截并转发至本机HTTP SSE，其他非本机请求拦截，不读取日常浏览器配置。

```powershell
node scripts/verify-api.mjs
node scripts/verify-markdown.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

- 后台离线模拟45项通过。新增检查覆盖2种官方地址、2种已保存开关状态、8种生成路径共32组；均显式disabled、不发送reasoning_effort，原思考值保留。另有4组非官方端点/开关组合对照，确认即使模型名含DeepSeek也不添加厂家专用字段。
- 实际Edge回归24项通过。新增检查经真实内容脚本/扩展端口发送划词、外语句段翻译及批量请求，三者均带disabled、无reasoning_effort，正常完成；设置页实际打开，覆盖提示存在，原开启状态保留。其余Markdown、缓存、流式、下载/复制、取消与错误回归通过，页面JavaScript错误和额外网络请求为0。
- 静态检查33项通过、0项失败；`git diff --check`通过。

本任务报告副本保留在`artifacts/qa/deepseek-thinking-off-2026-10-12/`：`api-simulation.json`、`edge-report.json`、`static-check.json`。报告HEAD为检查时基线，结合workingTree判断未提交修改范围；浏览器和本机服务器已关闭，隔离profile路径见Edge报告。

## 试用与恢复

1. 在`edge://extensions`对本项目扩展点击“重新加载”，再刷新测试网页。
2. 确认使用DeepSeek官方连接（厂家“DeepSeek”，或自定义地址为`api.deepseek.com`）；沿用自己的Key与模型。本分支无需取消已保存的思考开关，后台固定关闭。
3. 重新选中“祖先”或“帧队列”，对照首次正文等待时间、解释质量与是否返回思考内容。

恢复对照可切回`codex/markdown-result-renderer`，再重新加载扩展、刷新网页。已有思考配置保留；切换分支前先确认没有新的未提交修改。

真实DeepSeek API生成、账号权限、关闭参数是否被服务接受、解释质量和首字提速未执行，等待用户用自己的已配置接口试用。第三方网关不在本次强制关闭范围，不能把请求体检查写成真实供应商或速度已验收。

本地提交可用唯一主题`test: disable thinking on official DeepSeek requests`查询；未推送GitHub。Description.md同步后仍只在本地、不暂存、不提交。
