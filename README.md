# AI 智能解释 & 翻译 - Edge 浏览器扩展

> 选中网页上的任意文本，AI 立刻在鼠标旁弹出智能解释或翻译卡片。右键空白处一键全文翻译。

这是一款轻量级 Edge 浏览器扩展。无需跳转页面、无需复制粘贴——在浏览网页时选中文字，AI 自动判断你需要解释还是翻译，即时给出分点结果。支持全文覆盖翻译（如 Edge 自带翻译）、流式打字机输出、双标签独立模型配置。

## 前置条件

- Edge 浏览器（Chrome 亦可）
- 一个支持 **OpenAI Chat Completions** 的接口地址（Base URL）及该接口的 API Key
- 默认地址是 `https://api.openai.com/v1`，也可填写第三方兼容服务、聚合网关或本机兼容服务地址
- 鉴权方式为 `Authorization: Bearer <API Key>`；这里的“兼容 OpenAI”指协议兼容，每家服务仍需使用自己的 Key

## 功能

### 智能解释（选中文本）

选中文本后右键「📖 智能解释」，扩展会在本地**自动分类**，无需手动选择模式：

| 你选中的是 | 自动做什么 | 例子 |
|-----------|-----------|------|
| 外语短词/短语（≤10词） | 先翻译再解释（释义、词性、用法、例句） | `ubiquitous` → 译文 + 解释 |
| 外语长段（>10词） | 纯翻译，完成后可点「解释此句」进一步解读 | 一段英文新闻 → 中文翻译 |
| 中文短字（≤10字） | 拓展解释（释义、背景、相关知识） | `实事求是` → 释义 + 出处 |
| 中文长段（>10字） | 结合上下文进行语境解读 | 一段评论 → 核心含义 + 深层意图 |

> **不需要在设置里切换模式。** 选中文本，点一下右键菜单，剩下的交给 AI 自动判断。

- **触发方式可选**：支持「选中自动搜索」（自动弹出）和「右键菜单搜索」两种模式
- **网页上下文**：自动提取选中文本所在段落的上下文，让结果更准确（可选开关）
- **流式输出**：所有解释/翻译结果逐 token 打字机式呈现，即时反馈
- **一键复制 / 下载**：将内容写入剪贴板或保存为 TXT 文件
- **通用接口**：自定义 Base URL + 单一 API Key，解释/全文翻译各自选模型，共用接口连接，不再按模型名前缀路由
- **厂家 → 模型两级选择**：OpenAI、DeepSeek、Anthropic、Google、阿里千问、月之暗面、智谱、MiniMax、xAI、Mistral AI 共 10 家，另有“其他厂家 / 自定义”。解释与全文翻译各自选择厂家和模型
- **每家 3 款近期文本模型**：从公开模型目录筛选可输入文字、仅输出文字的模型，排除 batch/free 等重复后缀、重复 ID 和过期项，再按上架时间取最近 3 款。菜单显示模型名称，下方显示实际调用名；DeepSeek 另提供 V4.1 Flash、V4 Flash（历史兼容）、V4 Pro 入口
- **实时目录更新**：点击“实时更新厂家模型”无 Key 查询 OpenRouter 公共目录；打开设置时，距上次检查超过 15 分钟会自动刷新。显示来源、更新时间；刷新失败保留缓存和当前选择，缺少 3 款的厂家保留上次缓存
- **在线获取更多模型**：点击“获取接口模型列表”，向当前输入的地址请求 `/models`，去重后合并到两个标签共用的列表；网关的带路径模型 ID 会原样保留。列表可能包括嵌入/图像等模型，应选择支持文本 Chat Completions 的模型
- **手动模型管理**：列表和调用名输入框同步，所有模型都可新增、修改、删除；两个标签可以选择不同模型
- **可选保存前检测**：默认查询 `/models`；无效调用名或 Key 会提示并阻止保存。若接口没有 `/models`，取消“保存模型前查询 /models 检测”即可手动保存。查询成功只表示模型 ID 在列表内，不等于完成真实生成
- **可选思考参数**：开启后发送标准 `reasoning_effort`（低/中/高），只适用于支持此参数的接口及模型。关闭时省略参数、使用模型自身默认行为，全文翻译建议关闭

### 全文翻译（右键空白处）

在页面**空白区域右键** →「🌐 全文翻译」→ 整个页面的文本原地变为译文，保持原有布局和样式不变。滚动页面时新出现的内容也会自动翻译。

- 翻译结果直接覆盖原文（如 Edge 自带翻译效果）
- 顶部工具栏可**随时切换原文/译文**、取消翻译
- 100 并发流式输出，大幅减少等待时间
- 包含图片、链接的元素自动跳过，不会被破坏

### 双标签独立配置

设置面板分为「📖 解释」和「🌐 全文翻译」两个标签，各自拥有厂家、模型选择、思考开关和强度。比如解释选择 `gpt-4.1`，全文翻译选择 `gpt-4.1-mini`，都使用同一个兼容接口及 Key。

## 安装

