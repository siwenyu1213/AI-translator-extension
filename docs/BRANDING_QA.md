# 说文 · LingoClarify 改名与当前文档验收

日期：2026-10-13，北京时间。基线 `493798aca0502d39b1c7c5086e93923da9214e77`，分支 `codex/tooltip-header-cleanup`，起始工作区干净。等待另一个对话结束后开始，包含其已完成的浮层顶部简化。

本轮统一中文名“说文”、英文名“LingoClarify”；版本保持4.6.0。更新manifest/action、popup、划词标题/页脚、菜单、TXT名称及标题；重写README/开发/交接为当前行为，公开截图使用合成页面与配置，历史QA保留日期与基线。配置字段、DOM/CSS和消息标识保持一致，本地加载目录保留，Description.md忽略、不提交。

## 改动范围

- `manifest.json`、`popup.html`：名称、提示与标题统一为“说文 · LingoClarify”；4.6.0版本保留。
- `content.js`：初始、动态及“解释此句”标题都用“说文”，页脚用LingoClarify；保留原拖动/定位实现。
- `background.js`：菜单加说文名称，真实下载API使用“笔记/说文_时间戳.txt”，TXT首行统一名称。
- README、开发与交接重写为当前用途/操作，面向用户的入口不再列被删除控件、旧版本迁移或演进记录。
- 新增两张实际Edge合成截图及材料来源；历史QA只更新可点击的GitHub链接，保留其当时基线和结论。
- 同步既有回归的标题断言和合成仓库名称，配置字段、权限、注入入口、消息和DOM/CSS标识不改。

## 验证

日期：2026-10-13，Asia/Shanghai。Node `v24.18.1`，实际隔离Edge `155.0.4283.45`，Playwright使用本机既有包；没有安装扩展运行依赖。

| 检查 | 结果 | 本轮证据副本 |
| --- | --- | --- |
| 品牌及导出检查 | 6项通过，页面错误0；实际加载名称/action、popup标题和宽度、划词品牌、复制、下载完整内容及配置保留 | `artifacts/qa/branding-2026-10-13/browser-report.json` |
| Markdown实际Edge回归 | 24项通过；真实消息、本机SSE、Markdown/焦点/复制/TXT/再次解释/取消/错误恢复 | `artifacts/qa/branding-2026-10-13/markdown-report.json` |
| 浮层定位与顶部实际Edge回归 | 17项通过；选区避让、拖动/流式/滚动/窗口、光标、关闭与新选区重置 | `artifacts/qa/branding-2026-10-13/tooltip-report.json` |
| 解释和全文实际Edge回归 | 18项与3组正向对照通过；含再次解释成功/失败的新标题、Text更新/恢复、批量配额与取消 | `artifacts/qa/branding-2026-10-13/adversarial-report.json` |
| 后台离线模拟 | 45组通过；固定模拟不代表真实供应商 | `artifacts/qa/branding-2026-10-13/api-report.json` |
| 分类/请求构建离线回归 | 36项通过；任务、材料、语言、兼容输入与预算 | `artifacts/qa/branding-2026-10-13/prompts-report.json` |
| 静态与diff | 35项通过，`git diff --check`退出0 | `artifacts/qa/branding-2026-10-13/static-report.json` |
| 文档与来源 | 5份当前文档的17个本地链接通过，UTF-8无BOM/LF；manifest运行字段与基线一致，Description文件清单完整 | `artifacts/qa/branding-2026-10-13/document-report.json` |
| 视觉复核 | 查看设置与结果PNG，标题无溢出、正文/按钮正常、无移除的顶部控件 | `docs/materials/screenshots/settings.png`、`result.png` |

品牌截图和专项检查使用合成网页、型号、Key及本机HTTP回答，不读取日常浏览器配置；外部生成请求被拦截。浏览器和临时HTTP服务器已关闭，本轮profile及临时检查脚本保留在忽略的`.local/`。

下载检查保留实际API调用的请求文件名，并确认Chrome下载任务complete、TXT首行和Markdown内容；Playwright会把测试下载落盘为UUID，不能用测试落盘名推断产品请求名。专项脚本最初的文件名/event和缺少modelList的测试配置已修正，失败尝试单独保留；本次未为这些测试环境问题改变产品逻辑。再次解释回归发现的一处旧显示标题已修正后重跑通过。

## 加载与未验证项

在`edge://extensions`对原路径的扩展点击“重新加载”，再刷新网页。中文/英文显示名改变不要求重填Key；本地文件夹未移动，设置和原配置键保留。

未验证：真实厂家有效凭据的生成质量、速度、权限和全部参数；原生工具栏弹出层与原生右键菜单鼠标操作；其他浏览器、真实触屏和任意复杂网页。截图中的答案不作为真实模型质量证据。

## GitHub交付复核

目标仓库：`siwenyu1213/LingoClarify`，默认分支`main`；本地继续使用`codex/tooltip-header-cleanup`保存完成点。起始远程main是5fc9c1f，493798a是其后完成的浮层提交；上传范围包含它和本轮改名/文档提交。

推送前已确认自有仓库admin/push权限、main的protected=false、传统保护返回Branch not protected、生效rules为空、rulesets为空。正常推送须保持快进，不用管理员豁免或强推。

完成点的提交主题为 `chore: rename extension to LingoClarify and refresh current docs`。通过以下命令复核最终实际提交、名称、简介、topics及默认分支README；生成核对结果保存在`artifacts/qa/branding-2026-10-13/github-result.json`。

```powershell
git log -1 --oneline
git remote -v
git ls-remote origin refs/heads/main refs/heads/codex/tooltip-header-cleanup
gh repo view siwenyu1213/LingoClarify --json nameWithOwner,description,defaultBranchRef,repositoryTopics,url
```

GitHub历史提交、PR和验收快照保留。本次没有创建Release或修改历史发布；默认分支源码和当前说明是交付入口。Description.md已核对本地忽略及索引无记录，不上传。

### 已完成的远程核对

2026-10-13，仓库已改名为`siwenyu1213/LingoClarify`，About简介与6个topics已更新。源代码与文档提交`8bdd037e287c62cdbe5de132244d858e1b041925`已通过普通原子推送同步到main及codex/tooltip-header-cleanup，包含493798a的浮层调整；未创建PR或强推。

GitHub API核对：默认分支main、两个远程提交均等于本地HEAD；远端README与本地逐字一致，manifest名称正确，两张截图blob SHA与本地一致。GitHub返回的README渲染HTML包含新标题和两张截图。记录在上述github-result.json与rendered-readme.html，工作区干净，Description.md未跟踪。后续本段验收记录的文档提交不改变已验收运行源码。
