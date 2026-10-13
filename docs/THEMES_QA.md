# 三主题与引号品牌图标验收

日期：2026-10-13，北京时间。扩展保持 4.6.0。起始 HEAD：de98ff6d44da43d85883b4a6e2d6a2a74654329a；分支 codex/tooltip-header-cleanup，起始工作区干净，fetch 后与上游 0/0。此次保存本地完成点，不推送或发布。

第一次宽度修复（历史，提交6eeb3ce）：以干净 fc95436545b145d1ec62ac818b4dac5c0d7c7d7a 为基线，将首选宽度380→520px，解决厂家截字、全文翻译与Key操作拆行，并验证真实浏览器缩放。

当前尺寸修复：以干净6eeb3ce4ef269a5a140f2fa9133790ec0662049f为基线，按用户截图标框的比例将首选宽度520→390px、高度上限设为510px；收紧标题、控件及区块留白。340px以下厂家/语言自动单列，260px以下进一步压缩内边距。额外选项在body内滚动，操作文字保持整段。更新原有verify-themes、当前设置截图及说明，保存独立本地提交，不推送。

## 最终行为

- 设置页、划词浮层与全文工具栏共用蜜桃涂鸦的控件布局、轻微不规则轮廓和阅读层次。
- 三种主题：钴蓝纸页（默认）、蜜桃涂鸦、靛蓝手稿。设置页底部选择后即时保存 uiTheme；已打开的网页界面同步更新，重新打开和新网页继承选择。旧配置、未知值或删除字段回退钴蓝。
- 外观写入只包含 uiTheme，不保存模型、厂家、语言或 Key 草稿。写入失败显示错误并恢复原主题；普通“保存设置”不覆盖独立的主题字段。
- 使用靛蓝手稿的引号图标方向。icons/brand.svg 为原创双色引号，各界面使用同一图标；清单声明 16/32/48/128px PNG。切换主题保留图标颜色。
- 删除两个配置面板里的 DeepSeek 官方固定关闭思考提示。仅移除展示文字，后台有效思考策略与原保存值保持；真实端口请求回归继续验证官方主机的 thinking.disabled。
- 本地打包字体，来源与许可见 [字体说明](../vendor/fonts/README.md)。注入页面使用明确的扩展资源 URL，避免将字体/图标相对地址解析为宿主页面资源；外观变量只施加到扩展自己的根元素。
- 设置弹窗首选390px宽、最高510px；开启思考强度或编辑Key后在窗口内部滚动，保存设置与主题控件仍可访问。

## 执行证据

Node 24.18.1；Edge 155.0.4283.45；Playwright 使用本机既有包。实际解压扩展运行于独立 profile，使用合成页面、合成 Key、本机 HTTP/SSE；目录快照在 Worker 中明确模拟，非本机 HTTP 请求阻止。未读取用户日常 storage。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| verify-themes.mjs | 最新18项实际 Edge通过：原主题回归、390px/真实150%和200%浏览器缩放、510px高度与滚动访问 | artifacts/qa/themes-2026-10-13/report.json |
| verify-markdown.mjs | 24 项实际 Edge 通过：流式/Markdown/复制/TXT/思考策略/错误恢复/无远程渲染 | artifacts/qa/markdown/report.json |
| verify-tooltip-position.mjs | 17 项实际 Edge 通过：避让、拖动、流式/滚动/窗口约束、关闭与光标 | artifacts/qa/tooltip-header-2026-10-13/report.json |
| verify-adversarial-config.mjs | 5 项实际 Edge 通过：停用恢复、换址、Key 草稿、迟到响应、模型过滤 | artifacts/qa/adversarial-fix-2026-10-11/config/ |
| verify-api.mjs | 45 组后台离线模拟通过 | 本次命令输出；模拟不表示真实供应商通过 |
| verify.mjs 与 git diff --check | 48 项静态通过，diff 无空白错误 | artifacts/qa/static-check.json |

三种主题的设置、划词结果与工具栏截图位于 artifacts/qa/themes-2026-10-13/；正文/提示/主按钮文本对比度均不低于 4.5:1。已逐张视觉复核。本机生成截图不包含真实凭据。

宽度专项使用chrome.tabs.setZoom改变实际Edge扩展页缩放，100%/150%/200%的CSS可用视口为390/260/195px。后两种自动单列，DeepSeek与DeepSeek-V4.1-Flash完整文字的测量宽度均小于控件可用宽度；标签与Key文字保持整段。长展示名由QA明确替换，仅用于排版压力测试，连接仍为本机合成接口。对应截图popup-width-zoom-1.png、-1.5.png、-2.png。

高度专项打开思考强度与Key编辑，实测body和html均为390×510px，内部内容高度717px；逐个滚动到思考强度、Key输入、取消、保存设置和主题选择，所有控件都完整进入窗口。恢复草稿后窗口继续保持510px上限。三主题设置截图改为捕获body的实际窗口边界，均为390×510px；高度专项截图popup-height-510.png。本轮18项主题与48项静态重新执行；表中其他回归是前一轮成果，运行源码只修改设置页CSS。

旧回归适配了三个明确变化：设置页不再出现固定关闭提示；h2 从17px调整到21px，宿主标题仍独立保持22px；本地扩展字体/图标请求属于本地资源，远程渲染请求仍要求为空。拖动样本上移以保留35px自由拖动空间，独立的边界约束测试仍保留。

## 加载与剩余边界

在 edge://extensions 对既有根目录加载的扩展点击“重新加载”，再刷新已打开网页。无需重填既有 Key；设置窗口底部“主题风格”选择后自动保存。初次配置仍按原步骤填写接口/Key并选模型。

未验证：原生工具栏弹出窗口的人工鼠标验收、原生右键菜单、其他浏览器/触屏/任意复杂网站或特殊 CSP；各厂家真实 API、模型质量和速度。设置截图来自实际 Edge 中打开的扩展 popup.html，不把它等同于原生工具栏弹出层。固定合成回答不代表真实模型效果。

完成点提交主题：feat: add three persistent themes and quotation brand icons；当前尺寸修复：fix: size settings popup to compact reference bounds。Description.md 同步在本地维护，按 .git/info/exclude 排除，不暂存、不提交。
