# 对抗式审查问题的复现验证

后续状态：本地已修复 R01–R15，当前脚本默认要求修复行为通过，详见 [ADVERSARIAL_FIX_QA.md](ADVERSARIAL_FIX_QA.md)。以下是提交 `bfb3f65` 的漏洞存在性验证历史；“仍待修复”、退出0的旧含义及以下工具行为仅适用于那个提交。

日期：2026-10-11，北京时间。新分支：`codex/verify-adversarial-findings`。创建分支前 HEAD 为 `ed721fed61bc6ea9972cf270cb78db865aa91a0e`，工作区干净。该提交的产品源码与原审查基线 `9f860f9` 一致。

本轮只新增可复用验证工具和维护文档，未修复或修改根目录产品源码。没有推送 GitHub。远程仍为 `origin https://github.com/siwenyu666-beep/AI-translator-extension.git`；未进行远程整合，以保留审查基线。

## 结论与证据等级

[原报告](ADVERSARIAL_REVIEW.md) 的 R01–R15 全部成功复现，没有撤销的问题。现有 5 项 P1、10 项 P2 评级继续保留。这里的 confirmed 表示问题存在，不表示产品验收通过，也不表示这些功能错误均是可被外部攻击者利用的安全漏洞。

全部 15 项均在实际加载的 Edge 扩展中观察到：真实 popup、storage、Service Worker、runtime 端口、按需注入和内容脚本使用未修改的项目代码。生成接口为 `127.0.0.1` HTTP/SSE，Key、网页和响应均为合成样本。R15 的 Mistral `/models` 和公开目录在 Worker 内拦截，未向官方发送合成 Key。

R05/R09 的实际 Worker 复现通过包装原生 `chrome.storage.local.get` 控制旧读取交付时刻：先调用原生读取取得快照，再延迟返回。实际 onChanged 或端口断开事件在释放旧读取前确认发生。AIConfig.load、getConfig、handleStreamRequest 均未替换。该方法证明可达的时序错误，未测量普通浏览器使用中的出现频率。另有使用真实 config.js/background.js 的离线 VM 复现作为补充。

环境：Node.js v24.18.1、Edge 154.0.4258.62、已有 bundled Playwright。没有安装 npm 依赖或改变扩展运行方式。

## 逐项结果

| ID | 结论 | 本轮实际观察 | 证据 |
| --- | --- | --- | --- |
| R01 | confirmed | 请求期间网页同一文本节点更新为新状态，回包覆盖新状态；取消恢复初始旧原文 | browser/results.json |
| R02 | confirmed | 已翻译 P 用 appendChild 移动容器，取消后仍是译文，data-ds-translated=true | browser/results.json |
| R03 | confirmed | contenteditable 草稿、祖先 data-ds-skip 的段落及 PRE 下子块，均被真实 Worker 请求传给本机接口并改写 | browser/results.json |
| R04 | confirmed，收紧并发数表述 | 最新完整运行最大同时待完成原生 fetch 为 **239**，超过 50；测量时本机服务收到 25 个批量、6 个保持等待的单块请求 | browser/results.json |
| R05 | confirmed，提升至实际 Worker | storage 已保存 new-chat、新地址、目标日语，缓存仍是 test-chat、旧地址、目标中文；本机实际收到旧路径和旧模型 POST | browser/results.json；background/results.json 补充 |
| R06 | confirmed | 链接元素及 href 保留，但翻译态链接文字为空；取消后恢复文字作为对照通过 | browser/results.json、browser/R06-link.png |
| R07 | confirmed | 法语→英语、中文→日语均为 0 请求，工具栏显示已是目标语言 | browser/results.json |
| R08 | confirmed | 已翻译段落新增 SPAN，500ms 后请求数量未增加，新文字仍为原文 | browser/results.json |
| R09 | confirmed，提升至实际端口 | 配置读取交付前关闭卡片，Worker 已收到实际 onDisconnect；释放旧读取后仍发出一次本机 POST | browser/results.json；background/results.json 补充 |
| R10 | confirmed | Worker 主动断开实际流端口，卡片提示连接中断；同一可见选区再次通过 tabs 消息触发，未产生新请求；关卡片再触发可成功 | browser/results.json |
| R11 | confirmed | 翻译完成后点解释此句，本机接口返回 400；可见错误状态下点击实际复制按钮，真实剪贴板仍得到旧译文 | browser/results.json、browser/R11-stale-copy.png |
| R12 | confirmed | Range 选第二个 bank；本机 API 收到的提示词上文仍为第一个 bank 之前的 The，而非实际第二个选区上下文 | browser/results.json |
| R13 | confirmed | 实际 popup 保存后 enabled=false，无启用控件，实际端口返回扩展已禁用、0生成；只把 enabled 改true后成功 | config/results.json、config/R13-disabled.png |
| R14 | confirmed | 实际自定义地址 dialog 保存新本机地址，/models 返回404，界面型号空；存储仍保留旧型号，实际向新路径 POST old-chat | config/results.json、config/R14-new-address.png |
| R15 | confirmed | 合成厂家 /models 同时提供 native Mixtral 和另一文本型号，实际 popup 只保留另一型号；带 mistralai/ 前缀的 Mixtral 对照可通过 | config/results.json、config/R15-mistral-options.png |

