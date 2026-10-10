# 工作环境准备记录

记录日期：2026-10-10，Asia/Shanghai。此文档是本次准备任务的快照，工具和远程状态在后续任务开始时应重新核实。

## 实际目录和起始状态

- 工作目录：C:\Users\siwen\Desktop\Workspace\工具\AI-translator-extension。
- 已有 Git 仓库直接复用；当前分支 main，远程 origin 为 https://github.com/siwenyu666-beep/AI-translator-extension.git。
- 开始任务时 HEAD：69efda7663b69521c27eef8348a3a1fe901d16ac，主题为 Merge pull request #7 from zdjmrq/main。
- 起始 git status --porcelain=v1 --untracked-files=all 为空，没有用户未提交修改或未跟踪文件。
- 已执行 git fetch origin，开始修改前 HEAD...origin/main 的领先/落后数为 0 / 0。
- 已检查工作目录及其全部父目录至 C:\ 下的 AGENTS.md，未发现适用文件；本次新建根目录 AGENTS.md。
- 已读 README.md、manifest.json、.gitignore、.gitattributes，并检查设置页和后台注入入口。
- 扩展版本 3.5.0，原生 JS/HTML/CSS，MV3 服务工作线程，无 package.json、锁文件、构建配置或既有测试入口。

## 可用工具

| 工具 | 实测版本/状态 | 本任务用途 |
| --- | --- | --- |
| PowerShell | 7.6.5 | 本机文件和命令操作 |
| Git | 2.55.0.windows.3 | 复用仓库、比较提交、保存版本 |
| GitHub CLI | 2.97.0；已登录 siwenyu666-beep，HTTPS | 查询 GitHub；本任务不推送 |
| Node.js | v24.18.1 | 无依赖静态检查 |
| npm | 11.16.0 | 可用，本项目当前无需安装依赖 |
| Python | 3.13.14 | 可选样本 HTTP 服务；本任务未启动 |
| ripgrep | 15.2.0 | 文件和源码搜索 |
| Microsoft Edge | 154.0.4258.62 | 后续实际扩展验收；本任务未启动 |

Edge 可执行文件：C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe。Chrome 未在 PATH 或本次检查的标准 Program Files 安装路径中找到，不据此断言机器完全未安装 Chrome。

Git 作者身份已配置。core.autocrlf 为 true，仓库 .gitattributes 指定 text=auto eol=lf，新增源码/文档沿用 LF。

## 本次准备成果

- AGENTS.md：保护已有修改、文件存放、验证边界、交付内容和完成点版本保存规则。
- docs/DEVELOPMENT.md：环境和加载步骤、静态检查命令、浏览器功能验收清单、证据模板、Git 同步流程。
- scripts/verify.mjs：使用 Node.js 内置模块进行离线静态检查。
- .gitignore：新增 .local/、artifacts/ 和本地 .env 文件忽略规则。
- README.md：保留开发目录的 Git 历史，链接开发说明和检查入口。
- 本机已建立 .local/materials/、.local/tmp/、.local/browser-profile/、artifacts/qa/、artifacts/releases/；这些目录不进入 Git。
- 本次没有更改 background.js、content.js、content-fullpage.js、popup.js、HTML/CSS 或 manifest.json 的运行逻辑。

## 验收证据

- 已执行 node scripts/verify.mjs --report artifacts/qa/static-check.json，退出码 0，12 项通过、0 项失败。
- 报告首次检查时间：2026-10-10 15:27:54（北京时间）；报告时间字段使用 UTC ISO 格式。保存提交后重新运行时会刷新报告并记录实际检查的 HEAD。
- 已执行 git diff --check，无空白错误；暂存后还需检查 git diff --cached --check。
- 静态报告：artifacts/qa/static-check.json，本机忽略文件，可根据命令复现。
- 初次检查针对基线 69efda7 加本任务未提交修改；完成提交后的报告应显示最终 HEAD 和干净工作区。

## 未验证与后续缺口

- 未在 Edge 中加载扩展或查看渲染，没有浏览器 UI、chrome.* 消息/storage/download 和网页 DOM 功能验收证据；需要按开发说明实际加载、重新加载并操作。
- 未读取浏览器中的 API Key，未调用 DeepSeek / 千问接口；需要有效测试凭据和实际调用才能验证模型列表、真实流式输出与在线错误处理。
- 当前没有自动浏览器回归测试；功能修改仍需实际浏览器验收，复杂改动再按需求补充自动化。
- README 声明 MIT，但当前仓库没有 LICENSE 文件；对外正式发布时应补齐所采用许可证的文本。此项不阻止本地开发。
- 当前任务仅完成环境准备，没有新的功能需求；后续按具体改动选择验证路径。

## 版本保存

准备完成点保存为 main 上的本地提交，唯一主题：chore: prepare extension development environment。可用 git log -1 查看提交号，或 git log --all --grep="prepare extension development environment" 定位。

只暂存本任务的六个文件：.gitignore、README.md、AGENTS.md、docs/DEVELOPMENT.md、docs/WORK_ENVIRONMENT.md、scripts/verify.mjs。原运行文件保留原版本；生成报告和私有目录不提交。

本任务不推送 GitHub，完成后本地预计比 origin/main 领先 1 个提交。后续新功能使用 codex/ 分支保存经过验证的完成点；上传和 PR 合并按用户授权执行。