```bash
git clone https://github.com/siwenyu666-beep/AI-translator-extension.git
```

开发工作目录请保留 `.git` 文件夹与 `README.md`，以便更新代码和保存版本。分发时可以另建只包含扩展运行文件的副本。

1. 打开 Edge，地址栏输入 `edge://extensions`（或在扩展图标中点击"管理扩展"）
2. 开启左侧「开发人员模式」
3. 点击「加载解压缩的扩展」，选择克隆后的文件夹
4. 点击工具栏扩展图标，填写“API Base URL”和“API Key”：
   - OpenAI 官方地址为 `https://api.openai.com/v1`；第三方服务使用其提供的地址和 Key，保留 `/v1` 或其他兼容路径
   - 也可粘贴完整 `/chat/completions` 地址，保存时自动归一化；不要在地址内嵌入 Key、账号或查询参数
   - 点“获取接口模型列表”获取账号的模型 ID；这个按钮和“保存使用”直接使用当前输入的连接，通过后立即保存连接，无需先点总保存
   - 在两个标签分别先选厂家、再选模型，点“保存设置”。修改调用名用“保存使用”；增加新调用名先点“新增”
   - 如果接口不支持查询 `/models`，取消保存前检测，手动输入模型调用名
5. 去普通网页选中文字右键，或右键空白处，即可使用

升级旧版本后请在 `edge://extensions` 点重新加载，并刷新已打开网页。v3→v4 的通用接口迁移会清空旧供应商 Key，回退到通用默认模型，保留语言、触发方式和其他自定义模型；从 v3 升级时需重新填写新接口的 Key，旧 Key 不会自动发送给新地址。v4.0→v4.1 的厂家目录升级会保留已保存的接口、Key 和模型，只追加厂家目录；厂家名称仅用于筛选，不切换后台请求端点。

支持范围为 HTTP/HTTPS、Bearer Key 鉴权、`POST <Base URL>/chat/completions`，并返回 OpenAI 格式 SSE（`choices[0].delta.content`）。只提供 Responses API、原生其他协议或需要特殊鉴权的服务不在当前支持范围内。并非一个 OpenAI 官方 Key 可用于所有服务。

## 使用技巧

- **右键菜单永远只需点一下**：选中文本 →「📖 智能解释」（自动分类，不用纠结选什么）；空白处 →「🌐 全文翻译」。没有多余的菜单项
- 在设置面板中切换「触发方式」：「选中自动搜索」更快捷，「右键菜单搜索」避免误触发
- 将 Edge 默认下载目录设为你的笔记文件夹，下载的解释文件会自动归档
- 仅在接口和模型支持 `reasoning_effort` 时开启「深度思考模式」；遇到参数错误可关闭后重试
- 关闭「结合网页上下文」可减少 token 消耗
- 按【Esc】可以快速关闭弹窗

## 技术栈

- Manifest V3
- Service Worker（流式 API 代理 + SSE 解析）
- Content Script（划词检测 + 四分类自动分发 + 流式渲染 + 全文 DOM 覆盖翻译）
- OpenAI 兼容 Chat Completions API（Bearer 鉴权，stream: true）

## 许可证

MIT

## 开发与验收

本项目直接加载源码目录运行，无需构建或安装 npm 依赖。开发规则见 [AGENTS.md](AGENTS.md)，环境准备、静态检查、浏览器验收与版本保存方法见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

在项目根目录运行静态检查：

```powershell
node scripts/verify.mjs --report artifacts/qa/static-check.json
```

静态检查通过仅说明 JavaScript 语法及已检查的本地资源引用通过；浏览器功能和真实 API 请求需按开发说明另行验收。

本次通用接口变更、执行证据和未验证项见 [docs/OPENAI_COMPATIBLE_QA.md](docs/OPENAI_COMPATIBLE_QA.md)。接口实现参考 [OpenAI Chat Completions 文档](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) 和 [模型列表文档](https://developers.openai.com/api/reference/resources/models/methods/list)。

## 厂家目录与实时更新

“最近 3 款”以 [OpenRouter 模型目录](https://openrouter.ai/docs/guides/overview/models) 的 `created` 上架时间为依据，不等于厂家全球首发时间或完整官方发布顺序。不同网关的 ID 和可用型号可能不同，建议获取当前接口模型列表，确认实际调用名。选择厂家不会自动改 Base URL，也不会让其他厂家的 Key 自动通用。

DeepSeek 官方当前使用 `deepseek-flash` 调用 V4.1 Flash；`deepseek-v4-flash` 是历史兼容名，在官方接口转到 V4.1 Flash。本扩展保留这个选择并在界面提示，参考 [DeepSeek 官方说明](https://api-docs.deepseek.com/quick_start/pricing-details-cny/)。对于 OpenRouter 端点使用带厂家前缀的 ID；当前接口返回的精确 ID 优先，必要时可在输入框自行调整。

本次 10 家目录、实时网络验收和边界见 [docs/MANUFACTURER_MODELS_QA.md](docs/MANUFACTURER_MODELS_QA.md)。
