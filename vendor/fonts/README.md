# 本地主题字体

取得日期：2026-10-13，北京时间。来自 [Google Fonts 官方字体仓库](https://github.com/google/fonts)，均保留 SIL Open Font License 1.1 原文。未改写字体字节，不使用远程字体请求，不增加 npm 或构建步骤。

| 文件 | 上游目录 | 用途 | 随附许可 | SHA-256 |
| --- | --- | --- | --- | --- |
| syne.ttf | [ofl/syne](https://github.com/google/fonts/tree/main/ofl/syne) | 蜜桃涂鸦英文标题 | syne-OFL.txt | ce5ac77142a65cab2248a1a2ebb740b1d4d9c20b52488877d3ff664d1356104a |
| space-grotesk.ttf | [ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) | 蜜桃涂鸦正文、钴蓝纸页英文标题 | space-grotesk-OFL.txt | acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72 |
| inter.ttf | [ofl/inter](https://github.com/google/fonts/tree/main/ofl/inter) | 钴蓝纸页、靛蓝手稿正文 | inter-OFL.txt | 29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031 |
| cormorant-garamond.ttf | [ofl/cormorantgaramond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) | 靛蓝手稿英文标题 | cormorant-garamond-OFL.txt | b20b7d9626dd956b2c5e558692ad328b1f19e3275e2782db4fa07670d83f35e0 |

中文沿用系统黑体/宋体回退。theme.js 在设置页与内容脚本中通过明确的 chrome-extension URL 注册 FontFace，使用时才加载；theme.css 只引用独有字体名。Manifest 仅公开品牌 SVG 和这四份字体，以供扩展注入的界面读取。图标是本项目原创的引号轮廓，不来自第三方字体或模板素材。

视觉方向参考 beautiful-html-templates 的 [Playful](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/playful)、[Blue Professional](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/blue-professional)、[Vellum](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/vellum)。本项目自行实现小尺寸控件、主题存储和品牌图标，未复制模板 HTML、装饰资产或导航脚本。
