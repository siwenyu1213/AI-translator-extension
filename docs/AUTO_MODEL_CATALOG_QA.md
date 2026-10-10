# 每次打开静默刷新与完整文本目录验收

日期：2026-10-10，北京时间 UTC+8。扩展版本 4.2.0。

## 起点与用户范围

分支 `codex/openai-compatible-api`，起始 HEAD `14ab7733c6b52099d3bd568613ca8918c7951799`，工作区干净。已 fetch origin 并比较，当前任务分支保留五个本地提交，无需整合远程。历史、远程和用户配置保留；未推送 GitHub。

用户要求移除实时刷新按钮，每次打开扩展窗口自动刷新，成功不显示，失败在顶部显示简短美观红字；每家不再限制三款。模型调用名和通用设置只解释用途，用户确认之前不隐藏。本次这两个区域均保持可见，验收脚本明确检查。

## 最终行为

打开 popup 后先显示已保存目录，每次都发 `REFRESH_MODEL_CATALOG`，不再按 15 分钟节流。手动按钮和来源/更新时间卡片移除；没有加载或成功提示。完整失败显示红色文字“暂时无法获取模型，已保留已有列表。”；缺少某家时显示“部分厂家的模型暂未更新，已保留已有列表。”。顶部提示使用 `role=alert`、12px 字体、淡红背景及细边，正常时 hidden 不占空间。原有设置输入、保存状态和模型消息独立工作。

通信恢复继续有效，后台无回复/通道断开后由设置页请求同一公开 JSON，恢复成功也静默。底层错误保留具体原因，设置页控制台 warning 可供排查，用户界面不堆叠技术详情。失败不覆盖缓存或选择，重新打开重试。

目录刷新与缓存规范化均取消 slice(0,3)，按上架时间降序显示该来源的全部符合条件型号：白名单厂家、输入文字、仅输出文字、无重复/后缀变体且未过期。只有一款也可以更新；完全缺失的厂家保留缓存并提示部分失败。共享的内置完整快照本次来自真实网络，共 210 款：OpenAI 60、DeepSeek 14、Anthropic 16、Google 20、Qwen 42、Moonshot 7、GLM 16、MiniMax 8、xAI 7、Mistral 20。数量随公开源更新，不硬编码为选项上限。

来源为 OpenRouter `/api/v1/models`，不能认定覆盖厂家全部官方型号、某个网关或当前账号权限。当前接口实际 ID、手动型号、历史兼容入口及选定型号另保留。刷新完成时保留当时的选择和未保存调用名；下架的非选定、非手动、非当前接口目录项从自动列表移除，避免旧目录长期混入当前选项。

## 验收

Node.js v24.18.1，实际 Edge 154.0.4258.62，已有 Playwright 包，独立 profile、合成网页和 Key；无新增 npm 依赖。报告 HEAD 为本次修订之前的基线，运行的是任务未提交代码。

| 检查 | 结果与证据 |
| --- | --- |
| `node scripts/verify.mjs --report artifacts/qa/static-check.json` | 17 项通过，退出码 0；`artifacts/qa/static-check.json` |
| `node scripts/verify-api.mjs` | 25 组离线模拟通过；新增四款完整保留、仅一款可更新、null 过滤和缓存不截断断言；`artifacts/qa/api-simulation.json` |
| `node scripts/verify-browser.mjs --playwright '<已有包目录>'` | 14 组实际 Edge 检查通过，退出码 0；`artifacts/qa/browser-check.json` |
| 真实目录网络 | 初始化、刚更新后重开、无回复恢复及失败模拟后恢复均取得实时公开目录；内置快照证据 `artifacts/qa/catalog-all-models.json` |
| UI/状态 | 无刷新按钮、成功隐藏提示、顶部错误为红色、模型调用名与通用配置仍可见；实际查看 `popup-auto-success.png` 与 `catalog-recovery-error.png` |
| 异常模拟 | 后台无回复、断开、503；缓存/选择保留；延迟完成时保留中途选择与输入；下架项清理、部分失败提示 |
| 其他回归 | 独立型号/厂家与 Key 持久化、模型管理、划词 SSE、全文翻译与恢复。推理使用本机模拟，不是供应商真实调用验收 |
| Git | `git diff --check` 无错误；Description.md 仍排除、不暂存 |

改动范围：model-catalog.js、popup.js/html/css、manifest.json、两个验证脚本、README、DEVELOPMENT 与本摘要；Description.md 同步本地维护。历史 QA 摘要保留当时行为，本摘要为 v4.2 当前行为。

## 加载与待确认

在 `edge://extensions` 重新加载扩展，关闭旧窗口再打开；每次打开自动刷新，无需调整 API Key/Base URL。真实推理权限、日常用户浏览器的原生弹层与网络环境未验证。

模型调用名决定请求的 `model` ID，也是手动添加、修改、删除入口；隐藏整行后标准下拉选项仍能工作，但自定义网关别名与新模型需要另设入口。通用设置标题本身不控制行为；只去掉标题无功能影响。若隐藏整个区域，API 地址/Key、接口模型发现、检测选项、启用、上下文和触发方式均无法在此页更改；已有配置继续使用，新用户仍需配置入口。两项等用户确认后再隐藏。

本地提交主题：`feat: refresh full model catalog silently on every popup open`，提交号可由 `git log -1` 查阅。未上传 GitHub。
