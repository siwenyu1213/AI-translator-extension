# PR #9 与 main 的冲突整合验收

日期：2026-10-11，北京时间。版本维持 4.4.0。

## 原因与基线

GitHub PR #9（`codex/openai-compatible-api` → `main`）显示 `CONFLICTING / DIRTY`。任务开始工作区干净，开发分支及远程为 `f93f3f01bb8562c4ac3c94c626ec722eb641546e`，`origin/main` 为 `4951736dbe79b5a8220466cd58b4208bb7aa243f`。共同基线是 `69efda7`。

main 的 PR #8 引入 v3.6.3 划词播放/关闭行为、全文批量调度和节点快照/会话隔离；开发分支引入 v4.4 多厂家路由、接口模型列表、精简设置和新文档。双方修改相同区域，实际 merge 复现五个冲突文件：README.md、background.js、content-fullpage.js、manifest.json、popup.html。

## 整合结果与取舍

- 保留 v4.4 的名称、版本、权限、设置界面、共享配置、厂家独立 Key/地址、模型列表和最小通用生成参数。没有恢复旧版专用 Key、固定厂家路由或供应商特有 thinking/temperature/max_tokens 参数。
- 保留 main 的划词帧播放、返回思考内容展示、点击外部/Esc 关闭和内部点击/选区折叠不误关；增加当前端口检查，旧流消息不能改新卡片。长 token 与 reasoning 消息各最多 2048 字符。
- 保留 main 的全文相邻块批量调度，最多 50 个并发批量请求，每批最多 8 块、3500 字符，单个长块单独处理；按 ID 落盘，失败回退逐块。文本节点快照保留原始节点引用，显示原文期间完成不会覆盖原文，会话 ID 隔离取消/重新开始后的旧回调。
- 将 `STREAM_TRANSLATE_BATCH` 接入现有 `handleStreamRequest`，共用翻译连接、Bearer Key、可用模型拦截、SSE 错误/截断校验、超时及缓存。缺项/重复/未知 ID 报错，失败结果不缓存，不复制旧版仅 DeepSeek/千问的后台批量实现。
- 保留 main 的生成退避重试（网络/429/5xx 最多三次），等待中取消/超时立即生效；账号模型列表仍保持原有 20 秒、最多重试一次的规则。
- 保留已经验证的文本遍历共用简化。同步 README、开发说明、交接.md 及仅本地 Description.md，区分整合后的行为和历史验收。

## 已执行验收

工具：Node.js v24.18.1，Edge 154.0.4258.62，已有 Playwright。检查时 HEAD 为 `f93f3f0`，工作区含 merge 整合修改；保存为本次 merge 提交后复查父提交及远程状态。

| 检查 | 命令/操作与结果 | 证据 |
| --- | --- | --- |
| 静态 | `node scripts/verify.mjs --report artifacts/qa/static-check.json`：17 项通过 | `artifacts/qa/static-check.json` |
| 后台模拟 | `node scripts/verify-api.mjs`：43 组通过；新增批量路由/乱序 ID、缓存、非法批量、长输出分块、生成退避与取消 | `artifacts/qa/api-simulation.json`，2026-10-11T00:14:59.714Z |
| 实际 Edge | `node scripts/verify-browser.mjs --playwright '<已有包目录>' --compare-ref f93f3f0`：26 组通过，页面异常 0，本轮 profile 已移除 | `artifacts/qa/browser-check.json`，2026-10-11T00:17:36.084Z |
| 设置界面 | 首次 Key、已保存 Key、自定义地址 dialog 的计算样式/矩形与整合前一致 | Edge 报告三个对比项目 |
| 划词 | 本机 HTTP/SSE、内部点击保持、选区折叠不误关、外部点击及 Esc 关闭；查看结果截图 | `artifacts/qa/selection-stream.png` |
| 全文 | 真正批量请求、逆序 ID 回填、链接/图片/脚本和节点引用保持、原文切换与取消、格式错误回退、请求途中原文保持、取消立即重启与旧会话隔离 | Edge 报告与本机模拟 API 请求记录 |
| Git/文档 | `git diff --check`，无未解决索引项/冲突标记；文档链接与文件导览覆盖检查 | 终端记录和 merge 提交 |

新增验收过程中修正了模拟样本与验证方式：模拟型号需加入其配置列表，批量样本只解析实际输入而非提示中的占位例子，失败/延迟场景先清空测试缓存，内容脚本隔离世界的状态通过扩展脚本 API 或工具栏 DOM 检查。最终以上完整回归均通过。

公开目录及无凭据 DeepSeek 401 探测为真实网络；厂家成功与错误响应使用明确模拟，生成/批量/取消路径使用本机 HTTP 模拟 API和合成 Key。没有使用用户真实 Key，没有验证所有厂家真实生成、模型质量或任意网页；原生工具栏和右键菜单鼠标操作仍需人工验收。报告/截图留在忽略的 artifacts/qa，不上传凭据或私有浏览器数据。

## 保存与使用

merge 提交主题：`merge: integrate main fixes with OpenAI-compatible providers`。目标是将 `origin/main` 合入同名开发分支并推送，使 [PR #9](https://github.com/siwenyu666-beep/AI-translator-extension/pull/9) 恢复可合并；解决冲突不等于已经在 GitHub 合并 PR。实时状态通过 `gh pr view 9 --json mergeable,mergeStateStatus,state` 检查，后续 main 若继续变更需要再次核对。

更新后在 `edge://extensions` 重新加载扩展，并刷新已打开网页。原厂家 Key/模型继续沿用；真实服务仍需有效凭据验收。