表中证据路径均相对于 `artifacts/qa/adversarial-validation-2026-10-11/`。聚合结果、工具版本、Git 分支及产品源文件哈希对照见该目录 `summary.json`。

## R04 的准确边界与第一轮检查错误

原报告中的 512 是合成端口复现的应用层单块任务数量。本轮实际浏览器中，单块未完成请求占用本机 HTTP 连接池，其他请求会在浏览器网络层等待。因此不能把 512 个模拟任务直接称作 512 条同时建立的 TCP 连接，也不能据此推断真实厂家计费数。

第一轮实际测试错误地等待全部 576 次 fetch（64 批量+512单块）出现，因浏览器网络池阻塞而超时，归为 check_failed。原始结果保留在 `browser/initial-check-failed.json`。修改的是验证脚本的等待条件和取消收尾，产品代码未变。

随后按真实不变量“待完成原生 fetch 是否超过50”测量，连续完整运行均确认超过上限。最新运行观测为239，较早完整运行也超过50，数量会随网络调度改变；精确不变量是大于50。报告同时记录 fetch 调用、pending/maxPending、端口和本机收到的批量/单块数量。

这也说明仅等待回退的 Promise.all 不能保证 50 个真实请求的额度：每个实际生成请求仍须经过统一并发调度。

## 重复执行与正向对照

实际 browser 脚本最终完整版本连续运行两次，12个问题均 confirmed，3组对照 passed。config 脚本由子 agent 运行后，主 agent 独立重跑，3个问题均 confirmed，3组对照通过。背景 VM 两项由子 agent 和主 agent 分别执行，2组对照 passed。

八组对照分别覆盖：静态原文/链接取消恢复、关闭卡片后同文重试、实际 Worker 完成读取后修改可正常更新配置、VM正常缓存失效、VM监听已安装后取消、启用状态恢复后生成、旧自定义地址正常生成，以及普通/带厂家前缀模型可选。R05 VM 的迁移写入数为0，排除了迁移重写干扰。

主 agent 已查看 R11 错误正文与仍可复制的实际截图；子 agent 已查看设置的三张截图。

## 可复用工具与执行方法

三个工具都使用当前 checkout 的产品源码，不复制旧版本运行代码。结果状态为 confirmed、not_reproduced 或 check_failed。退出0表示所有预期问题复现及对照检查成功；问题消失或工具失败会返回非零，需要按 JSON 状态判断，不可写成产品全功能通过。

```powershell
# 无依赖、无网络的真实配置/后台 VM 时序复现
node scripts/verify-adversarial-background.mjs

# 使用已安装 Playwright，实际加载扩展并执行页面/后台路径
node scripts/verify-adversarial-browser.mjs --playwright '<已有 playwright 包目录>'

# 实际设置页、存储、连接与型号过滤路径
node scripts/verify-adversarial-config.mjs --playwright '<已有 playwright 包目录>'
```

本机 `<已有 playwright 包目录>` 是 `C:\Users\siwen\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright`。两个浏览器工具可追加 `--edge '<msedge.exe路径>'`；不传时使用已安装 msedge。无需 npm install，无需用户真实 Key。

脚本职责：

- `scripts/verify-adversarial-browser.mjs`：R01–R12（包含 R05/R09 实际 Worker 时序），真实内容脚本、端口、本机生成及剪贴板；报告 browser/results.json，并保留时间戳完整运行副本。
- `scripts/verify-adversarial-config.mjs`：R13–R15，实际 popup、连接存储与接口模型过滤；报告 config/results.json。
- `scripts/verify-adversarial-background.mjs`：R05/R09 离线时序及对照；报告 background/results.json，可用 --report 指定位置。

已执行最低检查：`node scripts/verify.mjs --report artifacts/qa/static-check.json`，20项通过；`node scripts/verify-api.mjs`，43组模拟通过；`git diff --check` 通过。新增脚本语法属于这20项，实际复现运行结果另见上表。

## 资源、产品加载与未验证范围

所有测试浏览器和本机服务器已关闭。每轮新建独立 profile，保留于 `.local/browser-profile/adversarial-validation/` 和 `.local/browser-profile/adversarial-config/`，各 JSON 记录具体路径。没有读取日常 Edge profile 或真实用户 storage；没有递归删除旧审查 profile。生成报告、截图、profile 均被 Git 忽略。

产品仍是加载根目录的 v4.4.0，无需为新增验证脚本重新加载日常扩展；若后续修复产品，按 README 在 edge://extensions 重新加载并刷新测试网页。日常真实使用仍需要对应厂家的有效 Key 和接口开放模型，测试凭据不能用于供应商。

未验证：真实供应商 API/权限/质量/计费/限流；原生工具栏弹出层和右键菜单的鼠标操作；多站点出现频率和兼容性；攻击者可利用性及安全严重性评估。R05/R09 被人为控制的时序会在实际浏览器触发，不能据此声称每次保存或取消都会失败。

本地提交主题：`test: reproduce adversarial findings in actual Edge extension`。本轮只提交三个验证脚本、本报告和对应开发/审查入口；Description.md 仅本地维护，不暂存、不提交。未推送 GitHub，所有15项产品问题仍待修复。
