# 本地 Markdown 第三方库

取得日期：2026-10-11。用途：普通网页内容脚本中的Markdown解析与HTML清理。文件随扩展加载，不执行远程脚本，没有npm安装、package.json或构建流程。升级时同时复核API、许可证、哈希与实际Edge回归。

| 库 | 固定版本 | 文件和用途 | 上游来源 | 许可证 |
| --- | --- | --- | --- | --- |
| Marked | 18.1.0 | marked/marked.umd.js；.map仅用于调试 | [官方仓库](https://github.com/markedjs/marked)、[发布包](https://registry.npmjs.org/marked/-/marked-18.1.0.tgz) | MIT，原文在marked/LICENSE |
| DOMPurify | 3.4.16 | dompurify/purify.min.js；.map仅用于调试 | [官方仓库固定版本](https://github.com/cure53/DOMPurify/tree/3.4.16)、[脚本原文件](https://raw.githubusercontent.com/cure53/DOMPurify/3.4.16/dist/purify.min.js) | 本项目采用Apache-2.0，原文在dompurify/LICENSE |

Marked使用官方npm发布包中的UMD文件与LICENSE，不改写上游代码。发布包SHA-512已与npm registry的dist.integrity核对：`PamYXWWWg2nboG3oX5Ffzpy3EFZROqZJK9hSlMmUnekp7TxPs5DcT95vwd46m73/exfKCRVMtgXoPMI4FEJL6w==`。DOMPurify脚本、source map与LICENSE来自官方仓库固定版本。

SHA-256（原始文件字节）：

| 文件 | SHA-256 |
| --- | --- |
| marked/marked.umd.js | f424dcb508fdf93e0137a970cfce8f3207ea2e3f37eca5f7556a52875683632a |
| marked/marked.umd.js.map | eb305cbe6e1bf6e35e3b35a22fa03a2960f7f890ff414d99695c172b123c9f8a |
| marked/LICENSE | 8e3a3f82f59a60958f56ca08f445647c32a4733dc7ca6c2c46f6eb898471ab9c |
| dompurify/purify.min.js | 2c90a9b46d6463f26038a29b686e82bc91de01fdac9d5229e7cfe3b360134ea2 |
| dompurify/purify.min.js.map | 52a28819cc9aacf5d0542c765e3f7c70796600959d33eab63a7bbb89361f3155 |
| dompurify/LICENSE | cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 |

加载顺序在manifest.json中定义：theme.js → selection.js → Marked → DOMPurify → markdown.js → content.js。markdown.js负责每次解析后的标签/属性白名单、链接协议、图片替代文字、表格滚动包装与节流；不要把未经清理的parser输出直接插入网页。

2026-10-13 新增三主题的本地字体，来源、许可和原始字节哈希见 [fonts/README](fonts/README.md)。字体不是执行脚本，不改变 Markdown 的清理规则。
