// 文件职责：按需全文翻译、Text 节点任务队列、动态内容观察、原文切换与取消恢复。
// 以 Text 节点为翻译单元，保留 DOM 结构、节点身份与网页自己的更新。
(function () {
  'use strict';
  if (window.__dsFullPageTranslatorActive) {
    const api = window.__dsFullPageTranslator;
    if (!api?.busy && api?.progress.completed === api?.progress.total) api?.start();
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
        toolbar.innerHTML = '<span class="lc-brand-icon" aria-hidden="true"></span><span class="ds-tb-status">翻译中…</span><span class="ds-tb-progress" id="ds-tb-progress">0 / 0</span><button type="button" class="ds-tb-btn" id="ds-tb-show-original">显示原文</button><button type="button" class="ds-tb-btn ds-tb-danger" id="ds-tb-cancel">取消翻译</button>';
        document.body.prepend(toolbar);
        toolbar.querySelector('#ds-tb-show-original').addEventListener('click', toggleOriginal);
        toolbar.querySelector('#ds-tb-cancel').addEventListener('click', cancel);
      }
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
    get busy() { return starting || activeRequests > 0 || waiting.length > 0; },
    get progress() { return progress(); }};
  start().catch(console.error);
})();

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 全文翻译：寻找网页文字，安排翻译，写入译文，切换或恢复原文。
// background.js 按需加载本文件 → 扫描文字 → 队列 → 后台翻译 → 写回同一个文字节点。
// 每个 Text 节点是一个任务；session 区分不同轮次，旧轮次的结果不能改新页面。
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
// 第 4 行：开启严格模式，限制容易出错的 JavaScript 写法。
// 第 5 行：如果 window的__dsFullPageTranslatorActive，执行下面这一组步骤。
// 第 6 行：脚本已经加载过时，先取得已有控制器。
// 第 7 行：旧任务已完成且不忙时可重启；否则复用正在工作的任务。
// 第 8 行：避免重复创建观察器和工具栏。
// 第 9 行：结束前面的代码块、资料列表或函数调用。
// 第 10 行：window的__dsFullPageTranslatorActive 改为 是（true）。
// 第 11 行：最多同时 50 个请求；一批最多 8 个片段，通常不超过 3500 字符。
// 第 12 行：准备 BLOCKS（全文翻译可归属的段落标签）：本段文字要求或说明。
// 第 13 行：准备 SKIP_TAGS（全文翻译要跳过的标签）：建立不重复的 Set 集合（列表）。
// 第 14 行：继续前一行的变量定义；本行补充 'TEXTAREA', 'INPUT', 'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS',。
// 第 15 行：继续前一行的变量定义；本行补充 'VIDEO', 'AUDIO', 'IMG', 'BR', 'HR', 'BUTTON', 'SELECT', 'OPTION']);。
// 第 16 行：准备 session（当前全文翻译轮次）：0；准备 sequence（任务编号计数）：0；准备 aborted（是否已停止）：是（true）；准备 starting（是否正在启动）：否（false）；准备 showingOriginal（是否正在显示原文）：否（false）。
// 第 17 行：准备 toolbar（全文翻译工具栏），暂不赋值；准备 viewportObserver（可见区域观察器），暂不赋值；准备 mutations（网页变化观察器），暂不赋值；准备 activeRequests（进行中的请求数）：0；准备 pumping（是否正在调度队列）：否（false）。
// 第 18 行：准备 tasks（文字节点与翻译任务的对应表）：建立按标识存取资料的 Map 表。
// 第 19 行：准备 blocks（段落与文字节点的对应表）：建立按标识存取资料的 Map 表。
// 第 20 行：准备 visible（可见的段落集合）：建立不重复的 Set 集合；准备 ports（进行中的请求连接表）：建立按标识存取资料的 Map 表；准备 waiting（等待翻译的队列）：列表 []。
// 第 22 行：定义函数 eligible：检查文字节点是否适合全文翻译；接收 网页节点。
// 第 23 行：准备 parent（父元素）：网页节点的parentElement。
// 第 24 行：如果 （（不满足（网页节点的isConnected） 或 不满足（父元素）） 或 父元素的isContentEditable），结束当前函数，并返回 否（false）。
// 第 25 行：开始循环：准备 el（当前界面元素）：父元素；继续条件为 当前界面元素；每轮后 当前界面元素 改为 当前界面元素的parentElement。
// 第 26 行：向上检查祖先：脚本、代码、禁止翻译和扩展界面都不能翻译。
// 第 27 行：继续排除禁止翻译区域和文本编辑器。
// 第 28 行：排除全文工具栏与划词浮层。
// 第 29 行：排除翻译状态指示器。
// 第 30 行：结束前面的代码块、资料列表或函数调用。
// 第 31 行：浏览器有可见性检查能力时，跳过透明或隐藏区域。
// 第 32 行：按实际透明度和 CSS 可见性检查。
// 第 33 行：结束当前函数，并返回 检查 网页节点的数据 是否符合 字符匹配规则 /\p{L}/u。
// 第 34 行：结束前面的代码块、资料列表或函数调用。
// 第 36 行：定义函数 current：检查任务是否仍属于当前轮次；接收 一个任务。
// 第 37 行：任务必须未取消、轮次一致，而且仍是该节点的当前任务。
// 第 38 行：结束前面的代码块、资料列表或函数调用。
// 第 39 行：定义函数 restore：只恢复扩展仍持有的原文字段；接收 一个任务。
// 第 41 行：仅当节点仍显示扩展维护的内容时恢复原文；网页自己改过的内容不覆盖。
// 第 42 行：一个任务的node的data 改为 一个任务的source。
// 第 43 行：一个任务的expected 改为 一个任务的source。
// 第 44 行：结束前面的代码块、资料列表或函数调用。
// 第 45 行：结束前面的代码块、资料列表或函数调用。
// 第 46 行：定义函数 write：检查节点未被网页改动后写入文字；接收 一个任务、待处理的值。
// 第 47 行：任务过时、节点不可翻译或网页已改文字时，拒绝写入。
// 第 48 行：一个任务的expected 改为 待处理的值。
// 第 49 行：一个任务的node的data 改为 待处理的值。
// 第 50 行：结束当前函数，并返回 是（true）。
// 第 51 行：结束前面的代码块、资料列表或函数调用。
// 第 52 行：定义函数 progress：统计仍在页面中的任务和失败数；接收 无参数。
// 第 53 行：准备 total（总数）：0；准备 completed（已结束的任务数）：0；准备 failed（失败的任务数）：0。
// 第 54 行：逐项读取 取得 文字节点与翻译任务的对应表 的所有值，当前项记作 一个任务，执行下面步骤。
// 第 55 行：如果 不满足（一个任务的node的isConnected），跳过本轮余下步骤，进入下一轮循环。
// 第 56 行：总数 加 1。
// 第 57 行：如果 （（一个任务的status 等于 “done”） 或 （一个任务的status 等于 “failed”）），已结束的任务数 加 1。
// 第 58 行：如果 （一个任务的status 等于 “failed”），失败的任务数 加 1。
// 第 59 行：结束前面的代码块、资料列表或函数调用。
// 第 60 行：结束当前函数，并返回 一组字段（total、completed、failed）。
// 第 61 行：结束前面的代码块、资料列表或函数调用。
// 第 62 行：定义函数 updateProgress：仅在内容变化时更新进度文字；接收 无参数。
// 第 63 行：如果 不满足（全文翻译工具栏），立即结束当前函数，不继续执行下面步骤。
// 第 64 行：准备 字段 total、completed、failed：统计仍在页面中的任务和失败数。
// 第 65 行：准备 count：拼接文字和变量（已结束的任务数、总数）。
// 第 66 行：没有任务时显示无可翻译文字，否则根据是否全部结束与失败数显示状态。
// 第 67 行：全部结束有失败时显示失败数量，未全部结束显示翻译中。
// 第 69 行：准备 countEl：在 全文翻译工具栏 中找到首个匹配 “#ds-tb-progress” 的元素。
// 第 70 行：准备 statusEl：在 全文翻译工具栏 中找到首个匹配 “.ds-tb-status” 的元素。
// 第 71 行：如果 （countEl的textContent 不等于 count），countEl的textContent 改为 count。
// 第 72 行：如果 （statusEl的textContent 不等于 状态），statusEl的textContent 改为 状态。
// 第 73 行：结束前面的代码块、资料列表或函数调用。
// 第 74 行：定义函数 attachBlock：将文字任务归属到段落并观察可见性；接收 一个任务。
// 第 75 行：准备 block（所属段落）：（向上寻找匹配 全文翻译可归属的段落标签 的最近元素 或 一个任务的node的parentElement）。
// 第 76 行：如果 （一个任务的block 等于 所属段落），立即结束当前函数，不继续执行下面步骤。
// 第 77 行：如果 一个任务的block，执行下面这一组步骤。
// 第 78 行：准备 previous：从 段落与文字节点的对应表 读取 一个任务的所属段落。
// 第 79 行：从 previous 删除 一个任务的网页节点。
// 第 80 行：如果 不满足（previous（存在时）的size），执行下面这一组步骤。
// 第 81 行：停止观察 一个任务的所属段落。
// 第 82 行：从 段落与文字节点的对应表 删除 一个任务的所属段落；从 可见的段落集合 删除 一个任务的所属段落。
// 第 83 行：结束前面的代码块、资料列表或函数调用。
// 第 84 行：结束前面的代码块、资料列表或函数调用。
// 第 85 行：一个任务的block 改为 所属段落。
// 第 86 行：如果 不满足（检查 段落与文字节点的对应表 中是否有 所属段落），执行下面这一组步骤；在 段落与文字节点的对应表 保存 所属段落 对应的 建立不重复的 Set 集合；开始观察 所属段落 的变化。
// 第 87 行：将 一个任务的网页节点 加到 从 段落与文字节点的对应表 读取 所属段落。
// 第 88 行：结束前面的代码块、资料列表或函数调用。
// 第 89 行：定义函数 enqueue：把有效待办任务加入队列；接收 一个任务、single，未传入时用 否（false）。
// 第 90 行：只把有效且 pending 的任务入队，避免重复请求。
// 第 91 行：标记是否需要单条翻译，状态改 queued，再加入 waiting 队列。
// 第 92 行：结束前面的代码块、资料列表或函数调用。
// 第 93 行：定义函数 scanNode：检查一个文字节点并建立或更新任务；接收 网页节点。
// 第 94 行：准备 old：从 文字节点与翻译任务的对应表 读取 网页节点。
// 第 95 行：如果 不满足（检查文字节点是否适合全文翻译（网页节点）），执行下面这一组步骤。
// 第 96 行：节点不再适合翻译时恢复可恢复原文，删除旧任务和归属记录。
// 第 97 行：立即结束当前函数，不继续执行下面步骤。
// 第 98 行：结束前面的代码块、资料列表或函数调用。
// 第 99 行：已有任务且网页文字没变时复用，不重复创建任务。
// 第 100 行：将文字任务归属到段落并观察可见性（old）。
// 第 101 行：如果 检查 可见的段落集合 中是否有 old的所属段落，把有效待办任务加入队列（old）。
// 第 102 行：立即结束当前函数，不继续执行下面步骤。
// 第 103 行：结束前面的代码块、资料列表或函数调用。
// 第 104 行：创建新任务，保存原文、预期文字、编号、轮次和所属段落。
// 第 105 行：id 字段设为 拼接文字和变量（任务编号计数 加 1）；status 字段设为 “pending”；session 字段沿用同名值；block 字段设为 old（存在时）的block。
// 第 106 行：在 文字节点与翻译任务的对应表 保存 网页节点 对应的 一个任务；将文字任务归属到段落并观察可见性（一个任务）。
// 第 107 行：如果 检查 可见的段落集合 中是否有 一个任务的所属段落，把有效待办任务加入队列（一个任务）。
// 第 108 行：结束前面的代码块、资料列表或函数调用。
// 第 109 行：定义函数 scan：遍历区域中的文字节点；接收 界面或扫描区域根元素。
// 第 110 行：准备 element：若 （界面或扫描区域根元素的nodeType 等于 Node的ELEMENT_NODE），用 界面或扫描区域根元素；否则用 界面或扫描区域根元素的parentElement。
// 第 112 行：扫描前跳过扩展自己的浮层和工具栏。
// 第 113 行：如果 （界面或扫描区域根元素的nodeType 等于 Node的TEXT_NODE），执行下面这一组步骤；检查一个文字节点并建立或更新任务（界面或扫描区域根元素）；立即结束当前函数，不继续执行下面步骤。
// 第 114 行：准备 walker：建立逐个遍历网页节点的工具。
// 第 115 行：只要 移到下一个符合条件的网页节点，继续执行下面步骤；检查一个文字节点并建立或更新任务（walker的currentNode）。
// 第 116 行：结束前面的代码块、资料列表或函数调用。
// 第 117 行：定义函数 settle：处理译文，保留原文边缘空白并写回；接收 一个任务、收到的译文。
// 第 118 行：如果 不满足（检查任务是否仍属于当前轮次（一个任务）），立即结束当前函数，不继续执行下面步骤。
// 第 119 行：返回时节点已被改动就重新扫描，避免旧译文覆盖新原文。
// 第 120 行：如果 （（收到的译文的数据类型 等于 “string”） 且 去掉 收到的译文 两端空白），执行下面这一组步骤。
// 第 122 行：译文两端保留原来的空白，避免相邻链接或强调文字粘连。
// 第 123 行：一个任务的status 改为 “done”。
// 第 124 行：如果 不满足（是否正在显示原文），检查节点未被网页改动后写入文字（一个任务、一个任务的translated）。
// 第 125 行：一个任务的status 改为 “failed”。
// 第 126 行：结束前面的代码块、资料列表或函数调用。
// 第 127 行：定义函数 takeRequest：按数量和字符预算取下一批任务；接收 无参数。
// 第 128 行：准备 selected（这一批翻译任务）：列表 []。
// 第 129 行：准备 chars（本批累计字符数）：0。
// 第 130 行：只要 （等待翻译的队列的length 且 （这一批翻译任务的length 小于 每批最多处理的片段数）），继续执行下面步骤。
// 第 131 行：准备 task（一个任务）：等待翻译的队列的第 [0] 项。
// 第 132 行：队首过时或已不是排队状态，丢弃它并继续。
// 第 133 行：队首节点不可翻译或文字变了，移出队列并重新扫描。
// 第 134 行：单条回退任务不能混入批量；已有任务加下一项超预算时结束取批。
// 第 135 行：取出队首，标记 running，加入本批，并累计字符数。
// 第 136 行：遇到单条任务或预算已满，结束取批。
// 第 137 行：结束前面的代码块、资料列表或函数调用。
// 第 138 行：结束当前函数，并返回 这一批翻译任务。
// 第 139 行：结束前面的代码块、资料列表或函数调用。
// 第 141 行：定义函数 request：建立全文请求，处理完成、失败和单条回退；接收 这一批翻译任务。
// 第 142 行：保存本次轮次；任务数大于 1 才使用批量协议。
// 第 143 行：结束当前函数，并返回 建立稍后完成或失败的 Promise 任务。
// 第 144 行：准备 port（与后台通信的连接），暂不赋值；准备 finished（是否已结束）：否（false）；准备 timeout（超时计时器），暂不赋值；准备 buffer（暂存的文字）：“”。
// 第 145 行：finish 负责结算请求，只结算一次。
// 第 146 行：如果 是否已结束，立即结束当前函数，不继续执行下面步骤。
// 第 147 行：是否已结束 改为 是（true）；取消计时器 超时计时器；从 进行中的请求连接表 删除 与后台通信的连接。
// 第 148 行：只有仍是同一轮且没取消，才处理返回结果。
// 第 149 行：把批量回答整理成编号到译文的对应表。
// 第 150 行：逐项读取 这一批翻译任务，当前项记作 一个任务，执行下面步骤。
// 第 151 行：如果 不满足（检查任务是否仍属于当前轮次（一个任务）），跳过本轮余下步骤，进入下一轮循环。
// 第 152 行：批量按编号取译文，单条使用最终文字或累计流式正文。
// 第 153 行：成功且译文非空时完成任务。
// 第 154 行：批量失败的片段重新排队为单条翻译。
// 第 155 行：单条失败则标记任务失败。
// 第 156 行：结束前面的代码块、资料列表或函数调用。
// 第 157 行：仅在内容变化时更新进度文字。
// 第 158 行：结束前面的代码块、资料列表或函数调用。
// 第 159 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 与后台通信的连接；捕获前面步骤的错误，按下面步骤处理。
// 第 160 行：建立已完成任务或完成当前任务，结果为 无参数。
// 第 161 行：结束前面的代码块、资料列表或函数调用。
// 第 162 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 163 行：与后台通信的连接 改为 建立扩展通信连接 一组字段。
// 第 164 行：在 进行中的请求连接表 保存 与后台通信的连接 对应的 结束当前异步任务并清理资源（否（false））。
// 第 165 行：登记 与后台通信的连接的onMessage 的监听函数，收到通知时执行下面的处理。
// 第 166 行：收到旧轮次消息或已取消时立即结束此请求。
// 第 167 行：如果 （收到的消息的type 等于 “token”），暂存的文字 累加或追加 （收到的消息的token 或 “”）。
// 第 168 行：如果 （收到的消息的type 等于 “done”），结束当前异步任务并清理资源（是（true）、收到的消息）。
// 第 169 行：如果 （收到的消息的type 等于 “error”），结束当前异步任务并清理资源（否（false））。
// 第 170 行：结束前面的代码块、资料列表或函数调用。
// 第 171 行：登记 与后台通信的连接的onDisconnect 的监听函数，收到通知时执行下面的处理。
// 第 172 行：批量请求等待最多 60 秒，单条最多 30 秒。
// 第 173 行：准备 context（背景材料）：一组字段（title: document的title、url: location的href）。
// 第 174 行：批量发 STREAM_TRANSLATE_BATCH，单条发 STREAM_BATCH，两者都交后台生成。
// 第 175 行：items 字段设为 逐项转换 这一批翻译任务，转换规则为 一组字段（id: 一个任务的标识、text: 一个任务的文字）；id 字段设为 一个任务的id；text 字段设为 一个任务的text；context 字段沿用同名值。
// 第 176 行：batchId 字段设为 拼接文字和变量（发起请求时的轮次、任务编号计数）；type 字段设为 “STREAM_BATCH”。
// 第 177 行：promptType 字段设为 “translate”；text 字段设为 这一批翻译任务的第 [0] 项的text；context 字段沿用同名值。
// 第 178 行：batchId 字段设为 拼接文字和变量（发起请求时的轮次、这一批翻译任务的第 [0] 项的id）。
// 第 179 行：捕获前面步骤的错误，按下面步骤处理；结束当前异步任务并清理资源（否（false））。
// 第 180 行：结束前面的代码块、资料列表或函数调用。
// 第 181 行：结束前面的代码块、资料列表或函数调用。
// 第 182 行：定义函数 pump：在并发上限内启动队列任务；接收 无参数。
// 第 183 行：如果 （是否已停止 或 是否正在调度队列），立即结束当前函数，不继续执行下面步骤。
// 第 184 行：是否正在调度队列 改为 是（true）。
// 第 185 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 186 行：只要 （（进行中的请求数 小于 最多同时进行的实际请求数） 且 等待翻译的队列的length），继续执行下面步骤。
// 第 187 行：准备 selected（这一批翻译任务）：按数量和字符预算取下一批任务。
// 第 188 行：如果 不满足（这一批翻译任务的length），跳出当前循环。
// 第 189 行：为真实请求占一个并发名额。
// 第 190 行：准备 requestSession（发起请求时的轮次）：当前全文翻译轮次。
// 第 191 行：无论 建立全文请求，处理完成、失败和单条回退（这一批翻译任务） 成功或失败，都执行清理函数。
// 第 192 行：请求结束后只处理当前轮次。
// 第 193 行：释放名额并继续调度队列。
// 第 194 行：结束前面的代码块、资料列表或函数调用。
// 第 195 行：结束前面的代码块、资料列表或函数调用。
// 第 196 行：是否正在调度队列 改为 否（false）。
// 第 197 行：仅在内容变化时更新进度文字。
// 第 198 行：结束前面的代码块、资料列表或函数调用。
// 第 199 行：定义函数 toggleOriginal：切换原文和译文；接收 无参数。
// 第 200 行：如果 是否已停止，立即结束当前函数，不继续执行下面步骤。
// 第 201 行：是否正在显示原文 改为 不满足（是否正在显示原文）。
// 第 202 行：在 全文翻译工具栏 中找到首个匹配 “#ds-tb-show-original” 的元素的textContent 改为 若 是否正在显示原文，用 “显示译文”；否则用 “显示原文”。
// 第 203 行：显示原文时恢复节点；显示译文时只写回已经成功完成的任务。
// 第 204 行：如果 是否正在显示原文，只恢复扩展仍持有的原文字段（一个任务）。
// 第 205 行：如果 （一个任务的status 等于 “done”），检查节点未被网页改动后写入文字（一个任务、一个任务的translated）。
// 第 206 行：结束前面的代码块、资料列表或函数调用。
// 第 207 行：结束前面的代码块、资料列表或函数调用。
// 第 208 行：定义函数 stop：停止这一轮，恢复原文并清理观察器和队列；接收 无参数。
// 第 209 行：标记停止并增加轮次，让旧响应立即失效。
// 第 210 行：断开 可见区域观察器；断开 网页变化观察器。
// 第 212 行：显式结束所有连接任务并清计时器，不能只等待断开事件。
// 第 213 行：清空 进行中的请求连接表。
// 第 214 行：逐项读取 取得 文字节点与翻译任务的对应表 的所有值，当前项记作 一个任务，执行下面步骤；只恢复扩展仍持有的原文字段（一个任务）。
// 第 215 行：清空 文字节点与翻译任务的对应表；清空 段落与文字节点的对应表；清空 可见的段落集合；等待翻译的队列的length 改为 0。
// 第 216 行：进行中的请求数 改为 0；是否正在显示原文 改为 否（false）。
// 第 217 行：结束前面的代码块、资料列表或函数调用。
// 第 218 行：定义函数 cancel：取消全文翻译并移除工具栏；接收 无参数。
// 第 219 行：停止这一轮，恢复原文并清理观察器和队列；从 全文翻译工具栏 移除样式标记或元素 ；全文翻译工具栏 改为 空值 null。
// 第 220 行：window的__dsFullPageTranslatorActive 改为 否（false）。
// 第 221 行：结束前面的代码块、资料列表或函数调用。
// 第 222 行：定义异步函数 start：开始新一轮全文翻译并监听可见区域和网页变化；接收 无参数。
// 第 223 行：如果 是否正在启动，立即结束当前函数，不继续执行下面步骤。
// 第 224 行：标记正在启动，避免并发启动。
// 第 225 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 226 行：停止这一轮，恢复原文并清理观察器和队列；是否已停止 改为 否（false）；window的__dsFullPageTranslatorActive 改为 是（true）。
// 第 227 行：如果 不满足（全文翻译工具栏），执行下面这一组步骤。
// 第 228 行：创建工具栏并指定其 id。
// 第 229 行：登记扩展界面根元素并设置品牌资源（全文翻译工具栏）。
// 第 230 行：填入品牌图标、进度、原文切换和取消按钮。
// 第 231 行：把 全文翻译工具栏 放到 document的body 内部开头。
// 第 232 行：监听 在 全文翻译工具栏 中找到首个匹配 “#ds-tb-show-original” 的元素 的 “click” 事件，发生后执行处理函数。
// 第 233 行：监听 在 全文翻译工具栏 中找到首个匹配 “#ds-tb-cancel” 的元素 的 “click” 事件，发生后执行处理函数。
// 第 234 行：结束前面的代码块、资料列表或函数调用。
// 第 235 行：在 全文翻译工具栏 中找到首个匹配 “#ds-tb-show-original” 的元素的textContent 改为 “显示原文”。
// 第 236 行：可见区域观察器 改为 建立可见区域观察器。
// 第 237 行：如果 是否已停止，立即结束当前函数，不继续执行下面步骤。
// 第 238 行：逐项读取 资料列表，当前项记作 一条资料，执行下面步骤。
// 第 239 行：如果 一条资料的isIntersecting，执行下面这一组步骤。
// 第 240 行：将 一条资料的target 加到 可见的段落集合。
// 第 241 行：逐项读取 （从 段落与文字节点的对应表 读取 一条资料的target 或 列表 []），当前项记作 网页节点，执行下面步骤。
// 第 242 行：准备 task（一个任务）：从 文字节点与翻译任务的对应表 读取 网页节点。
// 第 243 行：如果 一个任务，把有效待办任务加入队列（一个任务）。
// 第 244 行：结束前面的代码块、资料列表或函数调用。
// 第 245 行：从 可见的段落集合 删除 一条资料的target。
// 第 246 行：结束前面的代码块、资料列表或函数调用。
// 第 247 行：在并发上限内启动队列任务。
// 第 248 行：观察窗口附近上下各 700 像素的内容，提前安排翻译。
// 第 249 行：遍历区域中的文字节点（document的请求内容或正文元素）。
// 第 250 行：网页变化观察器 改为 建立网页变化观察器。
// 第 251 行：如果 是否已停止，立即结束当前函数，不继续执行下面步骤。
// 第 252 行：逐项读取 records，当前项记作 record，执行下面步骤。
// 第 253 行：如果 （record的type 等于 “characterData”），执行下面这一组步骤。
// 第 255 行：准备 task（一个任务）：从 文字节点与翻译任务的对应表 读取 record的target。
// 第 256 行：网页文字变化时，仅不是扩展自身写入才重新扫描。
// 第 257 行：节点属性变化时重新检查区域。
// 第 258 行：新增节点逐个扫描。
// 第 259 行：结束前面的代码块、资料列表或函数调用。
// 第 261 行：逐项读取 文字节点与翻译任务的对应表，当前项记作 列表 [网页节点、一个任务]，执行下面步骤。
// 第 262 行：真的移出页面的文字恢复原文并释放任务；只是移动位置的节点仍保留。
// 第 263 行：结束前面的代码块、资料列表或函数调用。
// 第 264 行：逐项读取 段落与文字节点的对应表，当前项记作 列表 [所属段落、nodes]，执行下面步骤。
// 第 265 行：如果 不满足（nodes的size），执行下面这一组步骤；停止观察 所属段落；从 段落与文字节点的对应表 删除 所属段落；从 可见的段落集合 删除 所属段落。
// 第 266 行：结束前面的代码块、资料列表或函数调用。
// 第 267 行：在并发上限内启动队列任务。
// 第 268 行：结束前面的代码块、资料列表或函数调用。
// 第 269 行：观察整页子节点、文字及会影响可翻译性的属性变化。
// 第 270 行：仅观察列出的属性，减少无关通知。
// 第 271 行：仅在内容变化时更新进度文字。
// 第 272 行：是否正在启动 改为 否（false）。
// 第 273 行：结束前面的代码块、资料列表或函数调用。
// 第 274 行：公开启动、取消、原文切换和状态查询入口。
// 第 275 行：busy 表示启动、请求或队列仍有工作。
// 第 276 行：progress 提供当前统计。
// 第 277 行：加载后立即启动，错误记录到开发者工具。
// 第 278 行：结束初始化函数并立即执行，完成本文件的注册。
