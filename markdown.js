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
