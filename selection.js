// 文件职责：本地选区分类、Range 快照、所在句与预算内 DOM 上下文提取。
// Semantic uncertainty is preserved for the model.
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
    const contextDependency = /^(?:(?:this|that|it|these|those)\s+(?:is|are|was|were)\s+(?:called|known|referred|termed|named)|上述|该|这种|这类|此类|这一|这(?:称为|叫作|就是|意味着))/i.test((info.sentenceBefore || '').trim());
    const responseLike = /^(?:好的|好|嗯|哦|是的|不是|谢谢|收到|可以|行|你好|ok|okay|yes|no|thanks|hello|hi)[。.!?！？]*$/i.test(value);
    const embedded = !!(info.before?.trim() || info.after?.trim());
    let completeness = info.partialWord ? 'partial_word' : 'complete';
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
      const responseInSentence = /[\p{L}\p{N}]/u.test((info.sentenceBefore ?? info.before ?? '') + (info.sentenceAfter ?? info.after ?? ''));
      // Position is distinct from meaning: a complete term inside a sentence remains a term.
      // Only narrow dependency/truncation evidence marks a fragment; this is not a parser.
      const dependentFragment = /^(?:它|他|她|这|那|其|该|上述|同上|因此|所以|但是|然而|此外|this|that|these|those|they|it|former|latter|however|therefore)$/i.test(value);
      const truncated = info.partial && (/^(?:的|中的|之中的|之于|于其中)/.test(value)
        || /^(?:我|你|他|她|这|那|该|因为|如果|虽然).*(?:的|地|得|因为|虽然|如果|但是|以及|或者)$/.test(value)
        || /\b(?:of|with|for|and|or|because|although|if)\s*$/i.test(value)
        || (words > 1 && /\b(?:am|is|are|was|were|have|has|had|will|would|can|could|should|must|do|does|did|been)\s*$/i.test(value)));
      if (info.partialWord) { category = 'fragment'; reason = '单词内部的局部选区'; }
      else if (responseLike) { category = responseInSentence ? 'phrase' : 'response'; reason = responseInSentence ? '句内短表达，按所在句确定作用' : '独立短回应，具体含义依赖语境'; }
      else if (dependentFragment || truncated) { category = 'fragment'; completeness = 'dependent'; reason = '指代、省略或截断关系需要语境'; }
      else if (terminal || grammar) { category = 'sentence'; reason = '句末或句式信号'; }
      else if (words === 1 && language === 'foreign') { category = 'word'; reason = '单个外语词'; }
      else if ((language === 'foreign' && words <= 8) || (['zh','ja','ko'].includes(language) && [...value].length <= 24)) { category = 'phrase'; reason = '短语或名称，保留语义歧义'; }
      else { category = 'uncertain'; confidence = 'low'; reason = '结构证据不足，由生成模型结合语境判断'; }
    }
    const special = ['code','reference','data','formula','table','heading'].includes(category);
    const foreign = ['foreign','ja','ko'].includes(language);
    const mode = special || language === 'mixed' || language === 'unknown' ? 'C'
      : foreign ? (['sentence','passage'].includes(category) ? 'B' : ['word','phrase','response'].includes(category) || (category === 'fragment' && words <= 8) ? 'A' : 'C')
        : ['sentence','passage'].includes(category) ? 'D' : 'C';
    return { language, category, confidence, reason, mode, dependency, contextDependency, words, responseLike, position: embedded ? 'embedded' : 'standalone', completeness };
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
  function containingSentence(before, text, after) {
    const value = before + text + after, from = before.length, to = from + text.length;
    const list = segments(value, 'sentence');
    const first = list.find(s => s.index + s.segment.length > from);
    const last = list.find(s => s.index + s.segment.length >= to);
    // Segmenter absence uses only trustworthy punctuation edges, not a text-position search.
    const left = first ? first.index : (before.match(/.*(?:[。！？!?]|(?<!\d)\.(?=\s))\s*/s)?.[0].length || 0);
    const right = last ? last.index + last.segment.length : to + (after.match(/^[\s\S]*?(?:[。！？!?]|(?<!\d)\.(?=\s|$))/)?.[0].length ?? after.length);
    const sentence = { before: before.slice(left), after: after.slice(0, right - to), complete: true };
    if ((!left && before.length === HARD_LIMIT) || (right === value.length && after.length === HARD_LIMIT)) sentence.complete = false;
    return { sentence, before: before.slice(0, left), after: after.slice(right - to) };
  }
  function capture(text) {
    text = text.trim();
    const sel = getSelection();
    const range = sel?.rangeCount && !sel.isCollapsed && sel.toString().trim() === text ? sel.getRangeAt(0).cloneRange() : null;
    if (!range) return { text, range: null, analysis: analyze(text), context: null };
    const start = block(range.startContainer), end = block(range.endContainer);
    const el = element(range.startContainer), cell = el?.closest('td,th');
    const kind = el?.closest('pre,code') ? 'code' : cell ? 'table' : el?.closest('h1,h2,h3,h4,h5,h6') ? 'heading' : 'prose';
    // The payload is trimmed, but spaces selected around it still belong to the source sentence.
    // Preserve them in the context edges without moving the saved Range or searching for text.
    const selected = range.toString();
    const leading = selected.slice(0, selected.length - selected.trimStart().length);
    const trailing = selected.slice(selected.trimEnd().length);
    let before = (pieces(start, range, 'before') + leading).slice(-HARD_LIMIT);
    let after = (trailing + pieces(end, range, 'after')).slice(0, HARD_LIMIT);
    const lang = el?.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang;
    const partial = start === end && (before.trim() || after.trim()) && !/[。.!?！？]\s*$/.test(before) && !/^\s*[。.!?！？]/.test(after);
    const partialWord = (/\p{Script=Latin}$/u.test(before) && /^\p{Script=Latin}/u.test(text)) || (/\p{Script=Latin}$/u.test(text) && /^\p{Script=Latin}/u.test(after));
    const localParts = start === end && kind === 'prose' && text.length <= 1500 ? containingSentence(before, text, after) : null;
    const analysis = analyze(text, { kind, before, after, partial: !!partial, partialWord, lang, sentenceBefore: localParts?.sentence.before, sentenceAfter: localParts?.sentence.after });
    const scope = start.closest(SCOPE) || document.body;
    const prev = neighbor(start, -1, scope), next = neighbor(end, 1, end.closest(SCOPE) || document.body);
    // A full selection supplies its own context. Short selections get a richer default.
    const budget = text.length > 1500 ? 800 : analysis.dependency || analysis.contextDependency || ['code','table','formula','reference'].includes(analysis.category) ? 2500 : 1500;
    const expand = analysis.dependency || analysis.contextDependency || ['fragment','response','heading','code','table','formula','reference','uncertain'].includes(analysis.category);
    let sentence = null;
    if (start === end && kind === 'prose' && text.length <= 1500 && !['passage','code'].includes(analysis.category)) {
      const parts = localParts;
      sentence = parts.sentence;
      before = expand ? parts.before : '';
      after = expand ? parts.after : '';
      if (!sentence.before && !sentence.after) sentence = null;
    } else if (!expand && start === end) { before = ''; after = ''; }
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
    // An actual language declaration is useful for Han-only Japanese; language-rule prose is not.
    const sourceLanguage = analysis.language === 'ja' && !/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) && /^ja\b/i.test(lang || '') ? 'ja' : '';
    const details = [...new Set(metadata)].join('\n').slice(0, 360);
    let available = Math.min(HARD_LIMIT, budget) - title.length - details.length - sourceLanguage.length;
    // The containing sentence is primary. Supplemental context never repeats its edges.
    if (sentence) {
      const left = Math.min(sentence.before.length, Math.ceil(available * .6));
      const right = Math.min(sentence.after.length, available - left);
      const leftLimit = Math.min(sentence.before.length, available - right);
      if (leftLimit < sentence.before.length || right < sentence.after.length) sentence.complete = false;
      sentence.before = clip(sentence.before, leftLimit, 'before');
      sentence.after = clip(sentence.after, right, 'after');
      available -= sentence.before.length + sentence.after.length;
    }
    let left = Math.min(before.length, Math.ceil(available * .6));
    let right = Math.min(after.length, available - left);
    left = Math.min(before.length, available - right);
    before = clip(before, left, 'before');
    after = clip(after, right, 'after');
    let spare = available - before.length - after.length;
    if (expand && prev && spare > 0 && kind !== 'table') {
      const separator = before ? '\n' : '';
      const extra = clip(pieces(prev, null, 'before'), Math.max(0, Math.min(500, spare - separator.length)), 'before');
      if (extra) before = extra + separator + before;
    }
    spare = available - before.length - after.length;
    if (expand && next && spare > 0 && kind !== 'table') {
      const separator = after ? '\n' : '';
      const extra = clip(pieces(next, null, 'after'), Math.max(0, Math.min(kind === 'heading' ? 900 : 400, spare - separator.length)), 'after');
      if (extra) after += separator + extra;
    }
    return { text, range, analysis, context: { title, before, after, details, sentence, lang: sourceLanguage, budget } };
  }
  function same(a, b) {
    if (!a || !b || a.text !== b.text) return false;
    const x = a.range, y = b.range;
    if (!x || !y) return !x && !y && JSON.stringify(a.context) === JSON.stringify(b.context);
    return x.startContainer === y.startContainer && x.startOffset === y.startOffset && x.endContainer === y.endContainer && x.endOffset === y.endOffset && JSON.stringify(a.context) === JSON.stringify(b.context);
  }
  return { analyze, capture, same, HARD_LIMIT };
})();

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 选区分析：判断文字类型，记录选区位置，提取附近句子、标题和表头。
// content.js 调用 capture；后台可单独调用 analyze，不需要网页对象。
// 分类是本地规则判断，有不确定性；Range 是选中文字的真实位置，不靠搜索同名文字。
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
// 第 3 行：globalThis的AISelection 改为 定义并立即执行初始化函数；内部步骤见下面各行。
// 第 4 行：准备 BLOCK（选区附近的段落标签）：“p,li,td,th,pre,blockquote,h1,h2,h3,h4,h5,h6,figcaption,dd,dt,summary”。
// 第 5 行：准备 SCOPE（背景材料范围的选择器）：本段文字要求或说明。
// 第 6 行：准备 EXCLUDE（不采集材料的区域选择器）：本段文字要求或说明。
// 第 7 行：准备 HARD_LIMIT（背景材料的字符硬上限）：3000。
// 第 8 行：准备 segmenters（分词和分句工具缓存）：建立按标识存取资料的 Map 表。
// 第 9 行：定义函数 segments：按词或句分割文字，并缓存分割工具；接收 文字、granularity。
// 第 10 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 11 行：如果 不满足（检查 分词和分句工具缓存 中是否有 granularity），在 分词和分句工具缓存 保存 granularity 对应的 创建 字段 对象。
// 第 12 行：结束当前函数，并返回 列表 [展开或收集 按指定粒度分割 文字]。
// 第 13 行：捕获前面步骤的错误，按下面步骤处理；结束当前函数，并返回 列表 []。
// 第 14 行：结束前面的代码块、资料列表或函数调用。
// 第 15 行：定义函数 analyze：用本地规则判断选区语言和结构；接收 文字、info，未传入时用 空资料对象 {}。
// 第 16 行：去掉选中文字两端的空白。
// 第 17 行：取出选区内的字母和汉字等文字字符。
// 第 18 行：定义 count：统计符合指定字符规则的数量。
// 第 19 行：准备 han（汉字数量）：统计符合字符规则的数量（字符匹配规则 /\p{Script=Han}/u）。
// 第 20 行：准备 kana（假名数量）：统计符合字符规则的数量（字符匹配规则 /[\p{Script=Hiragana}\p{Script=Katakana}]/u）；准备 hangul（韩文字母数量）：统计符合字符规则的数量（字符匹配规则 /\p{Script=Hangul}/u）。
// 第 21 行：准备 total（总数）：文字中的字母或汉字的length。
// 第 22 行：按字符分布初步判断语言：假名、韩文、汉字、混合或其他外语；没有字母时标为未知。
// 第 24 行：纯汉字也可能是日文；附近明确声明日语时尊重该声明。
// 第 25 行：优先用浏览器分词统计词数，不可用时按空白分割估计。
// 第 26 行：准备 sentences（句的数量）：从 按词或句分割文字，并缓存分割工具（待处理的值、“sentence”） 保留满足 检查 s的segment 是否符合 字符匹配规则 /\p{L}|\p{N}/u 的项的length。
// 第 27 行：检查选区中是否有“它、上述、因此、this”等上下文依赖线索。
// 第 28 行：检查前面的句子是否有“这称为”等解释关系。
// 第 29 行：检查是否像“好的、yes、thanks”等简短应答。
// 第 30 行：检查选区前后是否还有文字，判断它是否位于更大句段中。
// 第 31 行：准备 completeness（完整程度）：若 info的partialWord，用 “partial_word”；否则用 “complete”。
// 第 32 行：准备 category（内容类别），暂不赋值；准备 confidence（分类可信程度）：“medium”；准备 reason（分类依据），暂不赋值。
// 第 33 行：准备 kind（当前用途或内容类型）：（info的kind 或 “prose”）。
// 第 34 行：开始检查代码特征：代码区域、变量定义等。
// 第 35 行：继续检查函数、类、导入语句和 SQL 特征。
// 第 36 行：继续检查 npm、git、python 命令特征。
// 第 37 行：继续检查报错名称、箭头函数和调用结构。
// 第 38 行：代码证据明显时归类为 code，可信程度设高。
// 第 39 行：独立网址或文件路径归为 reference。
// 第 40 行：表格位置归为 table。
// 第 41 行：标题位置归为 heading。
// 第 42 行：编号形式归为 reference，但具体含义仍需上下文。
// 第 43 行：有运算符、积分符号或变量形式时归为 formula。
// 第 44 行：数值、日期或带单位指标归为 data。
// 第 45 行：多个句子或明显分段归为 passage。
// 第 46 行：继续前一行的判断条件；本行补充 else {。
// 第 47 行：检查是否有可靠的句末标点。
// 第 49 行：检查常见英语句式线索。
// 第 50 行：继续检查英语缩略形式。
// 第 51 行：继续检查请求和祈使句形式。
// 第 52 行：继续检查 let us 等表达。
// 第 53 行：继续检查一些其他语言的常见句式。
// 第 54 行：继续检查日语和韩语句末形式。
// 第 55 行：继续检查中文判断和关系词。
// 第 56 行：继续检查中文主语加动作形式。
// 第 57 行：检查应答前后是否处于有文字的句子中。
// 第 60 行：检查独立指代词或连接词是否必须依赖上下文。
// 第 61 行：开始检查局部选区是否像被截断的中文片段。
// 第 62 行：继续检查中文片段末尾的关系词。
// 第 63 行：继续检查英语片段末尾的连接词。
// 第 64 行：继续检查多词片段是否在助动词处截断。
// 第 65 行：只选中单词一部分时归为 fragment。
// 第 66 行：短应答在句中时归短语，独立出现时归回应。
// 第 67 行：明显依赖或截断时归片段，并标为需要上下文。
// 第 68 行：有句末或句式证据时归为 sentence。
// 第 69 行：单个外语词归为 word。
// 第 70 行：较短外语表达或短中日韩文本归为 phrase，保留歧义。
// 第 71 行：证据不足时标为 uncertain，让生成模型结合材料判断。
// 第 72 行：结束前面的代码块、资料列表或函数调用。
// 第 73 行：代码、公式、数据、表格、标题和引用属于特殊结构。
// 第 74 行：判断是否属于外语选区。
// 第 75 行：特殊结构、混合语言或未知语言走解释模式 C。
// 第 76 行：外语完整句段走 B 翻译；外语词语及短片段走 A 翻译加解释，其余走 C。
// 第 77 行：中文完整句段走 D 语境解读，其余走 C。
// 第 78 行：返回语言、类别、可信程度、理由、处理模式、依赖程度和完整性等分析结果。
// 第 79 行：结束前面的代码块、资料列表或函数调用。
// 第 80 行：定义函数 element：取得节点自身或父元素；接收 网页节点；结束当前函数，并返回 若 （网页节点（存在时）的nodeType 等于 1），用 网页节点；否则用 网页节点（存在时）的parentElement。
// 第 81 行：定义函数 visible：检查元素是否可用于背景采集；接收 当前界面元素。
// 第 82 行：如果 （不满足（当前界面元素） 或 向上寻找匹配 不采集材料的区域选择器 的最近元素），结束当前函数，并返回 否（false）。
// 第 83 行：开始循环：准备 p：当前界面元素；继续条件为 p；每轮后 p 改为 p的parentElement。
// 第 84 行：准备 style：读取 p 在浏览器中实际采用的样式。
// 第 85 行：如果 （（（style的display 等于 “none”） 或 （style的visibility 等于 “hidden”）） 或 （style的visibility 等于 “collapse”）），结束当前函数，并返回 否（false）。
// 第 86 行：结束前面的代码块、资料列表或函数调用。
// 第 87 行：结束当前函数，并返回 是（true）。
// 第 88 行：结束前面的代码块、资料列表或函数调用。
// 第 89 行：定义函数 block：寻找选区所在的段落；接收 网页节点。
// 第 90 行：准备 el（当前界面元素）：取得节点自身或父元素（网页节点）。
// 第 91 行：准备 semantic：向上寻找匹配 选区附近的段落标签 的最近元素。
// 第 92 行：如果 semantic，结束当前函数，并返回 semantic。
// 第 93 行：只要 （当前界面元素 且 （当前界面元素 不等于 document的body）），继续执行下面步骤。
// 第 94 行：如果 检查 列表 [“block”、“list-item”、“table-cell”] 是否包含 getComputedStyle的结果的display，结束当前函数，并返回 当前界面元素。
// 第 95 行：当前界面元素 改为 当前界面元素的parentElement。
// 第 96 行：结束前面的代码块、资料列表或函数调用。
// 第 97 行：结束当前函数，并返回 document的body。
// 第 98 行：结束前面的代码块、资料列表或函数调用。
// 第 100 行：定义函数 pieces：从真实节点位置向前或向后提取有限文字；接收 界面或扫描区域根元素、原文选区的位置对象、side、max，未传入时用 背景材料的字符硬上限。
// 第 101 行：准备 reverse：（side 等于 “before”）。
// 第 102 行：准备 visits：0。
// 第 103 行：准备 walker：建立逐个遍历网页节点的工具。
// 第 104 行：定义 对象方法 acceptNode，内部步骤见后续各行。
// 第 105 行：visits 加 1。
// 第 106 行：元素本身不作为文字收集；可见元素继续深入，不可见区域整块跳过。
// 第 107 行：可见文字节点允许收集，其他文字节点跳过。
// 第 108 行：结束前面的代码块、资料列表或函数调用。
// 第 109 行：结束前面的代码块、资料列表或函数调用。
// 第 110 行：准备 node（网页节点），暂不赋值；准备 output：“”；准备 anchor：（原文选区的位置对象 且 若 reverse，用 原文选区的位置对象的startContainer；否则用 原文选区的位置对象的endContainer）。
// 第 111 行：如果 （（anchor（存在时）的nodeType 等于 3） 且 检查 界面或扫描区域根元素 是否包含 anchor），执行下面这一组步骤。
// 第 112 行：walker的currentNode 改为 anchor。
// 第 113 行：在真实选区的起止节点内按偏移提取文字，不靠查找相同字串定位。
// 第 114 行：如果 reverse，执行下面这一组步骤。
// 第 116 行：准备 last：界面或扫描区域根元素。
// 第 117 行：只要 last的lastChild，继续执行下面步骤；last 改为 last的lastChild。
// 第 118 行：walker的currentNode 改为 last。
// 第 119 行：如果 （（（last的nodeType 等于 3） 且 检查元素是否可用于背景采集（last的parentElement）） 且 （不满足（原文选区的位置对象） 或 （调用 comparePoint（所属对象：原文选区的位置对象），传入 last、last的长度或数量 等于 - 1））），output 改为 截取 last的data，范围参数为 -max 的计算结果。
// 第 120 行：结束前面的代码块、资料列表或函数调用。
// 第 121 行：准备 previousParent：anchor（存在时）的parentElement。
// 第 122 行：在字符预算内遍历附近节点，最多访问约 2000 次。
// 第 123 行：准备 from：0；准备 to：网页节点的length。
// 第 124 行：如果 原文选区的位置对象，执行下面这一组步骤。
// 第 125 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 126 行：如果 （side 等于 “before”），执行下面这一组步骤。
// 第 127 行：如果 （网页节点 等于 原文选区的位置对象的startContainer），to 改为 原文选区的位置对象的startOffset。
// 第 128 行：如果 （调用 comparePoint（所属对象：原文选区的位置对象），传入 网页节点、网页节点的length 不等于 - 1），跳过本轮余下步骤，进入下一轮循环。
// 第 129 行：前一个条件不成立时，进入这个备用分支。
// 第 130 行：如果 （网页节点 等于 原文选区的位置对象的endContainer），from 改为 原文选区的位置对象的endOffset。
// 第 131 行：如果 （调用 comparePoint（所属对象：原文选区的位置对象），传入 网页节点、0 不等于 1），跳过本轮余下步骤，进入下一轮循环。
// 第 132 行：结束前面的代码块、资料列表或函数调用。
// 第 133 行：捕获前面步骤的错误，按下面步骤处理；跳过本轮余下步骤，进入下一轮循环。
// 第 134 行：结束前面的代码块、资料列表或函数调用。
// 第 135 行：准备 parent（父元素）：网页节点的parentElement。
// 第 136 行：准备 boundary：（previousParent 且 （（向上寻找匹配 选区附近的段落标签 的最近元素 不等于 向上寻找匹配 选区附近的段落标签 的最近元素） 或 若 reverse，用 （网页节点的nextSibling的nodeName 等于 "BR"）；否则用 （网页节点的previousSibling的nodeName 等于 "BR"）））。
// 第 137 行：准备 part：截取 网页节点的data，范围参数为 from、to。
// 第 138 行：把前文向前拼、后文向后拼；跨段或换行边界加入换行。
// 第 139 行：每次拼接后截到字符上限。
// 第 140 行：previousParent 改为 父元素。
// 第 141 行：结束前面的代码块、资料列表或函数调用。
// 第 142 行：结束当前函数，并返回 output。
// 第 143 行：结束前面的代码块、资料列表或函数调用。
// 第 144 行：定义函数 neighbor：在限定范围内找相邻材料；接收 start、direction、当前材料范围。
// 第 145 行：准备 el（当前界面元素）：start。
// 第 146 行：开始循环：准备 steps：0；继续条件为 （（当前界面元素 且 （当前界面元素 不等于 当前材料范围）） 且 （steps 小于 12））；每轮后 steps 加 1。
// 第 147 行：准备 next：若 （direction 小于 0），用 当前界面元素的previousElementSibling；否则用 当前界面元素的nextElementSibling。
// 第 148 行：如果 不满足（next），执行下面这一组步骤；当前界面元素 改为 当前界面元素的parentElement；跳过本轮余下步骤，进入下一轮循环。
// 第 149 行：遇到新的标题、文章、列表或消息边界就停止扩展材料。
// 第 150 行：如果 不满足（检查元素是否可用于背景采集（next）），执行下面这一组步骤；当前界面元素 改为 next；跳过本轮余下步骤，进入下一轮循环。
// 第 151 行：结束当前函数，并返回 next。
// 第 152 行：结束前面的代码块、资料列表或函数调用。
// 第 153 行：结束当前函数，并返回 空值 null。
// 第 154 行：结束前面的代码块、资料列表或函数调用。
// 第 155 行：定义函数 clip：在字符预算内尽量按句截取；接收 待处理的值、limit、side。
// 第 156 行：如果 （待处理的值的length 小于等于 limit），结束当前函数，并返回 待处理的值。
// 第 157 行：如果 不满足（limit），结束当前函数，并返回 “”。
// 第 158 行：准备 list（列表）：按词或句分割文字，并缓存分割工具（待处理的值、“sentence”）。
// 第 159 行：如果 （side 等于 “before”），执行下面这一组步骤。
// 第 160 行：准备 start：从 列表 找首个满足 （s的index 大于等于 （待处理的值的length 减去 limit）） 的项（存在时）的index。
// 第 161 行：如果 （start 不等于 undefined），结束当前函数，并返回 截取 待处理的值，范围参数为 start。
// 第 162 行：结束当前函数，并返回 截取 待处理的值，范围参数为 -limit 的计算结果。
// 第 163 行：结束前面的代码块、资料列表或函数调用。
// 第 164 行：准备 last：取 从 列表 保留满足 （（s的index 加上或拼接 s的segment的length） 小于等于 limit） 的项 的第 -1 项；负数从末尾数。
// 第 165 行：结束当前函数，并返回 若 last，用 截取 待处理的值，范围参数为 0、（last的index 加上或拼接 last的segment的length）；否则用 截取 待处理的值，范围参数为 0、limit。
// 第 166 行：结束前面的代码块、资料列表或函数调用。
// 第 167 行：定义函数 containingSentence：拆出选中文字所在句与额外上下文；接收 前面的文字、文字、后面的文字。
// 第 168 行：拼接前文、选区和后文，并计算选区在拼接文字中的起止偏移。
// 第 169 行：准备 list（列表）：按词或句分割文字，并缓存分割工具（待处理的值、“sentence”）。
// 第 170 行：准备 first：从 列表 找首个满足 （（s的index 加上或拼接 s的segment的length） 大于 from） 的项。
// 第 171 行：准备 last：从 列表 找首个满足 （（s的index 加上或拼接 s的segment的length） 大于等于 to） 的项。
// 第 173 行：优先用分句结果找左边界，否则用可靠标点作备用边界。
// 第 174 行：优先用分句结果找右边界，否则用可靠标点作备用边界。
// 第 175 行：准备 sentence（所在句的信息）：一组字段（before: slice的结果、after: slice的结果、complete: 是（true））。
// 第 176 行：采集范围可能碰到字符硬上限时，不声称句子完整。
// 第 177 行：结束当前函数，并返回 一组字段（sentence、before: slice的结果、after: slice的结果）。
// 第 178 行：结束前面的代码块、资料列表或函数调用。
// 第 179 行：定义函数 capture：保存真实选区并收集预算内背景；接收 文字。
// 第 180 行：文字 改为 去掉 文字 两端空白。
// 第 181 行：准备 sel：取得浏览器当前文字选区。
// 第 182 行：只有浏览器当前真实选区与传入文字一致时，才复制 Range 位置。
// 第 183 行：没有可靠位置时，只分析文字，不提供网页背景。
// 第 184 行：准备 start：寻找选区所在的段落（原文选区的位置对象的startContainer）；准备 end：寻找选区所在的段落（原文选区的位置对象的endContainer）。
// 第 185 行：准备 el（当前界面元素）：取得节点自身或父元素（原文选区的位置对象的startContainer）；准备 cell：向上寻找匹配 “td,th” 的最近元素。
// 第 186 行：根据所在位置确定代码、表格、标题或普通文字类型。
// 第 189 行：准备 selected（选中的任务或文字）：将 原文选区的位置对象 转成文字。
// 第 190 行：准备 leading：截取 选中的任务或文字，范围参数为 0、（选中的任务或文字的length 减去 去掉 选中的任务或文字 开头空白的length）。
// 第 191 行：准备 trailing：截取 选中的任务或文字，范围参数为 trimEnd的结果的长度或数量。
// 第 192 行：准备 before（前面的文字）：截取 （从真实节点位置向前或向后提取有限文字（start、原文选区的位置对象、“before”） 加上或拼接 leading），范围参数为 -HARD_LIMIT 的计算结果。
// 第 193 行：准备 after（后面的文字）：截取 （trailing 加上或拼接 从真实节点位置向前或向后提取有限文字（end、原文选区的位置对象、“after”）），范围参数为 0、背景材料的字符硬上限。
// 第 194 行：准备 lang（网页语言声明）：（读取 向上寻找匹配 “[lang]” 的最近元素 的属性 “lang” 或 document的documentElement的lang）。
// 第 195 行：检查选区是否位于同段句子的中间。
// 第 196 行：检查拉丁文字边缘是否落在单词内部。
// 第 197 行：短的普通同段选区，提前拆出所在句。
// 第 198 行：将位置、语言和句子线索一起交给本地分类。
// 第 199 行：准备 scope（当前材料范围）：（向上寻找匹配 背景材料范围的选择器 的最近元素 或 document的body）。
// 第 200 行：准备 prev：在限定范围内找相邻材料（start、-1、当前材料范围）；准备 next：在限定范围内找相邻材料（end、1、（向上寻找匹配 背景材料范围的选择器 的最近元素 或 document的body））。
// 第 202 行：长选区背景预算 800；明显依赖上下文或特殊结构 2500；其他短选区 1500 字符。
// 第 203 行：依赖性或片段、回应、标题等类别决定是否补充额外段落。
// 第 204 行：准备 sentence（所在句的信息）：空值 null。
// 第 205 行：如果 （（（（start 等于 end） 且 （当前用途或内容类型 等于 "prose"）） 且 （文字的length 小于等于 1500）） 且 不满足（检查 列表 ["passage"、"code"] 是否包含 选区分析结果的内容类别）），执行下面这一组步骤。
// 第 206 行：准备 parts：localParts。
// 第 207 行：所在句的信息 改为 parts的sentence。
// 第 208 行：前面的文字 改为 若 expand，用 parts的before；否则用 “”。
// 第 209 行：后面的文字 改为 若 expand，用 parts的after；否则用 “”。
// 第 210 行：如果 （不满足（所在句的信息的before） 且 不满足（所在句的信息的after）），所在句的信息 改为 空值 null。
// 第 211 行：如果 （不满足（expand） 且 （start 等于 end）），执行下面这一组步骤；前面的文字 改为 “”；后面的文字 改为 “”。
// 第 212 行：准备 metadata（标题和表头等结构材料）：列表 []。
// 第 213 行：如果 cell，执行下面这一组步骤。
// 第 214 行：准备 table：向上寻找匹配 “table” 的最近元素。
// 第 215 行：准备 caption：在 table 中找到首个匹配 “caption” 的元素。
// 第 216 行：如果 （caption 且 检查元素是否可用于背景采集（caption）），把 （“表格：” 加上或拼接 从真实节点位置向前或向后提取有限文字（caption、空值 null、“after”、120）） 加到 标题和表头等结构材料 末尾。
// 第 217 行：准备 row：cell的parentElement。
// 第 218 行：准备 index（序号）：找 cell 在 列表 [展开或收集 row的children] 中的位置。
// 第 219 行：用单元格在这一行的位置寻找同列标题。
// 第 220 行：检查行标题和首行列标题。
// 第 221 行：如果 （（label 且 （label 不等于 cell）） 且 检查元素是否可用于背景采集（label）），把 （“表头：” 加上或拼接 从真实节点位置向前或向后提取有限文字（label、空值 null、“after”、120）） 加到 标题和表头等结构材料 末尾。
// 第 222 行：结束前面的代码块、资料列表或函数调用。
// 第 223 行：结束前面的代码块、资料列表或函数调用。
// 第 224 行：准备 heading：空值 null。
// 第 225 行：开始循环：准备 p：start；准备 steps：0；继续条件为 （（p 且 （p 不等于 当前材料范围）） 且 （steps 小于 12））；每轮后 p 改为 p的parentElement；再steps 加 1。
// 第 226 行：准备 sibling：p的previousElementSibling。
// 第 227 行：开始循环：准备 n：0；继续条件为 （sibling 且 （n 小于 6））；每轮后 n 加 1；再sibling 改为 sibling的previousElementSibling。
// 第 228 行：如果 （检查 sibling的tagName 是否符合 字符匹配规则 /^H[1-6]$/ 且 检查元素是否可用于背景采集（sibling）），执行下面这一组步骤；heading 改为 sibling；跳出当前循环。
// 第 229 行：结束前面的代码块、资料列表或函数调用。
// 第 230 行：如果 heading，跳出当前循环。
// 第 231 行：结束前面的代码块、资料列表或函数调用。
// 第 232 行：如果 heading，把 （“小标题：” 加上或拼接 从真实节点位置向前或向后提取有限文字（heading、空值 null、“after”、120）） 加到 标题和表头等结构材料 末尾。
// 第 233 行：有结构标题时优先用结构资料；否则使用最多 120 字符的网页标题。
// 第 235 行：仅纯汉字且有明确日语声明的情况附上 ja，不凭汉字猜中文。
// 第 236 行：准备 details（结构说明）：截取 用 “\n” 连接 列表 [展开或收集 建立不重复的 Set 集合（标题和表头等结构材料）] 的各项，范围参数为 0、360。
// 第 237 行：从字符预算扣掉标题、结构说明和语言声明。
// 第 239 行：如果 所在句的信息，执行下面这一组步骤。
// 第 240 行：准备 left（左侧坐标或上文预算）：取 所在句的信息的before的length、把 （可用字符数或空间 乘以 0.6） 向上取整 的较小值。
// 第 241 行：准备 right（右侧坐标或下文预算）：取 所在句的信息的after的length、（可用字符数或空间 减去 左侧坐标或上文预算） 的较小值。
// 第 242 行：准备 leftLimit：取 所在句的信息的before的length、（可用字符数或空间 减去 右侧坐标或下文预算） 的较小值。
// 第 243 行：预算截短了所在句时将完整标志设为 false。
// 第 244 行：所在句的信息的before 改为 在字符预算内尽量按句截取（所在句的信息的前面的文字、leftLimit、“before”）。
// 第 245 行：所在句的信息的after 改为 在字符预算内尽量按句截取（所在句的信息的后面的文字、右侧坐标或下文预算、“after”）。
// 第 246 行：可用字符数或空间 减去 （所在句的信息的before的length 加上或拼接 所在句的信息的after的length）。
// 第 247 行：结束前面的代码块、资料列表或函数调用。
// 第 248 行：准备 left（左侧坐标或上文预算）：取 前面的文字的length、把 （可用字符数或空间 乘以 0.6） 向上取整 的较小值。
// 第 249 行：准备 right（右侧坐标或下文预算）：取 后面的文字的length、（可用字符数或空间 减去 左侧坐标或上文预算） 的较小值。
// 第 250 行：左侧坐标或上文预算 改为 取 前面的文字的length、（可用字符数或空间 减去 右侧坐标或下文预算） 的较小值。
// 第 251 行：前面的文字 改为 在字符预算内尽量按句截取（前面的文字、左侧坐标或上文预算、“before”）。
// 第 252 行：后面的文字 改为 在字符预算内尽量按句截取（后面的文字、右侧坐标或下文预算、“after”）。
// 第 253 行：准备 spare：（（可用字符数或空间 减去 前面的文字的length） 减去 后面的文字的length）。
// 第 254 行：如果 （（（expand 且 prev） 且 （spare 大于 0）） 且 （当前用途或内容类型 不等于 “table”）），执行下面这一组步骤。
// 第 255 行：准备 separator：若 前面的文字，用 “\n”；否则用 “”。
// 第 256 行：准备 extra：在字符预算内尽量按句截取（pieces的结果、max的结果、“before”）。
// 第 257 行：如果 extra，前面的文字 改为 （（extra 加上或拼接 separator） 加上或拼接 前面的文字）。
// 第 258 行：结束前面的代码块、资料列表或函数调用。
// 第 259 行：spare 改为 （（可用字符数或空间 减去 前面的文字的length） 减去 后面的文字的length）。
// 第 260 行：如果 （（（expand 且 next） 且 （spare 大于 0）） 且 （当前用途或内容类型 不等于 “table”）），执行下面这一组步骤。
// 第 261 行：准备 separator：若 后面的文字，用 “\n”；否则用 “”。
// 第 262 行：准备 extra：在字符预算内尽量按句截取（pieces的结果、max的结果、“after”）。
// 第 263 行：如果 extra，后面的文字 累加或追加 （separator 加上或拼接 extra）。
// 第 264 行：结束前面的代码块、资料列表或函数调用。
// 第 265 行：返回原文、真实位置、分析结果和预算内背景材料。
// 第 266 行：结束前面的代码块、资料列表或函数调用。
// 第 267 行：定义函数 same：比较两次选区的位置、文字和背景；接收 a、b。
// 第 268 行：如果 （（不满足（a） 或 不满足（b）） 或 （a的text 不等于 b的text）），结束当前函数，并返回 否（false）。
// 第 269 行：准备 x：a的range；准备 y：b的range。
// 第 270 行：没有 Range 的两次快照，只有双方都没位置且背景相同才算同一选区。
// 第 271 行：有 Range 时比较起止节点、偏移和背景内容，不能只比较文字。
// 第 272 行：结束前面的代码块、资料列表或函数调用。
// 第 273 行：结束当前函数，并返回 一组字段（analyze、capture、same、HARD_LIMIT）。
// 第 274 行：结束初始化函数并立即执行，完成本文件的注册。
