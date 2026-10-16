# 本地主题字体

取得日期：2026-10-13，北京时间。来自 [Google Fonts 官方字体仓库](https://github.com/google/fonts)，均保留 SIL Open Font License 1.1 原文。未改写字体字节，不使用远程字体请求，不增加 npm 或构建步骤。

| 文件 | 上游目录 | 用途 | 随附许可 | SHA-256 |
| --- | --- | --- | --- | --- |
| syne.ttf | [ofl/syne](https://github.com/google/fonts/tree/main/ofl/syne) | 当前界面英文标题 | syne-OFL.txt | ce5ac77142a65cab2248a1a2ebb740b1d4d9c20b52488877d3ff664d1356104a |
| space-grotesk.ttf | [ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) | 当前界面英文正文与菜单 | space-grotesk-OFL.txt | acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72 |
| inter.ttf | [ofl/inter](https://github.com/google/fonts/tree/main/ofl/inter) | 钴蓝纸页、靛蓝手稿正文 | inter-OFL.txt | 29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031 |
| cormorant-garamond.ttf | [ofl/cormorantgaramond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) | 靛蓝手稿英文标题 | cormorant-garamond-OFL.txt | b20b7d9626dd956b2c5e558692ad328b1f19e3275e2782db4fa07670d83f35e0 |

当前中文统一采用本地霞鹜文楷屏幕阅读版；英文正文与菜单采用Space Grotesk，英文标题采用Syne。界面不再显式指定系统宋体或黑体作为字体回退。上表中的Inter与Cormorant是保留的历史资源，当前界面不引用。theme.js在设置页与内容脚本中通过明确的chrome-extension URL注册FontFace，使用时才加载；theme.css只引用独有字体名。Manifest公开字体供扩展注入界面读取。图标是本项目原创的引号轮廓，不来自第三方字体或模板素材。

视觉方向参考 beautiful-html-templates 的 [Playful](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/playful)、[Blue Professional](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/blue-professional)、[Vellum](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/vellum)。本项目自行实现小尺寸控件、主题存储和品牌图标，未复制模板 HTML、装饰资产或导航脚本。

## 2026-10-16 中文设计字体

来源：[霞鹜文楷屏幕阅读版官方仓库](https://github.com/lxgw/LxgwWenKai-Screen)，固定版本[v1.522](https://github.com/lxgw/LxgwWenKai-Screen/releases/tag/v1.522)，原始文件[LXGWWenKaiScreen.ttf](https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.522/LXGWWenKaiScreen.ttf)。取得日期2026-10-16，北京时间。授权原文随附wenkai-OFL.txt，SIL OFL 1.1；上游明确允许仅用于Web Font的格式转换。

本地wenkai-screen.woff2由完整TTF机械转换，不删字或改造字形，仅作为扩展网页字体嵌入使用，不作为可安装桌面字体分发。转换工具fontTools4.67.0仅放在.local/tmp/，不是运行依赖；WOFF2关闭表转换、Brotli quality5，保留完整字库，字体体积25,673,994→12,761,284字节。运行时不访问字体CDN或下载服务。

原始TTF SHA-256：`cd1a6fa39c4ea42fd8f4e289945789b0e510cf7016435640f8893cdad9b220f3`。

分发WOFF2 SHA-256：`46045a9c67d4891f423df1e7110d7009011de32fe3ef84ec9bd31720cf27e2df`。
