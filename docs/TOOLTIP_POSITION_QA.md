# 输出浮层拖动与选区避让验收

日期：2026-10-12，北京时间。起始分支 `codex/markdown-result-renderer`，工作区干净，HEAD 为 `bbd09aa5f7c49ede0d5f03cdbda347ea05b1e05e`。执行 `git fetch origin` 后当前任务分支与上游为 0/0；复用现有分支。远程 `origin/main` 的更新未合入本次功能分支。

## 修改与原因

旧定位只尝试下方与上方，再强制限制到窗口边界；卡片增长或选区居中时，上下空间不足，强制回退可能遮住原文。

- `content.js`：自动尝试下、上、右、左四个位置；都无法放下自然高度时，使用上下较大空闲区域限制高度。原文 Range 始终作为自动定位锚点。
- `content.js`：顶部标题区可拖动，使用 Pointer Events 捕获指针，释放、取消、失焦及关闭清理拖动状态。拖动不重新选择原文或触发新生成。手动位置保留到新选区、关闭或主动恢复自动定位。
- `content.js` / `content.css`：拖动光标、抓手与“拖动”提示。点击标题区展开四个方向按钮及“自动定位”；标题区聚焦后方向键移动 10px，Shift+方向键移动 40px，Home 恢复自动定位。按钮每次移动 40px。
- `content.css`：按可用空间限制卡片高度，保留内容滚动与底部操作，边界保留 10px。新操作有键盘焦点提示及可访问名称。
- 新增 `scripts/verify-tooltip-position.mjs`，同步 README、开发说明和本验收摘要；本地 `Description.md` 同步职责/清单/维护记录，但不暂存、提交或上传。

未改模型请求、配置或扩展版本（仍为 4.6.0）。这是当前分支上的交互修改，本次只保存本地版本。

## 实际验收

Node.js `v24.18.1`；隔离 headless Edge `155.0.4283.45`，实际加载本仓库 MV3 扩展。本机已有 Playwright 包被用于开发验收，没有引入 npm 或扩展运行依赖。

```powershell
node scripts/verify-tooltip-position.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify-markdown-fixes.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify-markdown.mjs --playwright 'C:/Users/siwen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

| 检查 | 预期与实际 | 证据 |
| --- | --- | --- |
| 浮层定向验收 | 15 项通过：顶部/中部/底部/右边缘、多行、375px 窄屏及横屏无选区重叠；拖动位置变化、原文选区保留、拖出头部释放、四边限制、滚动/resize、流式增长完成、按钮/键盘/复位、拖动中 Esc、重新划词重置、关闭/外部点击；页面异常为 0 | `artifacts/qa/tooltip-position-2026-10-12/report.json` |
| 既有交互回归 | 25 项通过：自动锚点、窗口限制、隐藏 Tab、流式焦点、下载成功/失败/迟到响应、缓存与观察器等 | `artifacts/qa/markdown-fix-2026-10-11/fixed/report.json`（本次重跑日期在报告内） |
| Markdown 回归 | 23 项通过：实际 SSE、Markdown 结构、原文复制、TXT 下载、缓存、解释此句、滚动、窄屏、链接清理、取消与失败恢复 | `artifacts/qa/markdown/report.json` |
| 静态与 diff | 33 项静态通过；`git diff --check` 无错误 | `artifacts/qa/static-check.json` |
| 视觉复核 | 实际查看中部、多行、窄屏、横屏及移动按钮截图，选中文字与卡片分离，正文滚动及操作可见 | `artifacts/qa/tooltip-position-2026-10-12/0.png`、`4.png`、`5.png`、`6.png`、`move-controls.png` |

定向验收曾发现标题按钮的点击被父节点的指针捕获重定向；捕获改为实际拖动按钮后复测通过。测试测量也改为独立原文 Range，避免点击按钮导致页面 Selection 折叠时测量错误对象。最终报告仅记录最新通过的一轮。浏览器和本机服务器已关闭，隔离 profile 保留用于复查。

## 加载与边界

在 `edge://extensions` 对本项目扩展点击“重新加载”，再刷新已打开的网页。继续使用原有模型和 Key 配置，不需修改设置。划词后按住顶部标题区域移动；点击标题区可以展开按钮。每次新的划词重新自动避让。

上述 UI 与消息路径在实际 Edge 扩展中执行，模型回答由本机合成 SSE 提供，不代表真实供应商 API 或输出质量验收。本次未读用户日常浏览器配置/Key；真实触屏手势、其他浏览器、特殊宿主页面（例如 transform 祖先或复杂 iframe）和用户日常已加载扩展未验收。选区铺满整个可见窗口、没有空闲区域时，无法在同一视口内同时做到可见且完全不重叠；此时仍保留可拖动入口，可手动移动或缩小选区。

本地提交可用唯一主题 `feat: make result tooltip draggable and avoid selections` 查询。未推送 GitHub。
