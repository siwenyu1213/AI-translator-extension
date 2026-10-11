# 厂家目录更新失败修复与验收

日期：2026-10-10，北京时间 UTC+8。修复沿用 v4.1.0，未发布新功能版本。

## 用户报告与原因边界

用户连续点击“实时更新厂家模型”，看到“更新失败：更新失败。保留已保存的目录和当前选择。”

起点为 `codex/openai-compatible-api` 的 `e347515c49e905c0c42cbbfdc2a221f753036601`，工作区干净，远程和已有历史保留。此任务没有拉取或推送；属于现有功能的小修。

旧 popup.js 对后台 `REFRESH_MODEL_CATALOG` 的回复使用 `result?.error || '更新失败'`。若后台没有识别消息而返回 undefined，就只显示重复的通用“更新失败”，无法判断后台通信或网络问题。升级后仍运行旧 Worker 是一种可能触发条件，不能把它当成已读取用户日常浏览器后确认的结论。

在隔离的实际 Edge 扩展设置页中，模拟这个消息返回 undefined，原版产生与用户报告完全相同的提示；恢复成功断言失败。证据：`artifacts/qa/catalog-failure-before.json` 和 `catalog-failure-before.png`。同轮正常后台的真实公开目录刷新成功，不能据此判定用户日常网络也正常。

浏览器工具的 URL 策略拒绝访问日常 Edge 的 `edge://extensions`，没有绕过限制，也没有读取其 API Key、storage 或浏览器后台缓存。用户日常扩展的 Worker 版本及现场网络仍未直接核实。

## 改动

- popup.js：对无回复、监听器未建立和消息通道断开使用设置页恢复路径，调用共享公开目录逻辑，成功后保存快照。显示恢复过程、成功和重新加载建议；保留选定型号。后台明确的失败不触发恢复重试，失败无详情与无效快照分别提示。
- model-catalog.js：提供连接失败、20 秒超时、HTTP 状态和非 JSON 格式的具体错误；仍保留失败不覆盖缓存的行为。恢复请求不带用户 Key、Base URL 或网页内容。
- 验证脚本：增加无回复、断开、重复失败重试以及网络/超时/格式路径。README、DEVELOPMENT 与本地 Description 同步说明。

## 已执行

Node.js v24.18.1，Edge 154.0.4258.62；已有 Playwright 包，无新增扩展依赖。独立 QA profile 与合成 Key/网页。

| 检查 | 结果与证据 |
| --- | --- |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 17 项通过；`artifacts/qa/static-check.json` |
| `node scripts/verify-api.mjs` | 25 组离线模拟通过，新增连接/超时/格式错误以及缓存保留；`artifacts/qa/api-simulation.json` |
| `node scripts/verify-browser.mjs --playwright '<已有 Playwright 包目录>'` | 13 组实际 Edge 检查通过；`artifacts/qa/browser-check.json` |
| 真实网络 | 正常后台及无回复后设置页恢复都联网取得公开目录；推理 API 使用本机模拟，不代表真实供应商生成已验收 |
| 通信与网络失败模拟 | 设置页消息无回复、消息通道断开、后台 503、恢复请求 503，以及连续两次失败重试；缓存/当前型号保留，按钮恢复可点击 |
| 视觉检查 | 已查看恢复成功和 503 提示截图，长提示正常换行；`artifacts/qa/catalog-recovery.png`、`catalog-recovery-error.png` |
| `git diff --check` | 无空白错误；Description.md 保持本地 exclude、不暂存 |

报告 HEAD 为修复之前的基线，检查运行的是本任务未提交代码。修改范围：popup.js、model-catalog.js、两个验证脚本、README、DEVELOPMENT、本摘要；Description.md 本地单独维护。

## 使用与剩余边界

在 `edge://extensions` 点该扩展的重新加载，关闭旧设置面板后重新打开，再点“实时更新厂家模型”。无需修改 Base URL、Key 或选定模型。网络可达时会更新；通信恢复时有成功提示；网络不可达时给出具体原因并保留缓存。

未验证：用户日常浏览器的实际后台版本与更新点击路径、其网络/代理现场，以及各厂家的真实推理。此前公共目录排序、账号可用性和网关 ID 差异的边界继续适用。

本地提交主题：`fix: recover model catalog refresh when background does not reply`，通过 `git log -1` 查提交号。未推送 GitHub。
