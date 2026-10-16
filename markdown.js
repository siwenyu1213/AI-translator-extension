// 文件职责：本地 Markdown 安全排版、rAF 文本播放队列与阅读位置保持。
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
  const MAX_CHARS_PER_FRAME = 2048;
  const MAX_TEXT_NODE_CHARS = 8192;

  function render(container, source) {
    const top = container.scrollTop;
    const atBottom = container.hasChildNodes() && container.scrollHeight - container.clientHeight - top <= 24;
    container.classList.remove('ds-text-playback');
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

  function createStreamingTextRenderer(container) {
    let textNode = document.createTextNode('');
    container.replaceChildren(textNode);
    container.scrollTop = 0;
    let pending = '', displayed = '', rafId = 0, stopped = false, idleCallback = null;
    const notifyIdle = () => {
      if (stopped || pending || !idleCallback) return;
      const callback = idleCallback;
      idleCallback = null;
      callback();
    };
    const schedule = () => {
      if (!stopped && !rafId && pending) rafId = requestAnimationFrame(step);
    };
    function step() {
      rafId = 0;
      if (stopped) return;
      if (!pending) { notifyIdle(); return; }
      // 限制单个 TextNode 的长度，避免超长段落每帧重排同一个巨型文本节点。
      if (textNode.length >= MAX_TEXT_NODE_CHARS) {
        textNode = document.createTextNode('');
        container.appendChild(textNode);
      }
      const adaptive = Math.max(1, Math.ceil(pending.length / 12));
      let take = Math.min(pending.length, MAX_CHARS_PER_FRAME, adaptive);
      // 尽量不在一帧末尾切开代理对（emoji 等）。
      if (take < pending.length && /[\uD800-\uDBFF]/.test(pending[take - 1])) {
        take = take === 1 ? 2 : take - 1;
      }
      textNode.appendData(pending.slice(0, take));
      displayed += pending.slice(0, take);
      pending = pending.slice(take);
      schedule();
      notifyIdle();
    }
    return {
      push(chunk) {
        if (stopped || !chunk) return;
        pending += chunk;
        schedule();
      },
      setFinal(text) {
        if (stopped) return;
        const final = String(text || '');
        // 正常 done 不清空、不重播；只有最终文本改变已显示前缀时才重新排队。
        if (final.startsWith(displayed)) pending = final.slice(displayed.length);
        else {
          textNode = document.createTextNode('');
          container.replaceChildren(textNode);
          displayed = ''; pending = final;
        }
        schedule();
        notifyIdle();
      },
      onIdle(callback) {
        if (stopped) return;
        idleCallback = callback;
        notifyIdle();
      },
      cancel() {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0; pending = ''; displayed = ''; idleCallback = null;
      }
    };
  }

  function createStreamingRenderer(container) {
    container.classList.add('ds-markdown', 'ds-text-playback');
    const playback = createStreamingTextRenderer(container);
    let finished = false;
    return {
      push(chunk) { if (!finished) playback.push(chunk); },
      setFinal(text, onComplete) {
        if (finished) return;
        finished = true;
        playback.setFinal(text);
        playback.onIdle(() => {
          // 仅在播放完成后解析/清理一次，保留现有 Markdown 与复制原文约定。
          render(container, text);
          onComplete?.();
        });
      },
      cancel() { finished = true; playback.cancel(); }
    };
  }
  globalThis.AIMarkdown = Object.freeze({ render, createStreamingRenderer, createStreamingTextRenderer });
})();
