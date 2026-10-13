# 划词触发方式、DeepSeek 思考控制与 GitHub 文件说明验收

日期：2026-10-13，北京时间。扩展版本4.6.0，本次未发布新版本。基线 `03d7b46c4cffd317aea971c30b070aac865c80ac`，起始工作区干净，复用 `codex/tooltip-header-cleanup`，fetch后领先上游3个界面提交。用户确认将这3个提交和本次改动一并同步main，并覆盖根目录全部文件的GitHub列表说明。

## 改动与原因

- 原生右键菜单仍存在，设置页却隐藏了triggerMode。本次在思考强度区域下方恢复“划词触发方式”：auto默认自动回答，contextMenu仅右键触发；点击保存，已有网页即时更新，重开设置保留。
- DeepSeek官方端点之前强制disabled，界面的深度思考开关不生效。本次解释和翻译各自新增DeepSeek思考总开关，默认关闭；关闭时取消/禁用深度思考，隐藏强度，显式disabled且无effort。开启时显式enabled，只有再开启深度思考才发送effort；重新打开总开关不自动恢复深度思考。
- `AIConfig.isDeepSeekEndpoint`共用于设置与后台，精确匹配实际主机；显式自定义官方地址同样处理，不根据模型名向第三方网关发送专用参数。新字段进入配置归一化、配置失效和缓存键。
- GitHub文件列表文字来自最后一次修改该文件的提交标题，没有可编辑的独立文件简介字段。通过逐文件补充职责说明并独立提交，使根目录各文件的最新标题对应实际用途；旧版本提交保留在历史中。

实现参数依据取得于2026-10-13的 [DeepSeek官方思考模式文档](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)。其文档将medium映射为high；开关打开但未发送effort时由模型采用默认强度。

## 实际执行

工具：Node.js v24.18.1，Edge 155.0.4283.45，外部已有Playwright；未给扩展增加依赖。所有浏览器运行采用独立profile、合成Key及本机HTTP/SSE，不读取日常浏览器存储。

| 验证 | 结果 | 本地证据 |
| --- | --- | --- |
| `node scripts/verify-settings-controls.mjs --playwright <已有包目录>` | 9项通过：位置/默认值、保存重开、实时触发切换、菜单消息实际DOM回答、总开关/深度/强度、解释及翻译/B/批量端口、厂家/地址和草稿隔离、失败反馈、320px及内部滚动 | `artifacts/qa/settings-controls-2026-10-13/report.json` |
| `node scripts/verify-api.mjs` | 48组模拟通过；包括8路由×8开关组合、关闭组合、其他端点、缓存切换、SSE与错误处理、菜单创建/点击分发 | `artifacts/qa/api-simulation.json` |
| `node scripts/verify-themes.mjs --playwright <已有包目录>` | 18项实际Edge通过 | `artifacts/qa/themes-2026-10-13/report.json` |
| `node scripts/verify-markdown.mjs --playwright <已有包目录>` | 24项实际Edge通过；含官方地址转发本机的关闭总开关请求 | `artifacts/qa/markdown/report.json` |
| `node scripts/verify-adversarial-background.mjs --report artifacts/qa/settings-controls-2026-10-13/background-timing.json` | 2项时序与8项故障对照通过 | `artifacts/qa/settings-controls-2026-10-13/background-timing.json` |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 最终报告逐项记录语法/入口/资源/版本结果 | `artifacts/qa/static-check.json` |
| `git diff --check` | 通过 | 提交前执行；职责注释阶段再次执行 |

截图 `deepseek-off.png`、`deepseek-on.png`保存在定向验收目录，已视觉复核开关禁用、位置及510px内部滚动布局。README设置截图更新为关闭总开关的实际Edge窗口。

新工具开发过程中修正了测试代码的端口名/消息类型、从设置页连接后台而非后台自连、批量模拟误匹配协议说明中的示例ID。旧后台时序工具补加载实际源码现在依赖的selection模块后通过。这些测试工具修正没有改变产品消息协议或批量解析实现。

## 验收边界与使用

真实DeepSeek账号权限、模型参数执行效果、回答质量、首字耗时和流式生成未验证；官方地址在测试中被转发到本机。原生系统右键菜单的鼠标点击和工具栏原生弹窗未操作：菜单创建/点击分发在VM执行，实际Edge确认已有菜单可更新，通过真实tabs.sendMessage、Range、内容脚本端口验证回答路径。其他浏览器和特殊网站未全面验收。

在 `edge://extensions` 重新加载根目录扩展，再刷新网页。进入设置选择触发方式和DeepSeek开关，点击“保存设置”。已有旧DeepSeek深度思考值且无新总开关时归一化为关闭，后续可由用户明确开启。

`Description.md`已同步本地职责及维护记录，继续由 `.git/info/exclude`排除，不进入任何提交。生成证据/profile保留在忽略目录。

## GitHub同步

同步目标为 `siwenyu1213/LingoClarify` 的 `main` 和现有任务分支。通过普通快进/推送保留全部历史；逐文件职责提交按原顺序进入main，以便GitHub默认列表显示各自功能。权限核对为ADMIN，两分支均返回protected=false，有效分支规则为空；传统保护返回明确Branch not protected。最终远程SHA和文件最新标题的逐项核对保存在 `artifacts/qa/settings-controls-2026-10-13/github-file-descriptions.json`。
