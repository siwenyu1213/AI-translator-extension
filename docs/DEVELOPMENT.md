# 开发、运行与验收

## 环境与目录

这是直接加载的 Manifest V3 浏览器扩展，没有开发服务器、打包流程或 npm 依赖。扩展运行需要支持 MV3 的 Edge / Chrome；静态检查需要 Node.js，版本管理需要 Git。当前机器已核实的版本和起始状态见 [WORK_ENVIRONMENT.md](WORK_ENVIRONMENT.md)。

在 PowerShell 中进入项目：

```powershell
Set-Location -LiteralPath 'C:\Users\siwen\Desktop\Workspace\工具\AI-translator-extension'
git status --short --branch
```

根目录继续放扩展运行文件。scripts/ 放可复用开发脚本；docs/ 放最终说明和验收摘要。docs/materials/ 可放公开原材料及来源记录；.local/materials/ 放私有材料，.local/tmp/ 放临时工作文件，.local/browser-profile/ 放隔离的浏览器配置。生成证据放 artifacts/qa/，分发产物放 artifacts/releases/。私有和生成目录不进入 Git。

## 静态检查

```powershell
node scripts/verify.mjs --report artifacts/qa/static-check.json
git diff --check
```

检查脚本使用 Node.js 内置模块，无需 npm install，不联网，不调用供应商 API，不启动浏览器。退出码 0 表示脚本所列检查通过，非 0 表示失败。JSON 报告包含时间、工具版本、运行时检查对应的 HEAD、未提交文件状态及逐项结果。报告的 HEAD 是检查开始时的版本；若检查的是未提交修改，须结合 workingTree 记录判断范围。

检查覆盖：仓库源码中的 .js/.mjs 文件语法、Manifest V3 基本入口、manifest 声明的资源、popup.html 中的本地 JS/CSS 引用、background.js 中 files 字面量引用、设置页版本与 manifest 版本一致性。不完整校验 Manifest schema、HTML/CSS 渲染、chrome.* API、真实流式交互或供应商模型可用性。

## 加载与更新扩展

1. 打开 Edge 的 edge://extensions，开启开发人员模式。
2. 点击“加载解压缩的扩展”，选择项目根目录。
3. 打开扩展设置页，输入对应供应商的 API Key，配置模型和触发方式并保存。
4. 修改源码或 git pull 后，在扩展管理页点击该扩展的重新加载按钮，并刷新已打开的测试网页，使旧内容脚本更新。
5. 检查扩展管理页的错误信息，必要时打开服务工作线程的开发者工具。

浏览器内部页面等受限制页面不能作为内容脚本功能的有效验收样本；使用普通 HTTP/HTTPS 测试网页。模型调用名及账号权限以实际供应商接口结果为准，仓库中的展示文字不能作为在线可用性证据。

## 功能验收清单

只要求覆盖本次修改影响的路径；整体发布时覆盖下列路径。每项记录通过、失败或未执行，不能统一推断为通过。

| 路径 | 最低验收内容 |
| --- | --- |
| 加载与设置 | 扩展成功加载、设置页显示正常、两个标签独立保存、重新打开后配置保留、无相关浏览器报错 |
| 模型列表 | 选择、新增、修改、删除；有效调用名检测成功，无效调用名/凭据出现错误且不会错误保存 |
| 划词 | 自动和右键触发；外语短词/长段、中文短字/长段分类及对应输出；Esc 关闭 |
| 流式请求 | 文本逐步显示、完成状态正确；测试相关断网、无效 Key、取消或重载情况，记录实际错误处理 |
| 全文翻译 | 右键空白处启动、滚动新内容、原文/译文切换、取消恢复；检查链接/图片及页面布局 |
| 复制与下载 | 剪贴板内容、TXT 文件内容与浏览器实际下载位置 |
| 供应商 | 改动涉及的 DeepSeek / 千问真实模型请求；成功和失败场景分别记录 |

可使用 .local/materials/ 下的样本，经本地 HTTP 服务访问；若需临时服务，从样本目录运行 python -m http.server 8765 --bind 127.0.0.1，并在验收后停止。本任务没有创建网页样本或启动服务。

## 证据与交付

每个完成点在 docs/ 中保存简短验收摘要：

```text
日期与时区：
检查时的提交及未提交范围：
Node / 浏览器版本：
变更目的：
运行或重新加载步骤：
已执行：命令或操作、预期、实际、退出码/结果
证据：artifacts/qa/ 下报告、日志、截图的相对路径
未验证：项目、缺口、下一步需要什么
本地提交：提交号或通过 git log 查找的唯一提交主题
GitHub 状态：已推送 / 未推送
```

生成证据默认只保存在本机；需要向他人交付时附上已脱敏的证据文件或精简的可提交样本，不能仅提供一个他人无法访问的本机路径。

## 保存版本与同步

任务开始记下已有改动。新功能通常先从合适的基线创建分支，例如 git switch -c codex/feature-name。验证通过后检查并暂存明确文件，再提交：

```powershell
git diff --check
git diff
# 按任务列出具体文件，不使用全目录暂存
git add -- AGENTS.md docs/DEVELOPMENT.md
git diff --cached
git commit -m "docs: describe extension development workflow"
```

上述文件列表仅为示例，实际提交须包含本任务的完整且准确范围。需要上传时按用户授权执行 git push；出现 PR 时先审核/验收、在 GitHub 合并，再在干净的本地 main 上执行 git pull --ff-only origin main。若本地 main 有自己的未推送提交，先比较两边历史再决定整合方式。
