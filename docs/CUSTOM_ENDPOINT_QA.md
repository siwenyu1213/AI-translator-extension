# 自定义接口缺少地址的修复与回归

验收日期：2026-10-11（Asia/Shanghai）。复用任务分支 `codex/markdown-result-renderer`，开始时工作区干净，基线为 `4c1cc3ba9047e5502cef4de2d8993027c6956dbc`；已执行 `git fetch origin`。本次修改 `config.js`、`popup.js`，新增定向验证工具与本记录，同步README/开发说明；本地Description.md同步但不暂存或提交。修复沿用v4.6.0，没有构建步骤或新增依赖，仅保存本地版本。

## 问题与复现证据

问题存在。旧版 `normalizeConnections`、`connectionFor` 和设置页 `providerConnection` 都将缺少自定义地址的连接回退到 `DEFAULT_BASE_URL`，而Key继续取自自定义连接。既可能在打开设置页时查询 `https://api.openai.com/v1/models`，也可能向 `https://api.openai.com/v1/chat/completions` 发送解释/翻译请求。已有v4全局Key缺少地址时，迁移也会补入OpenAI地址并错误确定连接归属。

在隔离Edge中写入“自定义厂家、合成Key、已保存型号、没有地址”的配置，旧版设置页打开后预填OpenAI地址；模型查询及四类生成路径的请求拦截记录均显示目标为OpenAI，并附有自定义合成Key。强制后台 `LIST_MODELS` 无回复后，设置页直接查询的回退路径同样复现。报告只记录请求地址及 `syntheticKeyAttached` 布尔值，不导出Key、授权头或私有网页。

全部非本机请求在服务工作线程及设置页拦截，没有把测试Key发给真实供应商。这证明旧代码可能错误路由凭据，不能证明用户历史上发生过真实Key泄露。初始离线证据：`artifacts/qa/custom-endpoint-2026-10-11/initial-proof.json`；实际Edge旧版对照：`baseline/report.json`（同一目录）。

## 修复后的行为

- 共用 `AIConfig.endpointFor` 选择地址。10家官方厂家继续使用预设；自定义仅取自身字符串地址并去除首尾空白，缺失、空白或错误类型保留为空。
- 自定义缺地址时，后台生成在fetch前返回“请先配置自定义接口地址”，覆盖划词解释、浮层翻译、全文单条及批量翻译。模型查询也在发请求前停止。
- 设置页明确提示缺地址，禁用该连接的型号选择。打开设置、保存Key、保存设置再打开都不会回填OpenAI；后台无回复时的直接查询仍受此约束。
- 已有v4全局Key缺地址的迁移保留未配置状态，不推测Key所属厂家；未配置厂家不借用全局Key。新安装默认OpenAI及旧v3清除未知专用Key的规则继续有效。
- 保存明确地址后，保留已保存的Key，并按现有规则清除旧型号/模型缓存，等待新接口列表重新选择。实际Edge使用本机HTTP接口完成模型查询、保存型号与流式生成。

合法的自定义地址仍可明确指向OpenAI。对于旧版本已经写入的OpenAI地址，存储没有来源信息，无法区分用户填写与自动回填；本次保留明确地址，请在“配置自定义接口”核对目标服务。

## 已执行的验证

工具版本：Node.js v24.18.1，Edge 154.0.4258.62。使用现有外部Playwright运行时，不引入项目npm环境。

| 检查 | 结果 | 证据路径（项目相对路径） |
| --- | --- | --- |
| 旧提交负向对照 | 64项Node VM + 8项实际Edge符合旧行为预期，72项通过；包括安全正向对照，不表示72个缺陷 | `artifacts/qa/custom-endpoint-2026-10-11/baseline/report.json` |
| 修复定向回归 | 64项Node VM + 12项实际Edge，76项通过，无失败 | `artifacts/qa/custom-endpoint-2026-10-11/fixed/report.json` |
| 原有扩展浏览器回归 | 23项通过 | `artifacts/qa/browser-check.json` |
| 配置迁移/并发回归 | 5项通过 | `artifacts/qa/adversarial-fix-2026-10-11/config/results.json` |
| 后台/API离线模拟 | 43项通过 | `artifacts/qa/api-simulation.json` |
| 后台时序与缓存对照 | 2项修复回归 + 8项对照通过 | `artifacts/qa/adversarial-fix-2026-10-11/background/results.json` |
| Markdown交互及缓存回归 | 25项实际Edge通过 | `artifacts/qa/markdown-fix-2026-10-11/fixed/report.json` |
| 最终静态检查 | 32项通过 | `artifacts/qa/static-check.json` |
| Git差异检查 | `git diff --check` 通过 | 本地命令退出码0 |

64项VM检查覆盖9种缺失/错误类型地址的归一化和四类生成拦截、原始及已存储连接的模型查询、两种不完整v4迁移、v3专用Key迁移、厂家之间Key隔离、10个官方地址预设，以及明确本机/HTTPS网关/OpenAI自定义地址的正向对照。12项Edge检查覆盖实际storage迁移、设置DOM及保存重开、消息端口、后台无回复时的设置页查询回退、本机HTTP恢复路径和无页面JS错误。

已查看 `artifacts/qa/custom-endpoint-2026-10-11/fixed/missing-address.png`：自定义厂家下显示缺地址红字，型号选择禁用，地址输入为空，Key收起。浏览器与本机服务器均已关闭，隔离profile保留在 `.local/browser-profile/custom-endpoint/run-*`，具体路径见JSON。

## 重跑与加载

```powershell
node scripts/verify-custom-endpoint.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify-custom-endpoint.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright' --ref 4c1cc3b --expect-vulnerable
node scripts/verify-custom-endpoint.mjs --node-only
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

默认检查修复行为；`--expect-vulnerable` 要求明确基线 `--ref`，把Git树复制到 `.local/tmp/custom-endpoint-baseline/<commit>/`，不切换分支或覆盖工作区。负向对照成功仅表示旧行为按预期复现。`--node-only` 不执行Edge，仍写fixed报告，若需要完整证据应随后重跑完整模式。

在 `edge://extensions` 重新加载本项目，并刷新已打开网页。自定义连接缺地址时，通过“配置自定义接口”保存服务提供的Base URL；等待模型列表后重新选择型号并保存。检查历史上已保存的OpenAI地址是否确为目标服务。

## 验证边界

实际Edge验证了真实扩展storage、DOM、消息通信、服务工作线程和本机HTTP请求；供应商响应为明确模拟，未读取用户日常浏览器或真实Key，未验证真实供应商凭据、模型质量及全部网关。静态检查不代表完整浏览器规范或安全审计。与本次修改无关的Markdown手动文字选区保持等限制沿用之前记录；本轮无GitHub推送或发布。
