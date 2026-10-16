// 文件职责：按需全文翻译、Text 节点任务队列、动态内容观察、原文切换与取消恢复。
// 以 Text 节点为翻译单元，保留 DOM 结构、节点身份与网页自己的更新。
(function () {
  'use strict';
  if (window.__dsFullPageTranslatorActive) {
    const api = window.__dsFullPageTranslator;
    if (api?.toolbarHidden) api.showToolbar();
    else if (!api?.busy && api?.progress.completed === api?.progress.total) api?.start();
    return;
  }
  window.__dsFullPageTranslatorActive = true;
  const MAX_REQUESTS = 50, MAX_ITEMS = 8, MAX_CHARS = 3500;
  const BLOCKS = 'p,li,td,th,h1,h2,h3,h4,h5,h6,figcaption,dd,dt,legend,summary,blockquote,div,section,article,header,footer,nav,aside,main,caption';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD',
    'TEXTAREA', 'INPUT', 'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS',
    'VIDEO', 'AUDIO', 'IMG', 'BR', 'HR', 'BUTTON', 'SELECT', 'OPTION']);
  let session = 0, sequence = 0, aborted = true, starting = false, showingOriginal = false;
  let toolbar, viewportObserver, mutations, activeRequests = 0, pumping = false;
  const tasks = new Map(); // Text -> 当前任务；替换任务使旧响应自动失效。
  const blocks = new Map(); // Element -> Text 集合，移动文本不会丢失原文。
  const visible = new Set(), ports = new Map(), waiting = [];

  function eligible(node) {
    const parent = node.parentElement;
    if (!node.isConnected || !parent || parent.isContentEditable) return false;
    for (let el = parent; el; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName.toUpperCase()) || el.hasAttribute('data-ds-skip') ||
          el.getAttribute('translate')?.toLowerCase() === 'no' || el.getAttribute('role') === 'textbox' ||
          ['ds-translate-toolbar', 'deepseek-explain-tooltip'].includes(el.id) ||
          el.classList.contains('ds-translating-indicator')) return false;
    }
    if (typeof parent.checkVisibility === 'function' &&
        !parent.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) return false;
    return /\p{L}/u.test(node.data);
  }
  // 字符集不等于语言，不能据拉丁字母/汉字推断英法/中日并跳过请求。
  function current(task) {
    return !aborted && task.session === session && tasks.get(task.node) === task;
  }
  function restore(task) {
    // 仅恢复扩展仍拥有的写入，网页已修改的内容一律保留。
    if (task.translated !== undefined && task.node.data === task.expected && task.expected !== task.source) {
      task.node.data = task.source;
      task.expected = task.source;
    }
  }
  function write(task, value) {
    if (!current(task) || !eligible(task.node) || task.node.data !== task.expected) return false;
    task.expected = value;
    task.node.data = value;
    return true;
  }
  function progress() {
    let total = 0, completed = 0, failed = 0;
    for (const task of tasks.values()) {
      if (!task.node.isConnected) continue;
      total++;
      if (task.status === 'done' || task.status === 'failed') completed++;
      if (task.status === 'failed') failed++;
    }
    return {total, completed, failed};
  }
  function updateProgress() {
    if (!toolbar) return;
    const {total, completed, failed} = progress();
    const count = `${completed} / ${total}`;
    const status = total === 0 ? '没有可翻译的文本' :
      completed === total ? (failed ? `翻译完成（${failed} 个文本片段失败）` : '翻译完成') : '翻译中…';
    // 同值 textContent 仍会产生 childList；不得让进度更新递归触发观察器。
    const countEl = toolbar.querySelector('#ds-tb-progress');
    const statusEl = toolbar.querySelector('.ds-tb-status');
    if (countEl.textContent !== count) countEl.textContent = count;
    if (statusEl.textContent !== status) statusEl.textContent = status;
  }
  function attachBlock(task) {
    const block = task.node.parentElement.closest(BLOCKS) || task.node.parentElement;
    if (task.block === block) return;
    if (task.block) {
      const previous = blocks.get(task.block);
      previous?.delete(task.node);
      if (!previous?.size) {
        viewportObserver?.unobserve(task.block);
        blocks.delete(task.block); visible.delete(task.block);
      }
    }
    task.block = block;
    if (!blocks.has(block)) { blocks.set(block, new Set()); viewportObserver.observe(block); }
    blocks.get(block).add(task.node);
  }
  function enqueue(task, single = false) {
    if (!current(task) || task.status !== 'pending') return;
    task.single = single; task.status = 'queued'; waiting.push(task);
  }
  function scanNode(node) {
    const old = tasks.get(node);
    if (!eligible(node)) {
      if (old) { restore(old); tasks.delete(node); blocks.get(old.block)?.delete(node); }
      return;
    }
    if (old && node.data === old.expected) {
      attachBlock(old);
      if (visible.has(old.block)) enqueue(old);
      return;
    }
    const task = {node, source: node.data, expected: node.data, text: node.data.trim(),
      id: `t${++sequence}`, status: 'pending', session, block: old?.block};
    tasks.set(node, task); attachBlock(task);
    if (visible.has(task.block)) enqueue(task);
  }
  function scan(root) {
    const element = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
    // 仅提前跳过扩展自己的UI；网页保护属性的变化仍须扫描并恢复已有任务。
    if (element?.closest('#deepseek-explain-tooltip, #ds-translate-toolbar')) return;
    if (root.nodeType === Node.TEXT_NODE) { scanNode(root); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) scanNode(walker.currentNode);
  }
  function settle(task, result) {
    if (!current(task)) return;
    if (!eligible(task.node) || task.node.data !== task.expected) { scanNode(task.node); return; }
    if (typeof result === 'string' && result.trim()) {
      // 保留片段边缘空白，避免链接/强调节点之间的单词粘连。
      task.translated = task.source.match(/^\s*/)[0] + result.trim() + task.source.match(/\s*$/)[0];
      task.status = 'done';
      if (!showingOriginal) write(task, task.translated);
    } else task.status = 'failed';
  }
  function takeRequest() {
    const selected = [];
    let chars = 0;
    while (waiting.length && selected.length < MAX_ITEMS) {
      const task = waiting[0];
      if (!current(task) || task.status !== 'queued') { waiting.shift(); continue; }
      if (!eligible(task.node) || task.node.data !== task.expected) { waiting.shift(); scanNode(task.node); continue; }
      if (selected.length && (task.single || selected[0].single || chars + task.text.length > MAX_CHARS)) break;
      waiting.shift(); task.status = 'running'; selected.push(task); chars += task.text.length;
      if (task.single || chars >= MAX_CHARS) break;
    }
    return selected;
  }
  // 一个配额对应一个实际端口请求；批量失败回退重新排队，不能绕过配额。
  function request(selected) {
    const requestSession = session, batch = selected.length > 1;
    return new Promise(resolve => {
      let port, finished = false, timeout, buffer = '';
      const finish = (success, msg = {}) => {
        if (finished) return;
        finished = true; clearTimeout(timeout); ports.delete(port);
        if (requestSession === session && !aborted) {
          const resultMap = new Map(Array.isArray(msg.items) ? msg.items.map(item => [String(item.id), item.text]) : []);
          for (const task of selected) {
            if (!current(task)) continue;
            const result = batch ? resultMap.get(task.id) : (msg.text || buffer);
            if (success && typeof result === 'string' && result.trim()) settle(task, result);
            else if (batch) { task.status = 'pending'; enqueue(task, true); }
            else settle(task, undefined);
          }
          updateProgress();
        }
        try { port?.disconnect(); } catch {}
        resolve();
      };
      try {
        port = chrome.runtime.connect({name: `stream-fp-${requestSession}-${sequence}-${Math.random().toString(36).slice(2)}`});
        ports.set(port, () => finish(false));
        port.onMessage.addListener(msg => {
          if (requestSession !== session || aborted) { finish(false); return; }
          if (msg.type === 'token') buffer += msg.token || '';
          else if (msg.type === 'done') finish(true, msg);
          else if (msg.type === 'error') finish(false);
        });
        port.onDisconnect.addListener(() => finish(false));
        timeout = setTimeout(() => finish(false), batch ? 60000 : 30000);
        const context = {title: document.title, url: location.href};
        port.postMessage(batch ? {type: 'STREAM_TRANSLATE_BATCH',
          items: selected.map(task => ({id: task.id, text: task.text})), context,
          batchId: `fp-batch-${requestSession}-${sequence}`} : {type: 'STREAM_BATCH',
          promptType: 'translate', text: selected[0].text, context,
          batchId: `fp-${requestSession}-${selected[0].id}`});
      } catch { finish(false); }
    });
  }
  function pump() {
    if (aborted || pumping) return;
    pumping = true;
    try {
      while (activeRequests < MAX_REQUESTS && waiting.length) {
        const selected = takeRequest();
        if (!selected.length) break;
        activeRequests++;
        const requestSession = session;
        request(selected).finally(() => {
          if (requestSession !== session) return;
          activeRequests--; pump();
        });
      }
    } finally { pumping = false; }
    updateProgress();
  }
  function toggleOriginal() {
    if (aborted) return;
    showingOriginal = !showingOriginal;
    toolbar.querySelector('#ds-tb-show-original').textContent = showingOriginal ? '显示译文' : '显示原文';
    for (const task of tasks.values()) {
      if (showingOriginal) restore(task);
      else if (task.status === 'done') write(task, task.translated);
    }
  }
  function setToolbarCollapsed(collapsed) {
    if (!toolbar) return;
    toolbar.classList.toggle('ds-tb-collapsed', collapsed);
    const panel = toolbar.querySelector('#ds-tb-panel');
    panel.inert = collapsed;
    panel.setAttribute('aria-hidden', String(collapsed));
    const toggle = toolbar.querySelector('#ds-tb-toggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? '展开翻译进度栏' : '收起翻译进度栏');
    toggle.title = collapsed ? '展开翻译进度栏' : '收起翻译进度栏，翻译继续运行';
  }
  function stop() {
    aborted = true; session++;
    viewportObserver?.disconnect(); mutations?.disconnect();
    // 本端 disconnect 不会保证本端收到 onDisconnect；显式清定时器并结算。
    for (const finish of ports.values()) finish();
    ports.clear();
    for (const task of tasks.values()) restore(task);
    tasks.clear(); blocks.clear(); visible.clear(); waiting.length = 0;
    activeRequests = 0; showingOriginal = false;
  }
  function cancel() {
    stop(); toolbar?.remove(); toolbar = null;
    window.__dsFullPageTranslatorActive = false;
  }
  async function start() {
    if (starting) return;
    starting = true;
    try {
      stop(); aborted = false; window.__dsFullPageTranslatorActive = true;
      if (!toolbar) {
        toolbar = document.createElement('div'); toolbar.id = 'ds-translate-toolbar';
        LingoTheme.attach(toolbar);
        toolbar.innerHTML = '<div id="ds-tb-panel"><div class="ds-tb-panel-clip"><div class="ds-tb-panel-content"><span class="lc-brand-icon" aria-hidden="true"></span><span class="ds-tb-status">翻译中…</span><span class="ds-tb-progress" id="ds-tb-progress">0 / 0</span><button type="button" class="ds-tb-btn" id="ds-tb-show-original">显示原文</button><button type="button" class="ds-tb-btn ds-tb-danger" id="ds-tb-cancel">取消翻译</button></div></div></div><button type="button" class="ds-tb-btn" id="ds-tb-toggle" aria-controls="ds-tb-panel" aria-expanded="true" aria-label="收起翻译进度栏"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
        document.body.prepend(toolbar);
        toolbar.querySelector('#ds-tb-show-original').addEventListener('click', toggleOriginal);
        toolbar.querySelector('#ds-tb-cancel').addEventListener('click', cancel);
        toolbar.querySelector('#ds-tb-toggle').addEventListener('click', () => setToolbarCollapsed(!toolbar.classList.contains('ds-tb-collapsed')));
      }
      setToolbarCollapsed(false);
      toolbar.querySelector('#ds-tb-show-original').textContent = '显示原文';
      viewportObserver = new IntersectionObserver(entries => {
        if (aborted) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target);
            for (const node of blocks.get(entry.target) || []) {
              const task = tasks.get(node);
              if (task) enqueue(task);
            }
          } else visible.delete(entry.target);
        }
        pump();
      }, {rootMargin: '700px 0px', threshold: 0});
      scan(document.body);
      mutations = new MutationObserver(records => {
        if (aborted) return;
        for (const record of records) {
          if (record.type === 'characterData') {
            // 扩展自己的译文/原文切换不产生新任务。
            const task = tasks.get(record.target);
            if (!task || record.target.data !== task.expected) scanNode(record.target);
          } else if (record.type === 'attributes') scan(record.target);
          else for (const node of record.addedNodes) scan(node);
        }
        // 同一轮通知中的 DOM 移动仍 connected；真正删除则安全恢复并释放引用。
        for (const [node, task] of tasks) {
          if (!node.isConnected) { restore(task); tasks.delete(node); blocks.get(task.block)?.delete(node); }
        }
        for (const [block, nodes] of blocks) {
          if (!nodes.size) { viewportObserver.unobserve(block); blocks.delete(block); visible.delete(block); }
        }
        pump();
      });
      mutations.observe(document.body, {subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ['contenteditable', 'data-ds-skip', 'translate', 'role', 'style', 'class', 'hidden', 'open']});
      updateProgress();
    } finally { starting = false; }
  }
  window.__dsFullPageTranslator = {start, cancel, toggleOriginal,
    showToolbar() { setToolbarCollapsed(false); },
    get toolbarHidden() { return toolbar?.classList.contains('ds-tb-collapsed') || false; },
    get busy() { return starting || activeRequests > 0 || waiting.length > 0; },
    get progress() { return progress(); }};
  start().catch(console.error);
})();
