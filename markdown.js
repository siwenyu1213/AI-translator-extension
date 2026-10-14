// 文件职责：本地 Markdown 解析、HTML 白名单清理、流式节流渲染与阅读位置保持。
// Loaded in the isolated content-script world.
(() => {
  const parser = new marked.Marked({ gfm: true, breaks: true });
  const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  parser.use({ renderer: {
    // Model HTML is displayed as text, never interpreted as webpage code.
    html({ text }) { return escape(text); },
    image({ text }) { return escape(text || '图片'); }
  } });
  const tags = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em',
    'del', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'];

  function render(container, source) {
    const top = container.scrollTop;
    const atBottom = container.hasChildNodes() && container.scrollHeight - container.clientHeight - top <= 24;
    const horizontal = [...container.querySelectorAll('pre, .ds-md-table')].map(el => el.scrollLeft);
    const focusable = [...container.querySelectorAll('pre, .ds-md-table, a[href]')];
    const focused = focusable.find(el => el === document.activeElement);
    const focus = focused ? {
      tag: focused.tagName, table: focused.classList.contains('ds-md-table'),
      href: focused.getAttribute('href'), text: focused.textContent.slice(0, 128),
      index: focusable.filter(el => el.tagName === focused.tagName &&
        el.getAttribute('href') === focused.getAttribute('href') &&
        el.textContent.startsWith(focused.textContent.slice(0, 128))).indexOf(focused)
    } : null;
    try {
      const fragment = DOMPurify.sanitize(parser.parse(String(source || '')), {
        ALLOWED_TAGS: tags,
        ALLOWED_ATTR: ['href', 'title', 'start', 'type', 'checked', 'disabled', 'align'],
        ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true
      });
      for (const link of fragment.querySelectorAll('a')) {
        const href = link.getAttribute('href') || '';
        // Relative/model-invented URLs must not resolve against the user's private page.
        if (!/^https?:\/\//i.test(href)) link.removeAttribute('href');
        else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      }
      for (const input of fragment.querySelectorAll('input')) {
        input.type = 'checkbox'; input.disabled = true;
      }
      for (const table of fragment.querySelectorAll('table')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ds-md-table'; wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', '表格，可横向滚动');
        table.replaceWith(wrapper); wrapper.append(table);
      }
      for (const pre of fragment.querySelectorAll('pre')) {
        pre.tabIndex = 0; pre.setAttribute('aria-label', '代码块，可横向滚动');
      }
      container.replaceChildren(fragment);
      [...container.querySelectorAll('pre, .ds-md-table')].forEach((el, index) => {
        el.scrollLeft = horizontal[index] || 0;
      });
      if (focus) {
        const candidates = [...container.querySelectorAll('pre, .ds-md-table, a[href]')]
          .filter(el => el.tagName === focus.tag && el.classList.contains('ds-md-table') === focus.table &&
            el.getAttribute('href') === focus.href && el.textContent.startsWith(focus.text));
        const target = candidates[focus.index] || candidates[0];
        target?.focus({ preventScroll: true });
      }
    } catch {
      // A parser failure must still leave the model response readable and inert.
      container.textContent = String(source || '');
    }
    container.scrollTop = atBottom ? container.scrollHeight : top;
  }

  function createStreamingRenderer(container) {
    container.classList.add('ds-markdown');
    container.textContent = '';
    container.scrollTop = 0;
    let source = '', timer = 0, stopped = false;
    return {
      push(chunk) {
        if (stopped || !chunk) return;
        source += chunk;
        if (!timer) timer = setTimeout(() => {
          timer = 0;
          if (!stopped) render(container, source);
        }, Math.min(600, 150 + Math.floor(source.length / 20000) * 50));
      },
      setFinal(text) {
        if (stopped) return;
        clearTimeout(timer); timer = 0;
        source = String(text || '');
        render(container, source);
      },
      cancel() { stopped = true; clearTimeout(timer); timer = 0; source = ''; }
    };
  }
  globalThis.AIMarkdown = Object.freeze({ render, createStreamingRenderer });
})();

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 回答排版：把 Markdown 文本变成可阅读的内容，清理 HTML，保留阅读位置。
// content.js 收到回答片段 → createStreamingRenderer → render → 浮层正文。
// Marked 负责排版，DOMPurify 负责清理；模型给出的 HTML 和图片按普通文字显示。
//
// 二、先认识常见写法
// const：保存一个不重新赋值的名字；let：保存之后可以换值的名字。对象内容仍可修改。
// function / 箭头 =>：把步骤打包成函数，调用时才执行；立即执行函数用于初始化。
// if / else：符合条件走一条路，否则走另一条；return：结束当前函数并交回结果。
// async / await：等存储或网络完成后再继续；等待时浏览器仍能处理其他工作。
// try / catch / finally：尝试操作、处理错误、最后清理；事件监听函数收到通知后执行。
// 对象 {...} 保存一组字段；数组 [...] 保存列表；Map 按标识存资料；Set 自动去重。
// === 判断严格相等；&& 同时成立；|| 取备用值；?. 值存在才访问；?? 仅缺失时取备用值。
// 后缀“的 length”是数量/长度，“的 value”是控件值，“的 textContent”是元素显示文字。
//
// 三、按原代码顺序逐句看
// 行号对应本文件上方原代码；空行和原有说明不重复解释。
// 同一行有多句时按先后用分号分开；跨行表达式在起始行解释，并标明续行。
// 第 3 行：定义并立即执行初始化函数；内部步骤见下面各行。
// 第 4 行：创建 Marked 解析器，支持常见 Markdown 和换行。
// 第 5 行：定义转义函数，把 HTML 特殊字符换成普通可显示文字。
// 第 6 行：列出 &、尖括号和引号的转义对应值。
// 第 7 行：设置解析器的显示规则。
// 第 9 行：模型给出的原始 HTML 只当文字显示。
// 第 10 行：图片只显示其说明文字，没有说明时显示“图片”。
// 第 11 行：继续填写 renderer 的内容：一组字段（html 方法、image 方法）。
// 第 12 行：开始列出允许显示的 HTML 标签，包括段落、标题和强调。
// 第 13 行：继续允许列表、引用、代码和链接标签。
// 第 14 行：继续允许表格与复选框标签。
// 第 16 行：定义函数 render：解析和清理 Markdown，更新正文并恢复滚动与焦点；接收 显示内容的容器、原文或累计 Markdown。
// 第 17 行：记住更新前的垂直滚动位置。
// 第 18 行：已有内容且距离底部不超过 24 像素，视为用户正在底部阅读。
// 第 19 行：记住各代码块和表格的横向滚动位置。
// 第 20 行：找到可获得键盘焦点的代码块、表格和链接。
// 第 21 行：找到其中当前获得焦点的元素。
// 第 22 行：有焦点时记录它的特征，便于重绘后找回。
// 第 23 行：记录标签类型和是否为表格容器。
// 第 24 行：记录链接地址和前 128 字符内容。
// 第 25 行：同类型、同地址、同内容可能出现多次，因此也记录同组中的序号。
// 第 26 行：用链接地址筛选同组元素。
// 第 27 行：用前 128 字符筛选同组元素，再取得序号。
// 第 28 行：继续前一行的变量定义；本行补充 } : null;。
// 第 29 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 30 行：先将 Markdown 转成 HTML，再用 DOMPurify 清理，返回页面片段。
// 第 31 行：只保留前面列出的标签。
// 第 32 行：只保留列出的链接、表格和复选框属性。
// 第 33 行：禁止额外 data/aria 属性，并返回 DOM 片段。
// 第 34 行：结束前面的代码块、资料列表或函数调用。
// 第 35 行：逐个检查清理后的链接。
// 第 36 行：读取链接地址，没有地址时用空文字。
// 第 38 行：不是 HTTP/HTTPS 绝对地址时删除链接地址，避免相对地址指向用户私有网页。
// 第 39 行：合法链接在新页面打开，并隔离来源页访问关系。
// 第 40 行：结束前面的代码块、资料列表或函数调用。
// 第 41 行：逐项读取 在 清理后的页面片段 中找到所有匹配 “input” 的元素，当前项记作 输入值，执行下面步骤。
// 第 42 行：将任务列表输入框固定为不可操作的复选框。
// 第 43 行：结束前面的代码块、资料列表或函数调用。
// 第 44 行：逐项读取 在 清理后的页面片段 中找到所有匹配 “table” 的元素，当前项记作 table，执行下面步骤。
// 第 45 行：创建表格外层容器。
// 第 46 行：设置表格样式，并允许键盘聚焦。
// 第 47 行：提供辅助阅读名称，说明可横向滚动。
// 第 48 行：用外层容器替换表格位置，再把表格放回容器。
// 第 49 行：结束前面的代码块、资料列表或函数调用。
// 第 50 行：逐项读取 在 清理后的页面片段 中找到所有匹配 “pre” 的元素，当前项记作 pre，执行下面步骤。
// 第 51 行：允许代码块键盘聚焦，设置辅助阅读名称。
// 第 52 行：结束前面的代码块、资料列表或函数调用。
// 第 53 行：把旧正文替换成这次清理后的内容。
// 第 54 行：逐个找回代码块和表格的横向位置。
// 第 55 行：恢复旧位置，没有记录时从左侧开始。
// 第 56 行：结束前面的代码块、资料列表或函数调用。
// 第 57 行：如果 保存的焦点信息，执行下面这一组步骤。
// 第 58 行：找回原先焦点元素的候选项。
// 第 59 行：候选项须匹配标签类型和是否为表格容器。
// 第 60 行：候选项须匹配链接地址和文字特征。
// 第 61 行：优先取原序号，否则取第一个匹配项。
// 第 62 行：恢复键盘焦点，但不让浏览器自动滚动页面。
// 第 63 行：结束前面的代码块、资料列表或函数调用。
// 第 64 行：捕获前面步骤的错误，按下面步骤处理。
// 第 66 行：解析失败时显示普通文字，仍保证回答可读。
// 第 67 行：结束前面的代码块、资料列表或函数调用。
// 第 68 行：原本在底部就跟随新内容到底部，否则保持原阅读位置。
// 第 69 行：结束前面的代码块、资料列表或函数调用。
// 第 71 行：定义函数 createStreamingRenderer：创建节流更新 Markdown 的工具；接收 显示内容的容器。
// 第 72 行：给容器加 Markdown 样式标记。
// 第 73 行：清空旧回答。
// 第 74 行：从顶部开始阅读。
// 第 75 行：准备累计文字、刷新计时器和取消标志。
// 第 76 行：结束当前函数，并返回 一组字段（push 方法、setFinal 方法、cancel 方法）。
// 第 77 行：定义 对象方法 push，内部步骤见后续各行。
// 第 78 行：已取消或新片段为空时，不再处理。
// 第 79 行：把新片段接到累计回答末尾。
// 第 80 行：只有没有待执行刷新时才安排一次，减少重复重绘。
// 第 81 行：刷新开始后清空计时器编号。
// 第 82 行：未取消时渲染当前累计回答。
// 第 83 行：每隔约 150 至 600 毫秒重绘，文字越长间隔可越大。
// 第 84 行：结束前面的代码块、资料列表或函数调用。
// 第 85 行：定义 对象方法 setFinal，内部步骤见后续各行。
// 第 86 行：已取消时忽略最终结果。
// 第 87 行：取消待执行刷新并清空编号。
// 第 88 行：保存完整最终回答。
// 第 89 行：立即渲染最终回答。
// 第 90 行：结束前面的代码块、资料列表或函数调用。
// 第 91 行：cancel 标记已停止，取消计时器并清空累计回答。
// 第 92 行：结束前面的代码块、资料列表或函数调用。
// 第 93 行：结束前面的代码块、资料列表或函数调用。
// 第 94 行：公开普通渲染和流式渲染两个入口。
// 第 95 行：结束初始化函数并立即执行，完成本文件的注册。
