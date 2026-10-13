# 项目工作规则

本文件规定仓库维护、已有成果保护、验证证据、提交交付和私有材料存放要求。

## 项目与适用范围

- 本文件适用于整个仓库。开始任务先读 README.md、docs/DEVELOPMENT.md，以及未来新增的子目录规则。
- 这是原生 JavaScript / HTML / CSS 的 Manifest V3 扩展；根目录源码可直接在 Edge 中加载。当前没有 npm 依赖或构建步骤，不为例行任务引入框架或包管理环境。
- background.js 管理服务工作线程、API 代理和下载；content.js 管理划词浮层；content-fullpage.js 按需注入执行全文翻译；popup.* 管理设置；manifest.json 声明扩展入口。
- 如果根目录存在本地 Description.md，开始任务时一并读取。新增、删除、重命名项目文件，或改变职责、入口、调用关系、配置与验证方式时，在同一任务中同步更新对应说明和维护记录；从远程更新代码后也要复核。
- Description.md 是用户的本地文件说明，使用本仓库 .git/info/exclude 中的 /Description.md 规则排除；不得暂存、强制添加、提交或上传该文件。规则仅对存在此本地文件的工作目录适用。

## 保护已有成果

- 任务开始记录 git status --short --branch、HEAD、远程和已有改动；区分用户原有修改与本任务修改。
- 复用现有 Git 仓库，保留 .git、历史和远程配置。不得为清理目录而删除版本记录。
- 不覆盖、回滚或提交与任务无关的用户修改；暂存时列出明确文件路径，避免 git add .。
- 修改现有规则时保留仍有效的内容。运行代码的小修不要求改扩展版本号；发布功能版本时同步 manifest.json 与 popup.html 中的版本显示。
- 遵循 .gitattributes：源码和文档使用 UTF-8、LF。新增 Windows 启动脚本时另行处理其编码和行尾要求。

## 材料与产物存放

- 最终运行成果：沿用根目录的扩展文件；可复用的验证工具放 scripts/，开发说明、验收摘要放 docs/。
- 可提交的原材料：docs/materials/，附来源、取得日期及用途；只存有权公开的非敏感材料。
- 私有网页样本和原材料：.local/materials/；临时脚本、缓存、下载：.local/tmp/；独立浏览器配置：.local/browser-profile/。
- 生成日志、截图、检查 JSON：artifacts/qa/；分发副本与压缩包：artifacts/releases/。这些生成目录由 .gitignore 排除，最终可复查摘要应写入 docs/。
- 不把 API Key、授权头、浏览器 storage 导出或用户私有网页内容提交到 Git。API Key 按现有设置界面输入；验证证据需去除敏感信息。

## 验证与验收证据

- 每次改动至少运行 node scripts/verify.mjs --report artifacts/qa/static-check.json 和 git diff --check。
- 静态入口检查 JavaScript 语法、Manifest V3 的基本字段、manifest 声明资源、设置页本地 JS/CSS、后台字面量注入文件以及设置页显示版本；它不是完整的浏览器规范或安全审计。
- 功能修改必须验证受影响的实际路径；涉及设置、消息通信、服务工作线程或 DOM 的修改，按 docs/DEVELOPMENT.md 在 Edge 中验收。
- API 修改用有效凭据验证相应供应商、模型、流式响应和失败处理；离线模拟结果须明确标为模拟，不代表真实 API 已通过。
- 留下可复查证据：日期、Git 提交/待提交文件范围、浏览器/工具版本、操作步骤、预期与实际结果、报告或截图相对路径。
- 不能执行的检查明确标为未验证，并说明缺少什么；不得将语法通过写成扩展可运行、真实模型可用或全部功能通过。

## 交付和版本保存

- 交付说明包含加载/重新加载方式、必要配置、已执行检查、验收证据、未验证项和剩余问题。
- 一个有意义且经过相应验证的完成点保存为本地 Git 提交；先审阅 diff，再仅暂存本任务文件。提交说明写清改变及目的。
- 默认新开发分支使用 codex/ 前缀；已有任务分支则复用。环境准备可在工作区干净的现有分支保存一次本地提交。
- GitHub 推送、合并 PR、发布版本按用户授权执行。仅保存本地版本不等于已上传 GitHub。
- 开始新功能前工作区干净时执行 git fetch origin，比较当前分支与上游；main 仅落后时用 git pull --ff-only origin main。发生分歧先检查提交内容再整合。
