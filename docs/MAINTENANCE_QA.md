# 保持现有行为的项目审查与清理

日期：2026-10-10，北京时间。扩展版本仍为 4.4.0。

用户要求审查并优化可简化之处，保留现有功能与界面，然后清理工作目录。本次审阅运行文件、设置、数据目录与验证流程；没有引入框架、包依赖或构建步骤。

## 已完成的简化

| 范围 | 改动及保留行为 |
| --- | --- |
| 内置模型目录 | 每款模型一行，文件由 39,643 降为 30,824 字节，减少 22.25%；深度比较确认原 10 家、210 款及所有字段/顺序完全一致。公开与账号列表刷新规则不变 |
| 设置样式 | 删除无对应控件的 link/divider/download-hint、旧调用名编辑/删除/消息样式；合并重复 hint 定义。三个实际窗口状态的计算样式和元素矩形均与旧 CSS 一致 |
| 设置查询 | 公开目录与账号模型查询共用通信恢复函数；维持无回复/通信故障才恢复、明确鉴权等接口错误不绕过 |
| 配置加载 | 按字段比较，仅写实际迁移/归一化改变的字段；顶层键顺序与重复读取不触发重写，原值、未知偏好及旧迁移清理规则保留 |
| 全文翻译 | 读取文本与落盘译文共用遍历规则，取消/重新开始共用原文恢复；块级与跳过标签范围、恢复顺序保持原样 |
| 后台 | 删除全仓未引用的 hashString 函数；流式协议、提示词、路由、缓存、权限保持现有实现 |
| 验证工具 | 每轮关闭 Edge 后自动删除本轮独立 profile，并将结果写入报告；可选 --compare-ref 比较界面，扩展运行不依赖这些工具 |

## 验证证据

开始分支 `codex/openai-compatible-api`，HEAD `4480fca96bc935c673750c9ff506836c6fc6eb3d`，工作区干净，已 fetch origin。保留原分支、历史和远程；审查范围为六个运行文件、两项验证脚本、README、开发说明及本摘要。`Description.md` 在本地同步并继续排除。

工具：Node.js v24.18.1，Edge 154.0.4258.62，已有 Playwright。

| 检查 | 执行与结果 | 证据 |
| --- | --- | --- |
| 静态入口 | `node scripts/verify.mjs --report artifacts/qa/static-check.json`：17 项通过 | `artifacts/qa/static-check.json` |
| 后台模拟 | `node scripts/verify-api.mjs`：37 组通过，新增字段顺序无写入、按变化字段写入，原有模型查询/迁移/流式路径通过 | `artifacts/qa/api-simulation.json` |
| 实际 Edge | `node scripts/verify-browser.mjs --playwright '<已有包目录>' --compare-ref 4480fca`：23 组通过，相关页面异常 0，本轮 profile 已删除 | `artifacts/qa/browser-check.json` |
| 界面一致 | 首次 Key、已保存 Key、自定义地址 dialog 的全部元素计算样式和矩形与优化前一致 | Edge 报告三个对比项目 |
| 全文保留结构 | 实际翻译内联 span/link、image、JSON script 样本，链接属性/图片/脚本保留，原文切换与取消完整恢复 | Edge 报告、本机 HTTP/SSE 样本 |
| 数据一致 | 新旧目录深度相等；完整数据 SHA-256 为 `ef441f00780751ace19cd1b75be4f62e5bf92d665e095f491b4e92e59722494a` | `artifacts/qa/catalog-equivalence.json` |
| Git 检查 | `git diff --check`：退出码 0 | 终端记录 |

Edge 实测使用隔离 profile，公开目录及不带凭据的 DeepSeek 探测为真实网络；厂家成功/鉴权/5xx 与生成使用明确模拟，划词和全文通过真实本机 HTTP/SSE 验证。不读取用户日常浏览器设置或真实 Key。真实账号生成、全部供应商/模型能力、原生工具栏及右键菜单鼠标操作仍未验证；本次保持原支持范围。

## 清理结果与保留内容

删除清单已在执行前打印；所有目标都核对为仓库内本会话生成物。使用明确路径删除，共清理 4,046 个文件、267,492,757 字节（约 255 MiB），并去除空临时目录：

- `.local/tmp/`：8 个一次性编辑/建目录脚本与旧快照，工作已完成且不被运行文件依赖。
- `.local/browser-profile/api-qa/`：4,023 个独立 QA profile/缓存文件，包含本会话旧轮次；不涉及日常 Edge profile。
- `artifacts/qa/`：15 个旧截图/快照/过期检查文件。逐项路径、数量及删除结果在 `cleanup.json`，所有清理目标均已移除。
- 空的 `.local`、其临时/材料/浏览器目录，以及 `artifacts/releases/` 已移除；开发工具按需重新创建。

保留根目录 10 个扩展运行文件、Git、README、规则文件、`scripts/` 可复用验证工具、`docs/` 当前及历史说明和本地 `Description.md`。`artifacts/qa/` 保留最新静态/API/浏览器报告、目录等价与清理报告、Key 已保存/模型服务错误/鉴权错误/划词流式四张关键截图，以及已有的独立 `popup-audit-2026-10-10/` 审查成果。后者为现有交付物，未纳入本次删除。

历史验收摘要继续保留，但部分旧生成证据已按本次清理移除；需要复跑时使用可复用脚本。完整清理证据为 `artifacts/qa/cleanup.json`。

更新后在 `edge://extensions` 重新加载扩展，并刷新已打开网页，使旧内容脚本更新；“扩展已重载，请刷新页面后重试”表示网页脚本连接失效，按提示刷新网页。沿用已保存配置，不要求重新填写 Key。

本地提交主题：`refactor: simplify internals and keep QA workspace clean`。未推送 GitHub。
