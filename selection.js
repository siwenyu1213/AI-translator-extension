// Bounded, local selection analysis. Semantic uncertainty is preserved for the model.
globalThis.AISelection = (() => {
  const BLOCK = 'p,li,td,th,pre,blockquote,h1,h2,h3,h4,h5,h6,figcaption,dd,dt,summary';
  const SCOPE = 'article,section,main,li,td,th,blockquote,[role="listitem"],[data-message-id],.comment,.message';
  const EXCLUDE = 'script,style,noscript,template,nav,button,input,textarea,select,[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),#deepseek-explain-tooltip';
  const HARD_LIMIT = 3000;
  const segmenters = new Map();
  function segments(text, granularity) {
    try {
      if (!segmenters.has(granularity)) segmenters.set(granularity, new Intl.Segmenter(undefined, { granularity }));
      return [...segmenters.get(granularity).segment(text)];
    } catch { return []; }
  }
  function analyze(text, info = {}) {
    const value = text.trim();
    const letters = [...value.matchAll(/\p{L}/gu)].map(m => m[0]);
    const count = pattern => letters.filter(c => pattern.test(c)).length;
    const han = count(/\p{Script=Han}/u);
    const kana = count(/[\p{Script=Hiragana}\p{Script=Katakana}]/u), hangul = count(/\p{Script=Hangul}/u);
    const total = letters.length;
    let language = !total ? 'unknown' : kana ? 'ja' : hangul ? 'ko' : han / total >= .7 ? 'zh' : han ? 'mixed' : 'foreign';
    // Han alone is ambiguous: respect a nearby Japanese language declaration when available.
    if (language === 'zh' && /^ja\b/i.test(info.lang || '')) language = 'ja';
    const words = segments(value, 'word').filter(s => s.isWordLike).length || value.split(/\s+/).filter(Boolean).length;
    const sentences = segments(value, 'sentence').filter(s => /\p{L}|\p{N}/u.test(s.segment)).length;
    const dependency = /^(?:因此|但是|然而|上述|该|它|这|同上|其他情形|所以|此外|其)|\b(?:this|that|these|those|they|it|however|therefore|former|latter)\b/i.test(value);
    let category, confidence = 'medium', reason;
    const kind = info.kind || 'prose';
    const code = kind === 'code' || /^(?:const|let|var)\s+[\w$]+\s*=/.test(value)
      || /^(?:(?:async\s+)?function\s*\w*\s*\(|def\s+\w+\s*\(|class\s+\w+\s*(?:\{|extends\b)|import\s+.+\s+from\s+['"]|SELECT\s+.+\s+FROM\s+)/i.test(value)
      || /^(?:npm|git|python)\s+(?:--?\w|install\b|run\b|status\b|fetch\b|pull\b|clone\b|[\w./-]+\.py\b)/.test(value)
      || /\b(?:ERR_[A-Z_]+|TypeError|SyntaxError)\b/.test(value) || /(?:=>|\w+\([^\n]*\)\s*[;{])/.test(value);
    if (code) { category = 'code'; confidence = 'high'; reason = '代码结构或报错'; }
    else if (/^(?:https?:\/\/|www\.)\S+$/i.test(value) || /^(?:[A-Za-z]:[\\/]|\.{0,2}\/)[\w./\\-]+$/.test(value)) { category = 'reference'; confidence = 'high'; reason = '链接或路径'; }
    else if (kind === 'table') { category = 'table'; reason = '表格单元格'; }
    else if (kind === 'heading') { category = 'heading'; reason = '标题位置'; }
    else if (/^(?:[A-Z]{1,4}\d{2,}|式[（(]?\d+[）)]?)$/.test(value)) { category = 'reference'; reason = '编号，具体指向依赖语境'; }
    else if (/[=∑∫√]|\bP\([^)]*\|[^)]*\)|\d\s*[+*/−]\s*\d/u.test(value) || (!han && /^[α-ωΑ-Ωλπσμ]+$/u.test(value))) { category = 'formula'; reason = '公式或变量'; }
    else if ((!total && /\p{N}/u.test(value)) || /^[+-]?\d[\d.,:/ -]*\s*(?:kg|cm|km|ms|MB|GB|元|万元|亿元|年|月|日|秒|分钟|小时|℃|°C|%)$/i.test(value) || /^\d{4}年\d{1,2}月\d{1,2}日$/.test(value)) { category = 'data'; confidence = 'high'; reason = '数字、日期或指标'; }
    else if (value.includes('\n\n') || sentences > 1) { category = 'passage'; confidence = 'high'; reason = '多句或多段'; }
    else {
      const terminal = /[。！？!?][”’"')）]*$/.test(value) || /(?<!\d)\.[”’"')）]*$/.test(value);
      // Signals, not a full parser. Short unsupported forms remain uncertain.
      const grammar = /\b(?:I|you|he|she|we|they|it|this|that|there)\s+(?:(?:really|always|never|often)\s+)?(?:am|is|are|was|were|have|has|had|will|would|can|could|should|must|do|does|did|love|like|want|need|went|said|works?|seems?|looks?)\b/i.test(value)
        || /\b(?:I['’]m|you['’]re|we['’]re|they['’]re|it['’]s|he['’]s|she['’]s)\s+\p{L}/iu.test(value)
        || /^(?:please\s+\p{L}+|(?:open|close|read|save|send|check|take|give)\s+(?:the|a|this|your)\s+)/iu.test(value)
        || /^let(?:['’]s| us)\s+\p{L}/iu.test(value)
        || /^(?:je\s+(?:suis|veux|peux|voudrais)|il\s+est|nous\s+(?:sommes|avons)|ich\s+(?:bin|habe|möchte)|das\s+ist|yo\s+(?:soy|estoy|quiero)|esto\s+es|eu\s+(?:sou|estou|quero)|я\s+(?:хочу|люблю|могу)|أنا\s+(?:أريد|أحب))/iu.test(value)
        || /(?:です|ます|でした|ません|합니다|입니다|했어요|있다)[。.!?]?$/.test(value)
        || /(?:是|不是|已经|应当|应该|必须|可以|不能|不构成|意味着|表明|说明|导致|认为)/.test(value)
        || /^(?:我|你|他|她|我们|他们)(?:喜欢|需要|想要|希望|去|看|爱)/.test(value);
      const embedded = !!(info.before?.trim() || info.after?.trim());
      if (/^(?:好的|好|嗯|哦|是的|不是|谢谢|收到|可以|行|你好|ok|okay|yes|no|thanks|hello|hi)[。.!?！？]*$/i.test(value) && !embedded) { category = 'response'; reason = '独立短回应，具体含义依赖语境'; }
      else if (terminal || grammar) { category = embedded && !terminal && info.partial ? 'fragment' : 'sentence'; reason = '句末或句式信号'; }
      else if (info.partialWord) { category = 'fragment'; reason = '单词内部的局部选区'; }
      else if (words === 1 && language === 'foreign') { category = 'word'; reason = '单个外语词'; }
      else if (embedded && info.partial) { category = 'fragment'; reason = '所在句子中的局部选区'; }
      else if ((language === 'foreign' && words <= 8) || (['zh','ja','ko'].includes(language) && [...value].length <= 24)) { category = 'phrase'; reason = '短语或名称，保留语义歧义'; }
      else { category = 'uncertain'; confidence = 'low'; reason = '结构证据不足，由生成模型结合语境判断'; }
    }
    const special = ['code','reference','data','formula','table','heading'].includes(category);
    const foreign = ['foreign','ja','ko'].includes(language);
    const mode = special || language === 'mixed' || language === 'unknown' ? 'C'
      : foreign ? (['sentence','passage'].includes(category) ? 'B' : ['word','phrase','response'].includes(category) || (category === 'fragment' && words <= 8) ? 'A' : 'C')
        : ['sentence','passage'].includes(category) ? 'D' : 'C';
    return { language, category, confidence, reason, mode, dependency, words };
  }
  function element(node) { return node?.nodeType === 1 ? node : node?.parentElement; }
  function visible(el) {
    if (!el || el.closest(EXCLUDE)) return false;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }
  function block(node) {
    let el = element(node);
    const semantic = el?.closest(BLOCK);
    if (semantic) return semantic;
    while (el && el !== document.body) {
      if (['block','list-item','table-cell'].includes(getComputedStyle(el).display)) return el;
      el = el.parentElement;
    }
    return document.body;
  }
  // Visit only a bounded local tree. Keep raw node offsets; never locate by text search.
  function pieces(root, range, side, max = HARD_LIMIT) {
    const reverse = side === 'before';
    let visits = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        visits++;
        if (node.nodeType === 1) return visible(node) ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT;
        return visible(node.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let node, output = '', anchor = range && (reverse ? range.startContainer : range.endContainer);
    if (anchor?.nodeType === 3 && root.contains(anchor)) {
      walker.currentNode = anchor;
      if (visible(anchor.parentElement)) output = reverse ? anchor.data.slice(0, range.startOffset).slice(-max) : anchor.data.slice(range.endOffset, range.endOffset + max);
    } else if (reverse) {
      // No text anchor (e.g. selectNodeContents): begin at the root's last descendant.
      let last = root;
      while (last.lastChild) last = last.lastChild;
      walker.currentNode = last;
      if (last.nodeType === 3 && visible(last.parentElement) && (!range || range.comparePoint(last, last.length) === -1)) output = last.data.slice(-max);
    }
    let previousParent = anchor?.parentElement;
    while (output.length < max && visits <= 2000 && (node = reverse ? walker.previousNode() : walker.nextNode())) {
      let from = 0, to = node.length;
      if (range) {
        try {
          if (side === 'before') {
            if (node === range.startContainer) to = range.startOffset;
            else if (range.comparePoint(node, node.length) !== -1) continue;
          } else {
            if (node === range.endContainer) from = range.endOffset;
            else if (range.comparePoint(node, 0) !== 1) continue;
          }
        } catch { continue; }
      }
      const parent = node.parentElement;
      const boundary = previousParent && (parent.closest(BLOCK) !== previousParent.closest(BLOCK) || (reverse ? node.nextSibling?.nodeName === 'BR' : node.previousSibling?.nodeName === 'BR'));
      const part = node.data.slice(from, to);
      output = reverse ? part + (boundary ? '\n' : '') + output : output + (boundary ? '\n' : '') + part;
      output = reverse ? output.slice(-max) : output.slice(0, max);
      previousParent = parent;
    }
    return output;
  }
  function neighbor(start, direction, scope) {
    let el = start;
    for (let steps = 0; el && el !== scope && steps < 12; steps++) {
      const next = direction < 0 ? el.previousElementSibling : el.nextElementSibling;
      if (!next) { el = el.parentElement; continue; }
      if (/^H[1-6]$/.test(next.tagName) || next.matches('nav,aside,article,section,li,[role="listitem"],.comment,.message,[data-message-id]')) return null;
      if (!visible(next)) { el = next; continue; }
      return next;
    }
    return null;
  }
  function clip(value, limit, side) {
    if (value.length <= limit) return value;
    if (!limit) return '';
    const list = segments(value, 'sentence');
    if (side === 'before') {
      const start = list.find(s => s.index >= value.length - limit)?.index;
      if (start !== undefined) return value.slice(start);
      return value.slice(-limit);
    }
    const last = list.filter(s => s.index + s.segment.length <= limit).at(-1);
    return last ? value.slice(0, last.index + last.segment.length) : value.slice(0, limit);
  }
  function capture(text) {
    const sel = getSelection();
    const range = sel?.rangeCount && !sel.isCollapsed && sel.toString().trim() === text.trim() ? sel.getRangeAt(0).cloneRange() : null;
    if (!range) return { text, range: null, analysis: analyze(text), context: null };
    const start = block(range.startContainer), end = block(range.endContainer);
    const el = element(range.startContainer), cell = el?.closest('td,th');
    const kind = el?.closest('pre,code') ? 'code' : cell ? 'table' : el?.closest('h1,h2,h3,h4,h5,h6') ? 'heading' : 'prose';
    let before = pieces(start, range, 'before'), after = pieces(end, range, 'after');
    const lang = el?.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang;
    const partial = start === end && (before.trim() || after.trim()) && !/[。.!?！？]\s*$/.test(before) && !/^\s*[。.!?！？]/.test(after);
    const partialWord = (/\p{Script=Latin}$/u.test(before) && /^\p{Script=Latin}/u.test(text)) || (/\p{Script=Latin}$/u.test(text) && /^\p{Script=Latin}/u.test(after));
    const analysis = analyze(text, { kind, before, after, partial: !!partial, partialWord, lang });
    const scope = start.closest(SCOPE) || document.body;
    const prev = neighbor(start, -1, scope), next = neighbor(end, 1, end.closest(SCOPE) || document.body);
    // A full selection supplies its own context. Short selections get a richer default.
    const budget = text.length > 1500 ? 800 : analysis.dependency || ['code','table','formula','reference'].includes(analysis.category) ? 2500 : 1500;
    const metadata = [];
    if (cell) {
      const table = cell.closest('table');
      const caption = table?.querySelector('caption');
      if (caption && visible(caption)) metadata.push('表格：' + pieces(caption, null, 'after', 120));
      const row = cell.parentElement;
      const index = [...row.children].indexOf(cell);
      const column = table?.querySelector('tr')?.children[index];
      for (const label of [row.querySelector('th'), column?.tagName === 'TH' ? column : null]) {
        if (label && label !== cell && visible(label)) metadata.push('表头：' + pieces(label, null, 'after', 120));
      }
    }
    let heading = null;
    for (let p = start, steps = 0; p && p !== scope && steps < 12; p = p.parentElement, steps++) {
      let sibling = p.previousElementSibling;
      for (let n = 0; sibling && n < 6; n++, sibling = sibling.previousElementSibling) {
        if (/^H[1-6]$/.test(sibling.tagName) && visible(sibling)) { heading = sibling; break; }
      }
      if (heading) break;
    }
    if (heading) metadata.push('小标题：' + pieces(heading, null, 'after', 120));
    const title = metadata.length ? '' : document.title.slice(0, 120);
    const details = [...new Set(metadata)].join('\n').slice(0, 360);
    const available = Math.min(HARD_LIMIT, budget) - title.length - details.length;
    // Preserve same-block material first; then fill spare capacity with adjacent blocks.
    let left = Math.min(before.length, Math.ceil(available * .6));
    let right = Math.min(after.length, available - left);
    left = Math.min(before.length, available - right);
    before = clip(before, left, 'before');
    after = clip(after, right, 'after');
    let spare = available - before.length - after.length;
    if (prev && spare > 0 && kind !== 'table') {
      const extra = clip(pieces(prev, null, 'before'), Math.min(500, spare), 'before');
      before = (extra + (extra && before ? '\n' : '') + before).slice(-available + after.length);
    }
    spare = available - before.length - after.length;
    if (next && spare > 0 && kind !== 'table') {
      const extra = clip(pieces(next, null, 'after'), Math.min(kind === 'heading' ? 900 : 400, spare), 'after');
      after = (after + (after && extra ? '\n' : '') + extra).slice(0, available - before.length);
    }
    return { text, range, analysis, context: { title, before, after, details, budget } };
  }
  function same(a, b) {
    if (!a || !b || a.text !== b.text) return false;
    const x = a.range, y = b.range;
    if (!x || !y) return !x && !y && JSON.stringify(a.context) === JSON.stringify(b.context);
    return x.startContainer === y.startContainer && x.startOffset === y.startOffset && x.endContainer === y.endContainer && x.endOffset === y.endOffset && JSON.stringify(a.context) === JSON.stringify(b.context);
  }
  return { analyze, capture, same, HARD_LIMIT };
})();
