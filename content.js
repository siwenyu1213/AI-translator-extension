// ========== 说文 · LingoClarify — Content Script ==========
// 文件职责：自动/右键划词、流式结果浮层、选区避让与拖动、复制/导出及全文翻译入口。

let tooltip = null;
let currentText = null;
let currentSelection = null;
let currentExplanation = null;
let isLoading = false;
let currentStreamPort = null;
let currentRenderers = [];
let scrollRaf = null;
let tooltipAnchor = null;
let tooltipFocusReturn = null;
let tooltipManualPosition = null;
let tooltipDrag = null;
let tooltipDragEndedAt = 0;
let downloadRequest = null;

// ── 触发模式 ──
let triggerMode = 'auto';
let usePageContext = true;
let selectionDebounce = null;
let lastContextMenuPos = { x: 0, y: 0 };
let contextMenuSelection = null;

// ── 扩展上下文有效性检测（重载后旧页面的 runtime 会失效）──
function isRuntimeAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}
function safeSendMessage(msg) {
  if (!isRuntimeAlive()) return Promise.resolve();
  return chrome.runtime.sendMessage(msg).catch(() => {});
}
function safeConnect(name) {
  if (!isRuntimeAlive()) return null;
  try { return chrome.runtime.connect({ name }); } catch { return null; }
}

function modeLabel(mode) {
  return { A: '翻译+解释', B: '翻译', C: '拓展解释', D: '语境解读' }[mode] || '智能解释';
}

// ═══════════════════════════════════════════
// 弹窗 DOM（只创建一次）
// ═══════════════════════════════════════════

function getTooltip() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'deepseek-explain-tooltip';
    LingoTheme.attach(tooltip);
    tooltip.inert = true;
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.innerHTML = `
      <div class="ds-header">
        <span class="ds-drag-handle">
          <span class="lc-brand-icon" aria-hidden="true"></span>
          <svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="9" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="9" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="9" cy="13" r="1.2"/></svg>
          <span class="ds-brand">说文 · 解释</span>
        </span>
        <button class="ds-close" title="关闭" aria-label="关闭结果">×</button>
      </div>
      <div class="ds-reasoning" style="display:none">
        <div class="ds-reasoning-title">思考中…</div>
        <div class="ds-reasoning-body"></div>
      </div>
      <div class="ds-quote"></div>
      <div class="ds-body"></div>
      <div class="ds-actions">
        <button class="ds-btn ds-btn-copy" title="复制 Markdown 原文">
          <span class="ds-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </span>
          <span class="ds-btn-label">复制</span>
        </button>
        <button class="ds-btn ds-btn-download" title="下载内容">
          <span class="ds-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </span>
          <span class="ds-btn-label">下载</span>
        </button>
      </div>
      <div class="ds-footer">
        <span class="ds-model-tag"></span>
        <span class="ds-powered">LingoClarify</span>
      </div>
    `;
    tooltip.querySelector('.ds-close').addEventListener('click', hideTooltip);
    tooltip.querySelector('.ds-btn-copy').addEventListener('click', handleCopy);
    tooltip.querySelector('.ds-btn-download').addEventListener('click', handleDownload);
    const header = tooltip.querySelector('.ds-header');
    header.addEventListener('pointerdown', startTooltipDrag);
    header.addEventListener('pointermove', moveTooltipDrag);
    header.addEventListener('pointerup', endTooltipDrag);
    header.addEventListener('pointercancel', endTooltipDrag);
    header.addEventListener('lostpointercapture', endTooltipDrag);
    document.body.appendChild(tooltip);
    new ResizeObserver(scheduleTooltipPosition).observe(tooltip);
  }
  return tooltip;
}

// ═══════════════════════════════════════════
// 坐标计算
// ═══════════════════════════════════════════

function getSelectionDocCoords(range = currentSelection?.range) {
  if (!range?.startContainer.isConnected || !range.endContainer.isConnected ||
      isInTooltip(range.commonAncestorContainer)) return null;
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return {
    left: rect.left + window.scrollX,
    bottom: rect.bottom + window.scrollY,
    right: rect.right + window.scrollX,
    top: rect.top + window.scrollY
  };
}

function positionTooltip(docCoords) {
  const el = getTooltip();
  el.classList.remove('ds-hidden');
  el.classList.add('ds-visible');
  el.inert = false;
  el.setAttribute('aria-hidden', 'false');
  el.style.display = 'flex';
  el.style.setProperty('--ds-viewport-height', `${window.innerHeight}px`);

  const gap = 10;
  const width = window.innerWidth, height = window.innerHeight;
  el.style.removeProperty('--ds-placement-height');
  let rect = el.getBoundingClientRect();
  const clampX = x => Math.max(gap, Math.min(x, width - gap - rect.width));
  const clampY = y => Math.max(gap, Math.min(y, height - gap - rect.height));
  let left, top;
  if (tooltipManualPosition) {
    left = clampX(tooltipManualPosition.left);
    top = clampY(tooltipManualPosition.top);
    tooltipManualPosition = { left, top };
  } else {
    const source = { left: docCoords.left - scrollX, right: docCoords.right - scrollX,
      top: docCoords.top - scrollY, bottom: docCoords.bottom - scrollY };
    const alignedX = clampX(source.left);
    const alignedY = clampY(source.top);
    const candidates = [
      { left: alignedX, top: source.bottom + gap },
      { left: alignedX, top: source.top - gap - rect.height },
      { left: source.right + gap, top: alignedY },
      { left: source.left - gap - rect.width, top: alignedY }
    ];
    const fits = p => p.left >= gap && p.top >= gap &&
      p.left + rect.width <= width - gap && p.top + rect.height <= height - gap;
    let placement = candidates.find(fits);
    if (!placement) {
      // Neither vertical side fits the natural height: scroll inside the larger free side.
      const below = Math.max(0, height - gap - Math.max(gap, source.bottom + gap));
      const above = Math.max(0, Math.min(height - gap, source.top - gap) - gap);
      const available = Math.max(below, above);
      if (available > 0) {
        el.style.setProperty('--ds-placement-height', `${available}px`);
        rect = el.getBoundingClientRect();
        placement = { left: clampX(source.left), top: below >= above ? Math.max(gap, source.bottom + gap) : Math.min(height - gap, source.top - gap) - rect.height };
      } else {
        // A selection filling the viewport leaves no disjoint area; keep the handle reachable.
        placement = { left: alignedX, top: gap };
      }
    }
    left = clampX(placement.left);
    top = clampY(placement.top);
  }
  el.style.left = `${left + scrollX}px`;
  el.style.top = `${top + scrollY}px`;
}

function startTooltipDrag(e) {
  if (e.button !== 0 || !e.isPrimary || e.target.closest('.ds-close')) return;
  const rect = tooltip.getBoundingClientRect();
  const captureTarget = e.target.closest('.ds-drag-handle') || e.currentTarget;
  tooltipDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false, captureTarget };
  captureTarget.setPointerCapture(e.pointerId);
  tooltip.classList.add('ds-dragging');
  // Preserve the original selection instead of starting a new text selection in the header.
  e.preventDefault();
}

function moveTooltipDrag(e) {
  if (!tooltipDrag || tooltipDrag.id !== e.pointerId) return;
  const dx = e.clientX - tooltipDrag.x, dy = e.clientY - tooltipDrag.y;
  if (!tooltipDrag.moved && Math.hypot(dx, dy) < 3) return;
  tooltipDrag.moved = true;
  tooltipManualPosition = { left: tooltipDrag.left + dx, top: tooltipDrag.top + dy };
  positionTooltip(tooltipAnchor);
}

function endTooltipDrag() {
  if (!tooltipDrag) return;
  const drag = tooltipDrag;
  tooltipDrag = null;
  tooltip.classList.remove('ds-dragging');
  if (drag.moved) tooltipDragEndedAt = Date.now();
  if (drag.captureTarget.hasPointerCapture(drag.id)) drag.captureTarget.releasePointerCapture(drag.id);
}

// 原文 Range 是定位锚点；用户在结果内选字不会改变锚点。
function scheduleTooltipPosition() {
  if (!isTooltipVisible() || scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    if (!isTooltipVisible()) return;
    tooltipAnchor = getSelectionDocCoords() || tooltipAnchor;
    if (tooltipAnchor) positionTooltip(tooltipAnchor);
  });
}

function hideTooltip() {
  if (!tooltip) return;
  abortStream();
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  scrollRaf = null;
  endTooltipDrag();
  if (tooltip.contains(document.activeElement)) {
    document.activeElement.blur();
    if (tooltipFocusReturn?.isConnected) tooltipFocusReturn.focus({ preventScroll: true });
  }
  tooltip.inert = true;
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.classList.add('ds-hidden');
  tooltip.classList.remove('ds-visible');
  resetDownloadAction();
  tooltipAnchor = null;
  tooltipManualPosition = null;
  tooltipFocusReturn = null;
  currentText = null;
  currentSelection = null;
  currentExplanation = null;
  isLoading = false;
}

// ═══════════════════════════════════════════
// 流式中止
// ═══════════════════════════════════════════

function abortStream() {
  if (currentStreamPort) {
    const port = currentStreamPort;
    currentStreamPort = null;
    try { port.disconnect(); } catch {}
  }
  for (const renderer of currentRenderers) {
    try { renderer.cancel(); } catch {}
  }
  currentRenderers = [];
}

function showStreamFailure(el, error) {
  abortStream();
  isLoading = false;
  currentExplanation = null;
  el.querySelector('.ds-reasoning').style.display = 'none';
  const body = el.querySelector('.ds-body');
  body.classList.remove('ds-streaming');
  body.innerHTML = `<span class="ds-error">${escapeHtml(error)}</span>`;
  el.querySelector('.ds-actions').style.display = 'none';
  el.querySelector('.ds-model-tag').textContent = '';
}

// 真流式文本渲染器：网络 chunk 先进入播放队列，再每帧定量追加。
// 这样既不会“一口气全显示”，也不会把超长文本一次性塞进 DOM 造成卡死/闪退。
const MAX_CHARS_PER_FRAME = 2048;

function createStreamingTextRenderer(container) {
  const textNode = document.createTextNode('');
  container.textContent = '';
  container.appendChild(textNode);

  let pending = '';
  let rafId = 0;

  const schedule = () => {
    if (!rafId && pending) rafId = requestAnimationFrame(step);
  };

  function step() {
    rafId = 0;
    if (!pending) {
      return;
    }

    // 自适应追赶：小段慢慢吐，大段拆成多帧，但单帧最多 2048 字符
    const adaptive = Math.max(1, Math.ceil(pending.length / 12));
    const take = Math.min(pending.length, MAX_CHARS_PER_FRAME, adaptive);
    textNode.appendData(pending.slice(0, take));
    pending = pending.slice(take);

    if (pending) schedule();
  }

  return {
    push(chunk) {
      if (!chunk) return;
      pending += chunk;
      schedule();
    },
    cancel() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = '';
    }
  };
}

// ═══════════════════════════════════════════
// 统一流式弹窗触发（解释 & 翻译共用）
// ═══════════════════════════════════════════

async function triggerWithStream({ text, mode, popupTitle, snapshot }) {
  if (!text?.trim()) return;
  snapshot ||= AISelection.capture(text);
  mode ||= snapshot.analysis.mode;
  popupTitle ||= `说文 · ${modeLabel(mode)}`;
  if (AISelection.same(snapshot, currentSelection) && tooltip?.classList.contains('ds-visible') && !tooltip.querySelector('.ds-error')) return;

  // 中止上一个流
  abortStream();
  currentText = text;
  currentSelection = snapshot;
  isLoading = true;
  currentExplanation = null;

  const coords = getSelectionDocCoords(snapshot.range) || {
    left: lastContextMenuPos.x,
    bottom: lastContextMenuPos.y,
    right: lastContextMenuPos.x,
    top: lastContextMenuPos.y
  };

  const el = getTooltip();
  if (!el.contains(document.activeElement)) tooltipFocusReturn = document.activeElement;
  tooltipAnchor = coords;
  endTooltipDrag();
  tooltipManualPosition = null;
  resetDownloadAction();
  const bodyEl = el.querySelector('.ds-body');
  const reasoningEl = el.querySelector('.ds-reasoning');
  const reasoningTitleEl = el.querySelector('.ds-reasoning-title');
  const reasoningBodyEl = el.querySelector('.ds-reasoning-body');

  el.querySelector('.ds-brand').textContent = popupTitle;
  el.querySelector('.ds-quote').textContent = truncate(text, 80);
  bodyEl.classList.add('ds-streaming');
  reasoningEl.style.display = 'none';
  reasoningTitleEl.textContent = '思考中…';
  el.querySelector('.ds-actions').style.display = 'none';
  el.querySelector('.ds-model-tag').textContent = '';

  const bodyRenderer = AIMarkdown.createStreamingRenderer(bodyEl);
  const reasoningRenderer = createStreamingTextRenderer(reasoningBodyEl);
  currentRenderers = [bodyRenderer, reasoningRenderer];
  let buffer = '';
  let hasReasoning = false;
  let hasContent = false;

  positionTooltip(coords);

  // 建立流式连接
  const port = safeConnect(`stream-${Date.now()}`);
  if (!port) {
    isLoading = false;
    bodyRenderer.cancel();
    bodyEl.classList.remove('ds-streaming');
    bodyEl.innerHTML = '<span class="ds-error">扩展已重载，请刷新页面后重试</span>';
    return;
  }
  currentStreamPort = port;

  port.onMessage.addListener((msg) => {
    if (currentStreamPort !== port) return;
    if (msg.type === 'reasoning-token') {
      hasReasoning = true;
      reasoningEl.style.display = 'block';
      reasoningRenderer.push(msg.token);
    } else if (msg.type === 'token') {
      if (!hasContent) {
        hasContent = true;
        if (hasReasoning) reasoningTitleEl.textContent = '思考过程';
      }
      buffer += msg.token;
      bodyRenderer.push(msg.token);
    } else if (msg.type === 'done') {
      isLoading = false;
      currentExplanation = buffer;
      bodyRenderer.setFinal(buffer);
      bodyEl.classList.remove('ds-streaming');
      el.querySelector('.ds-actions').style.display = 'flex';
      el.querySelector('.ds-model-tag').textContent = msg.model || '';
      // 🆕 模式 B：翻译完成后显示“解释此句”按钮
      updateExtraActions(mode);
      currentStreamPort = null;
      try { port.disconnect(); } catch {}
    } else if (msg.type === 'error') {
      showStreamFailure(el, msg.error);
    }
  });

  port.onDisconnect.addListener(() => {
    // 旧流被新流顶替时（abortStream），其回调不得干扰新流状态
    if (currentStreamPort !== port) return;
    currentStreamPort = null;
    if (isLoading) {
      showStreamFailure(el, '⚠️ 连接中断，请重试');
    }
  });

  // 发送请求（根据开关决定是否携带上下文）
  const context = usePageContext ? snapshot.context : null;
  try { port.postMessage({
    type: 'STREAM_REQUEST',
    mode,
    text,
    context,
    analysis: snapshot.analysis
  }); } catch { showStreamFailure(el, '⚠️ 连接中断，请重试'); }
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isInTooltip(node) {
  return tooltip && tooltip.contains(node);
}

// ═══════════════════════════════════════════
// 网页上下文提取
// ═══════════════════════════════════════════

function getPageContext() {
  return currentSelection?.context || null;
}

// ═══════════════════════════════════════════
// 复制 & 下载
// ═══════════════════════════════════════════

async function handleCopy(e) {
  e.stopPropagation();
  if (!currentExplanation) return;
  try {
    await navigator.clipboard.writeText(currentExplanation);
    const btn = tooltip.querySelector('.ds-btn-copy .ds-btn-label');
    const original = btn.textContent;
    btn.textContent = '已复制';
    btn.style.color = 'var(--lc-success)';
    setTimeout(() => { btn.textContent = original; btn.style.color = ''; }, 1500);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentExplanation;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function resetDownloadAction() {
  clearTimeout(downloadRequest?.timer);
  downloadRequest = null;
  const button = tooltip?.querySelector('.ds-btn-download');
  if (!button) return;
  button.disabled = false;
  button.querySelector('.ds-btn-label').textContent = '下载';
  button.querySelector('.ds-btn-label').style.color = '';
}

async function handleDownload(e) {
  e.stopPropagation();
  if (!currentText || !currentExplanation || downloadRequest?.pending) return;
  resetDownloadAction();
  const request = { pending: true, timer: null };
  downloadRequest = request;
  const button = tooltip.querySelector('.ds-btn-download');
  const label = button.querySelector('.ds-btn-label');
  button.disabled = true;
  label.textContent = '下载中…';
  let timeout;
  const result = await Promise.race([
    safeSendMessage({ type: 'DOWNLOAD', text: currentText, explanation: currentExplanation }),
    new Promise(resolve => { timeout = setTimeout(() => resolve(null), 15000); })
  ]);
  clearTimeout(timeout);
  if (downloadRequest !== request) return;
  request.pending = false;
  button.disabled = false;
  label.textContent = result?.ok ? '已开始下载' : '下载失败，重试';
  label.style.color = result?.ok ? 'var(--lc-success)' : 'var(--lc-error)';
  if (result?.ok) request.timer = setTimeout(() => {
    if (downloadRequest === request) resetDownloadAction();
  }, 1500);
}

// 🆕 显示/隐藏 B 类"解释此句"额外按钮
function updateExtraActions(mode) {
  // 移除旧额外按钮
  const oldBtn = tooltip.querySelector('.ds-btn-explain-this');
  if (oldBtn) oldBtn.remove();

  if (mode !== 'B') return;

  const btn = document.createElement('button');
  btn.className = 'ds-btn ds-btn-explain-this';
  btn.title = '结合上下文解释这句话的含义';
  btn.innerHTML = `
    <span class="ds-btn-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="15" x2="15.01" y2="15"></line></svg>
    </span>
    <span class="ds-btn-label">解释此句</span>`;
  btn.addEventListener('click', handleExplainThis);
  btn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  tooltip.querySelector('.ds-actions').appendChild(btn);
}

async function handleExplainThis(e) {
  e.stopPropagation();
  e.preventDefault();

  const btn = e.currentTarget;
  // 备份当前文本（防止 currentText 在异步期间被清空）
  const textToExplain = currentText;
  if (!textToExplain) {
    btn.querySelector('.ds-btn-label').textContent = '无文本';
    return;
  }

  btn.disabled = true;
  btn.querySelector('.ds-btn-label').textContent = '解释中…';

  abortStream();
  isLoading = true;
  currentExplanation = null;

  // 确保 tooltip 可见
  const el = getTooltip();
  el.querySelector('.ds-brand').textContent = `说文 · ${modeLabel('D')}`;
  el.classList.add('ds-visible');
  el.classList.remove('ds-hidden');
  el.style.display = 'flex';
  el.inert = false;
  el.setAttribute('aria-hidden', 'false');
  resetDownloadAction();
  el.querySelector('.ds-actions').style.display = 'none';
  el.querySelector('.ds-model-tag').textContent = '';

  const port = safeConnect(`stream-${Date.now()}`);
  if (!port) {
    showStreamFailure(el, '扩展已重载，请刷新页面后重试');
    return;
  }
  currentStreamPort = port;

  const bodyEl = el.querySelector('.ds-body');
  const reasoningEl = el.querySelector('.ds-reasoning');
  const reasoningTitleEl = el.querySelector('.ds-reasoning-title');
  const reasoningBodyEl = el.querySelector('.ds-reasoning-body');

  bodyEl.classList.add('ds-streaming');
  reasoningEl.style.display = 'none';
  reasoningTitleEl.textContent = '思考中…';
  const bodyRenderer = AIMarkdown.createStreamingRenderer(bodyEl);
  const reasoningRenderer = createStreamingTextRenderer(reasoningBodyEl);
  currentRenderers = [bodyRenderer, reasoningRenderer];
  let buffer = '';
  let hasReasoning = false;

  const cleanup = () => {
    isLoading = false;
    bodyEl.classList.remove('ds-streaming');
    btn.remove();
    currentStreamPort = null;
    try { port.disconnect(); } catch {}
  };

  port.onMessage.addListener((msg) => {
    if (currentStreamPort !== port) return;
    if (msg.type === 'reasoning-token') {
      hasReasoning = true;
      reasoningEl.style.display = 'block';
      reasoningRenderer.push(msg.token);
    } else if (msg.type === 'token') {
      if (hasReasoning && !buffer) reasoningTitleEl.textContent = '思考过程';
      buffer += msg.token;
      bodyRenderer.push(msg.token);
    } else if (msg.type === 'done') {
      currentExplanation = buffer;
      bodyRenderer.setFinal(currentExplanation);
      el.querySelector('.ds-actions').style.display = 'flex';
      el.querySelector('.ds-model-tag').textContent = msg.model || '';
      cleanup();
    } else if (msg.type === 'error') {
      showStreamFailure(el, msg.error);
      cleanup();
    }
  });

  port.onDisconnect.addListener(() => {
    // 旧流被新流顶替时（abortStream），其回调不得干扰新流状态
    if (currentStreamPort !== port) return;
    if (isLoading) {
      showStreamFailure(el, '⚠️ 连接中断，请重试');
      cleanup();
    }
  });

  try { port.postMessage({
    type: 'STREAM_REQUEST',
    mode: 'D',
    text: textToExplain,
    context: usePageContext ? getPageContext() : null,
    analysis: currentSelection?.analysis,
    explicitTask: 'interpret'
  }); } catch { showStreamFailure(el, '⚠️ 连接中断，请重试'); cleanup(); }
}

// ═══════════════════════════════════════════
// 事件监听：触发模式
// ═══════════════════════════════════════════

(async function initTriggerMode() {
  try {
    const stored = await chrome.storage.local.get({ triggerMode: 'auto', usePageContext: true });
    triggerMode = stored.triggerMode || 'auto';
    usePageContext = stored.usePageContext !== false;
  } catch {}
})();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.triggerMode) {
    triggerMode = changes.triggerMode.newValue || 'auto';
  }
  if (changes.usePageContext) {
    usePageContext = changes.usePageContext.newValue !== false;
  }
});

// ── 右键点击位置记录 ──
document.addEventListener('contextmenu', (e) => {
  lastContextMenuPos.x = e.clientX + window.scrollX;
  lastContextMenuPos.y = e.clientY + window.scrollY;
  const text = window.getSelection()?.toString().trim();
  contextMenuSelection = text ? AISelection.capture(text) : null;
});

// ── 检测是否在输入框/搜索框/编辑器内（用户正在编辑，不触发）──
function isEditingElement() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute('role');
  if (role === 'searchbox' || role === 'textbox') return true;
  return false;
}

// ── mouseup 自动触发（auto 模式：分类 → 智能解释）──
document.addEventListener('mouseup', (e) => {
  if (tooltipDrag || Date.now() - tooltipDragEndedAt < 300) return;
  if (isInTooltip(e.target)) return;
  if (triggerMode !== 'auto') return;
  if (e.button !== 0) return; // 仅左键拖动选区触发，避免右键点击误触发

  clearTimeout(selectionDebounce);
  selectionDebounce = setTimeout(() => {
    if (isEditingElement()) return;
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (lastOutsideClosedText !== null) {
      const closedText = lastOutsideClosedText;
      lastOutsideClosedText = null;
      // 点击外部若是让选区折叠则 text 为空，本就不会重开；
      // 若页面阻止默认行为导致选区不变，则保持“已关闭”状态。
      if (!text || text === closedText) return;
    }
    if (!text) {
      return;
    }
    triggerWithStream({ text });
  }, 150);
});

// ── 接收来自 background（右键菜单）的消息 ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TRIGGER_EXPLAIN' && message.text) {
    const snapshot = contextMenuSelection?.text === message.text ? contextMenuSelection : null;
    contextMenuSelection = null;
    triggerWithStream({ text: message.text, snapshot });
  }
  if (message.type === 'TRIGGER_FULLPAGE_TRANSLATE') {
    safeSendMessage({ type: 'INJECT_FULLPAGE_TRANSLATE' });
  }
});

// 弹窗支持点击外部或按 Esc 关闭；点击/滚动弹窗内部不会误关闭。
// 鼠标移出、选区折叠仍不自动关闭，避免阅读长结果时被意外打断。
function isTooltipVisible() {
  return !!tooltip && tooltip.classList.contains('ds-visible');
}

function isEventInsideTooltip(e) {
  if (isInTooltip(e.target)) return true;
  return typeof e.composedPath === 'function' && e.composedPath().includes(tooltip);
}

// 记录本次“点击外部关闭”前选中的文本：若这次 mouseup 选区没有变化，
// 不再自动重新打开，避免页面阻止了默认行为时弹窗刚关又开。
let lastOutsideClosedText = null;

function clearSelectionDebounce() {
  if (selectionDebounce) {
    clearTimeout(selectionDebounce);
    selectionDebounce = null;
  }
}

function handleDocumentPointerDown(e) {
  if (e.button !== 0) return; // 仅左键/触摸主按键关闭，右键留给上下文菜单
  clearSelectionDebounce();
  lastOutsideClosedText = null; // 新的指针交互开始后，旧的抑制标记失效
  if (!isTooltipVisible()) return;
  if (isEventInsideTooltip(e)) return;

  lastOutsideClosedText = currentText;
  hideTooltip();
}

function handleDocumentKeyDown(e) {
  if (e.isComposing) return;
  if (e.key !== 'Escape') return;
  clearSelectionDebounce();
  if (!isTooltipVisible()) return;
  hideTooltip();
}

// 使用 pointerdown 捕获阶段：点击外部立刻关闭，同时不干扰弹窗内部按钮/复制/滚动操作。
document.addEventListener('pointerdown', handleDocumentPointerDown, true);
document.addEventListener('keydown', handleDocumentKeyDown, true);

window.addEventListener('scroll', scheduleTooltipPosition, { passive: true });
window.addEventListener('resize', scheduleTooltipPosition, { passive: true });
window.addEventListener('blur', endTooltipDrag);

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 网页助手：发现选中文字，创建结果浮层，显示回答，处理拖动、复制和下载。
// 网页选区 → selection.js 采集 → 本文件发消息 → background.js 请求 → markdown.js 显示。
// 先看 triggerWithStream，再看底部事件监听；函数写在前面，通常由事件触发。
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
// 第 4 行：准备 tooltip（结果浮层）：空值 null。
// 第 5 行：准备 currentText（当前选中的原文）：空值 null。
// 第 6 行：准备 currentSelection（当前选区快照）：空值 null。
// 第 7 行：准备 currentExplanation（当前完整回答）：空值 null。
// 第 8 行：准备 isLoading（是否正在等待回答）：否（false）。
// 第 9 行：准备 currentStreamPort（当前请求的通信连接）：空值 null。
// 第 10 行：准备 currentRenderers（当前的正文和思考显示器）：列表 []。
// 第 11 行：准备 scrollRaf（待执行的位置更新）：空值 null。
// 第 12 行：准备 tooltipAnchor（原文的定位锚点）：空值 null。
// 第 13 行：准备 tooltipFocusReturn（关闭时要恢复焦点的元素）：空值 null。
// 第 14 行：准备 tooltipManualPosition（拖动后的浮层位置）：空值 null。
// 第 15 行：准备 tooltipDrag（当前拖动记录）：空值 null。
// 第 16 行：准备 tooltipDragEndedAt（上次拖动结束时间）：0。
// 第 17 行：准备 downloadRequest（当前下载操作）：空值 null。
// 第 20 行：准备 triggerMode（划词触发方式）：“auto”。
// 第 21 行：准备 usePageContext（是否使用网页背景材料）：是（true）。
// 第 22 行：准备 selectionDebounce（划词延迟计时器）：空值 null。
// 第 23 行：准备 lastContextMenuPos（右键位置）：一组字段（x: 0、y: 0）。
// 第 24 行：准备 contextMenuSelection（右键时的选区快照）：空值 null。
// 第 27 行：定义函数 isRuntimeAlive：检查扩展通信环境是否仍有效；接收 无参数。
// 第 28 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；结束当前函数，并返回 不满足（不满足（chrome的runtime（存在时）的id））；捕获前面步骤的错误，按下面步骤处理；结束当前函数，并返回 否（false）。
// 第 29 行：结束前面的代码块、资料列表或函数调用。
// 第 30 行：定义函数 safeSendMessage：在扩展环境有效时发送消息；接收 收到的消息。
// 第 31 行：如果 不满足（检查扩展通信环境是否仍有效），结束当前函数，并返回 建立已完成任务或完成当前任务，结果为 无参数。
// 第 32 行：结束当前函数，并返回 在 向扩展发送消息 收到的消息 失败时执行处理函数。
// 第 33 行：结束前面的代码块、资料列表或函数调用。
// 第 34 行：定义函数 safeConnect：在扩展环境有效时建立连接；接收 名称。
// 第 35 行：如果 不满足（检查扩展通信环境是否仍有效），结束当前函数，并返回 空值 null。
// 第 36 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；结束当前函数，并返回 建立扩展通信连接 一组字段；捕获前面步骤的错误，按下面步骤处理；结束当前函数，并返回 空值 null。
// 第 37 行：结束前面的代码块、资料列表或函数调用。
// 第 39 行：定义函数 modeLabel：把模式字母换成显示名称；接收 处理模式。
// 第 40 行：结束当前函数，并返回 （一组字段（A: “翻译+解释”、B: “翻译”、C: “拓展解释”、D: “语境解读”）的第 [处理模式] 项 或 “智能解释”）。
// 第 41 行：结束前面的代码块、资料列表或函数调用。
// 第 47 行：定义函数 getTooltip：取得结果浮层，首次使用时创建它；接收 无参数。
// 第 48 行：如果 不满足（结果浮层），执行下面这一组步骤。
// 第 49 行：首次使用才创建浮层元素，后续复用。
// 第 50 行：结果浮层的id 改为 “deepseek-explain-tooltip”。
// 第 51 行：登记扩展界面根元素并设置品牌资源（结果浮层）。
// 第 52 行：结果浮层的inert 改为 是（true）。
// 第 53 行：把 结果浮层 的属性 “aria-hidden” 设为 “true”。
// 第 54 行：下面的多行文字是浮层 HTML 骨架，由浏览器创建界面。
// 第 55 行：创建 布局容器，样式标记 ds-header。
// 第 56 行：创建 行内文字或图标，样式标记 ds-drag-handle。
// 第 57 行：创建 行内文字或图标，样式标记 lc-brand-icon，初始隐藏，装饰图标不交给屏幕阅读器朗读；结束 行内文字或图标。
// 第 58 行：创建 矢量图标，初始隐藏，装饰图标不交给屏幕阅读器朗读；创建 图标圆形，坐标和尺寸决定图标形状；创建 图标圆形，坐标和尺寸决定图标形状；创建 图标圆形，坐标和尺寸决定图标形状；创建 图标圆形，坐标和尺寸决定图标形状；创建 图标圆形，坐标和尺寸决定图标形状；创建 图标圆形，坐标和尺寸决定图标形状；结束 矢量图标。
// 第 59 行：创建 行内文字或图标，样式标记 ds-brand；结束 行内文字或图标；显示文字“说文 · 解释”。
// 第 60 行：结束 行内文字或图标。
// 第 61 行：创建 操作按钮，样式标记 ds-close，辅助阅读名称“关闭结果”；结束 操作按钮；显示文字“×”。
// 第 62 行：结束 布局容器。
// 第 63 行：创建 布局容器，样式标记 ds-reasoning。
// 第 64 行：创建 布局容器，样式标记 ds-reasoning-title；结束 布局容器；显示文字“思考中…”。
// 第 65 行：创建 布局容器，样式标记 ds-reasoning-body；结束 布局容器。
// 第 66 行：结束 布局容器。
// 第 67 行：创建 布局容器，样式标记 ds-quote；结束 布局容器。
// 第 68 行：创建 布局容器，样式标记 ds-body；结束 布局容器。
// 第 69 行：创建 布局容器，样式标记 ds-actions。
// 第 70 行：创建 操作按钮，样式标记 ds-btn ds-btn-copy。
// 第 71 行：创建 行内文字或图标，样式标记 ds-btn-icon。
// 第 72 行：创建 矢量图标；创建 图标矩形，坐标和尺寸决定图标形状；结束 图标矩形；创建 图标的线条路径，坐标和尺寸决定图标形状；结束 图标的线条路径；结束 矢量图标。
// 第 73 行：结束 行内文字或图标。
// 第 74 行：创建 行内文字或图标，样式标记 ds-btn-label；结束 行内文字或图标；显示文字“复制”。
// 第 75 行：结束 操作按钮。
// 第 76 行：创建 操作按钮，样式标记 ds-btn ds-btn-download。
// 第 77 行：创建 行内文字或图标，样式标记 ds-btn-icon。
// 第 78 行：创建 矢量图标；创建 图标的线条路径，坐标和尺寸决定图标形状；结束 图标的线条路径；创建 图标折线，坐标和尺寸决定图标形状；结束 图标折线；创建 图标直线，坐标和尺寸决定图标形状；结束 图标直线；结束 矢量图标。
// 第 79 行：结束 行内文字或图标。
// 第 80 行：创建 行内文字或图标，样式标记 ds-btn-label；结束 行内文字或图标；显示文字“下载”。
// 第 81 行：结束 操作按钮。
// 第 82 行：结束 布局容器。
// 第 83 行：创建 布局容器，样式标记 ds-footer。
// 第 84 行：创建 行内文字或图标，样式标记 ds-model-tag；结束 行内文字或图标。
// 第 85 行：创建 行内文字或图标，样式标记 ds-powered；结束 行内文字或图标；显示文字“LingoClarify”。
// 第 86 行：结束 布局容器。
// 第 87 行：继续前一行的表达式；本行补充 `;。
// 第 88 行：关闭按钮点击时关闭浮层。
// 第 89 行：复制按钮点击时复制回答。
// 第 90 行：下载按钮点击时下载笔记。
// 第 91 行：准备 header：在 结果浮层 中找到首个匹配 “.ds-header” 的元素。
// 第 92 行：监听 header 的 “pointerdown” 事件，发生后执行处理函数。
// 第 93 行：监听 header 的 “pointermove” 事件，发生后执行处理函数。
// 第 94 行：监听 header 的 “pointerup” 事件，发生后执行处理函数。
// 第 95 行：监听 header 的 “pointercancel” 事件，发生后执行处理函数。
// 第 96 行：监听 header 的 “lostpointercapture” 事件，发生后执行处理函数。
// 第 97 行：把 结果浮层 放到 document的body 内部末尾。
// 第 98 行：开始观察 结果浮层 的变化。
// 第 99 行：结束前面的代码块、资料列表或函数调用。
// 第 100 行：结束当前函数，并返回 结果浮层。
// 第 101 行：结束前面的代码块、资料列表或函数调用。
// 第 107 行：定义函数 getSelectionDocCoords：取得原文选区在整页中的坐标；接收 原文选区的位置对象，未传入时用 当前选区快照（存在时）的range。
// 第 108 行：选区起止节点已离开页面，或位于浮层内部时，不作为原文锚点。
// 第 109 行：结束当前函数，并返回 空值 null。
// 第 110 行：准备 rect：取得元素或选区相对窗口的矩形位置。
// 第 111 行：如果 （不满足（rect） 或 （（rect的width 等于 0） 且 （rect的height 等于 0））），结束当前函数，并返回 空值 null。
// 第 112 行：结束当前函数，并返回 一组字段（left: （rect的left 加上或拼接 window的scrollX）、bottom: （rect的bottom 加上或拼接 window的scrollY）、right: （rect的right 加上或拼接 window的scrollX）、top: （rect的top 加上或拼接 window的scrollY））。
// 第 113 行：left 字段设为 （rect的left 加上或拼接 window的scrollX）。
// 第 114 行：bottom 字段设为 （rect的bottom 加上或拼接 window的scrollY）。
// 第 115 行：right 字段设为 （rect的right 加上或拼接 window的scrollX）。
// 第 116 行：top 字段设为 （rect的top 加上或拼接 window的scrollY）。
// 第 117 行：结束前面的代码块、资料列表或函数调用。
// 第 118 行：结束前面的代码块、资料列表或函数调用。
// 第 120 行：定义函数 positionTooltip：定位浮层并限制在窗口范围内；接收 docCoords。
// 第 121 行：准备 el（当前界面元素）：取得结果浮层，首次使用时创建它。
// 第 122 行：从 当前界面元素的classList 移除样式标记或元素 “ds-hidden”。
// 第 123 行：将 “ds-visible” 加到 当前界面元素的classList。
// 第 124 行：当前界面元素的inert 改为 否（false）。
// 第 125 行：把 当前界面元素 的属性 “aria-hidden” 设为 “false”。
// 第 126 行：当前界面元素的style的display 改为 “flex”。
// 第 127 行：设置样式属性 “--ds-viewport-height” 为 拼接文字和变量（window的innerHeight）。
// 第 129 行：准备 gap：10。
// 第 130 行：准备 width：window的innerWidth；准备 height：window的innerHeight。
// 第 131 行：删除样式属性 “--ds-placement-height”。
// 第 132 行：准备 rect：取得元素或选区相对窗口的矩形位置。
// 第 133 行：定义工具 clampX：小函数，接收 x；返回 取 gap、取 x、（（width 减去 gap） 减去 rect的width） 的较小值 的较大值。
// 第 134 行：定义工具 clampY：小函数，接收 y；返回 取 gap、取 y、（（height 减去 gap） 减去 rect的height） 的较小值 的较大值。
// 第 135 行：准备 left（左侧坐标或上文预算），暂不赋值；准备 top（顶部坐标或垂直滚动位置），暂不赋值。
// 第 136 行：拖动后的手动位置优先使用，并限制在窗口范围内。
// 第 137 行：左侧坐标或上文预算 改为 限制水平坐标不越界（拖动后的浮层位置的左侧坐标或上文预算）。
// 第 138 行：顶部坐标或垂直滚动位置 改为 限制垂直坐标不越界（拖动后的浮层位置的顶部坐标或垂直滚动位置）。
// 第 139 行：拖动后的浮层位置 改为 一组字段（left、top）。
// 第 140 行：前一个条件不成立时，进入这个备用分支。
// 第 141 行：把原文整页坐标换成窗口坐标，便于判断周围空间。
// 第 142 行：top 字段设为 （docCoords的top 减去 scrollY）；bottom 字段设为 （docCoords的bottom 减去 scrollY）。
// 第 143 行：准备 alignedX：限制水平坐标不越界（原文或累计 Markdown的左侧坐标或上文预算）。
// 第 144 行：准备 alignedY：限制垂直坐标不越界（原文或累计 Markdown的顶部坐标或垂直滚动位置）。
// 第 145 行：尝试原文下方、上方、右方、左方四个位置。
// 第 146 行：left 字段设为 alignedX；top 字段设为 （原文或累计 Markdown的bottom 加上或拼接 gap）。
// 第 147 行：left 字段设为 alignedX；top 字段设为 （（原文或累计 Markdown的top 减去 gap） 减去 rect的height）。
// 第 148 行：left 字段设为 （原文或累计 Markdown的right 加上或拼接 gap）；top 字段设为 alignedY。
// 第 149 行：left 字段设为 （（原文或累计 Markdown的left 减去 gap） 减去 rect的width）；top 字段设为 alignedY。
// 第 150 行：结束前面的代码块、资料列表或函数调用。
// 第 151 行：候选位置必须整块放在窗口留边范围内。
// 第 152 行：继续检查浮层右侧和底部不越界。
// 第 153 行：准备 placement：从 candidates 找首个满足 fits 的项。
// 第 154 行：如果 不满足（placement），执行下面这一组步骤。
// 第 156 行：上下都放不下时，计算原文下方还能使用的高度。
// 第 157 行：计算原文上方还能使用的高度。
// 第 158 行：选择上下较大的空闲高度。
// 第 159 行：如果 （可用字符数或空间 大于 0），执行下面这一组步骤。
// 第 160 行：设置样式属性 “--ds-placement-height” 为 拼接文字和变量（可用字符数或空间）。
// 第 161 行：rect 改为 取得元素或选区相对窗口的矩形位置。
// 第 162 行：限制浮层高度后，放在空间更充足的一侧。
// 第 163 行：前一个条件不成立时，进入这个备用分支。
// 第 165 行：原文占满窗口时保留顶部拖动区域可接近。
// 第 166 行：结束前面的代码块、资料列表或函数调用。
// 第 167 行：结束前面的代码块、资料列表或函数调用。
// 第 168 行：左侧坐标或上文预算 改为 限制水平坐标不越界（placement的左侧坐标或上文预算）。
// 第 169 行：顶部坐标或垂直滚动位置 改为 限制垂直坐标不越界（placement的顶部坐标或垂直滚动位置）。
// 第 170 行：结束前面的代码块、资料列表或函数调用。
// 第 171 行：当前界面元素的style的left 改为 拼接文字和变量（（左侧坐标或上文预算 加上或拼接 scrollX））。
// 第 172 行：当前界面元素的style的top 改为 拼接文字和变量（（顶部坐标或垂直滚动位置 加上或拼接 scrollY））。
// 第 173 行：结束前面的代码块、资料列表或函数调用。
// 第 175 行：定义函数 startTooltipDrag：记录拖动起点并捕获指针；接收 当前事件。
// 第 176 行：只允许主指针左键在非关闭按钮区域开始拖动。
// 第 177 行：准备 rect：取得元素或选区相对窗口的矩形位置。
// 第 178 行：准备 captureTarget：（向上寻找匹配 “.ds-drag-handle” 的最近元素 或 当前事件的currentTarget）。
// 第 179 行：保存指针编号、起点、浮层初始位置和捕获目标。
// 第 180 行：捕获指针 当前事件的pointerId，移出标题后仍能接收拖动事件。
// 第 181 行：将 “ds-dragging” 加到 结果浮层的classList。
// 第 183 行：阻止浏览器对这次事件执行默认动作。
// 第 184 行：结束前面的代码块、资料列表或函数调用。
// 第 186 行：定义函数 moveTooltipDrag：按指针移动量调整浮层；接收 当前事件。
// 第 187 行：如果 （不满足（当前拖动记录） 或 （当前拖动记录的id 不等于 当前事件的pointerId）），立即结束当前函数，不继续执行下面步骤。
// 第 188 行：准备 dx：（当前事件的clientX 减去 当前拖动记录的x）；准备 dy：（当前事件的clientY 减去 当前拖动记录的y）。
// 第 189 行：移动不足 3 像素时先不判作实际拖动。
// 第 190 行：当前拖动记录的moved 改为 是（true）。
// 第 191 行：拖动后的浮层位置 改为 一组字段（left: （当前拖动记录的left 加上或拼接 dx）、top: （当前拖动记录的top 加上或拼接 dy））。
// 第 192 行：定位浮层并限制在窗口范围内（原文的定位锚点）。
// 第 193 行：结束前面的代码块、资料列表或函数调用。
// 第 195 行：定义函数 endTooltipDrag：结束拖动并释放指针；接收 无参数。
// 第 196 行：如果 不满足（当前拖动记录），立即结束当前函数，不继续执行下面步骤。
// 第 197 行：准备 drag：当前拖动记录。
// 第 198 行：当前拖动记录 改为 空值 null。
// 第 199 行：从 结果浮层的classList 移除样式标记或元素 “ds-dragging”。
// 第 200 行：如果 drag的moved，上次拖动结束时间 改为 取得当前时间的毫秒数。
// 第 201 行：如果 检查是否仍捕获指针 drag的标识，释放指针 drag的标识。
// 第 202 行：结束前面的代码块、资料列表或函数调用。
// 第 205 行：定义函数 scheduleTooltipPosition：安排下一帧更新浮层位置；接收 无参数。
// 第 206 行：如果 （不满足（检查浮层是否处于可见状态） 或 待执行的位置更新），立即结束当前函数，不继续执行下面步骤。
// 第 207 行：待执行的位置更新 改为 安排下一次屏幕刷新时执行函数。
// 第 208 行：待执行的位置更新 改为 空值 null。
// 第 209 行：如果 不满足（检查浮层是否处于可见状态），立即结束当前函数，不继续执行下面步骤。
// 第 210 行：原文的定位锚点 改为 （取得原文选区在整页中的坐标 或 原文的定位锚点）。
// 第 211 行：如果 原文的定位锚点，定位浮层并限制在窗口范围内（原文的定位锚点）。
// 第 212 行：结束前面的代码块、资料列表或函数调用。
// 第 213 行：结束前面的代码块、资料列表或函数调用。
// 第 215 行：定义函数 hideTooltip：关闭浮层并清理请求和状态；接收 无参数。
// 第 216 行：如果 不满足（结果浮层），立即结束当前函数，不继续执行下面步骤。
// 第 217 行：断开旧请求并取消显示任务。
// 第 218 行：如果 待执行的位置更新，取消动画帧任务 待执行的位置更新。
// 第 219 行：待执行的位置更新 改为 空值 null。
// 第 220 行：结束拖动并释放指针。
// 第 221 行：如果 检查 结果浮层 是否包含 document的activeElement，执行下面这一组步骤。
// 第 222 行：让 document的activeElement 失去焦点。
// 第 223 行：关闭时若焦点位于浮层内，尽可能回到此前的网页元素。
// 第 224 行：结束前面的代码块、资料列表或函数调用。
// 第 225 行：结果浮层的inert 改为 是（true）。
// 第 226 行：把 结果浮层 的属性 “aria-hidden” 设为 “true”。
// 第 227 行：将 “ds-hidden” 加到 结果浮层的classList。
// 第 228 行：从 结果浮层的classList 移除样式标记或元素 “ds-visible”。
// 第 229 行：重置下载按钮和计时器。
// 第 230 行：原文的定位锚点 改为 空值 null。
// 第 231 行：拖动后的浮层位置 改为 空值 null。
// 第 232 行：关闭时要恢复焦点的元素 改为 空值 null。
// 第 233 行：当前选中的原文 改为 空值 null。
// 第 234 行：当前选区快照 改为 空值 null。
// 第 235 行：当前完整回答 改为 空值 null。
// 第 236 行：是否正在等待回答 改为 否（false）。
// 第 237 行：结束前面的代码块、资料列表或函数调用。
// 第 243 行：定义函数 abortStream：断开旧请求并取消显示任务；接收 无参数。
// 第 244 行：如果 当前请求的通信连接，执行下面这一组步骤。
// 第 245 行：准备 port（与后台通信的连接）：当前请求的通信连接。
// 第 246 行：当前请求的通信连接 改为 空值 null。
// 第 247 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 与后台通信的连接；捕获前面步骤的错误，按下面步骤处理。
// 第 248 行：结束前面的代码块、资料列表或函数调用。
// 第 249 行：逐项读取 当前的正文和思考显示器，当前项记作 renderer，执行下面步骤。
// 第 250 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；取消 renderer，停止读取或更新；捕获前面步骤的错误，按下面步骤处理。
// 第 251 行：结束前面的代码块、资料列表或函数调用。
// 第 252 行：当前的正文和思考显示器 改为 列表 []。
// 第 253 行：结束前面的代码块、资料列表或函数调用。
// 第 255 行：定义函数 showStreamFailure：结束请求并显示错误；接收 当前界面元素、错误。
// 第 256 行：断开旧请求并取消显示任务。
// 第 257 行：是否正在等待回答 改为 否（false）。
// 第 258 行：当前完整回答 改为 空值 null。
// 第 259 行：在 当前界面元素 中找到首个匹配 ".ds-reasoning" 的元素的style的display 改为 “none”。
// 第 260 行：准备 body（请求内容或正文元素）：在 当前界面元素 中找到首个匹配 “.ds-body” 的元素。
// 第 261 行：从 请求内容或正文元素的classList 移除样式标记或元素 “ds-streaming”。
// 第 262 行：请求内容或正文元素的innerHTML 改为 拼接文字和变量（把文字转成不会被当作 HTML 执行的形式（错误））。
// 第 263 行：在 当前界面元素 中找到首个匹配 ".ds-actions" 的元素的style的display 改为 “none”。
// 第 264 行：在 当前界面元素 中找到首个匹配 “.ds-model-tag” 的元素的textContent 改为 “”。
// 第 265 行：结束前面的代码块、资料列表或函数调用。
// 第 269 行：准备 MAX_CHARS_PER_FRAME（每帧最多显示的字符数）：2048。
// 第 271 行：定义函数 createStreamingTextRenderer：创建分帧显示思考文字的工具；接收 显示内容的容器。
// 第 272 行：准备 textNode：创建内容为 “” 的文字节点。
// 第 273 行：显示内容的容器的textContent 改为 “”。
// 第 274 行：把 textNode 放到 显示内容的容器 内部末尾。
// 第 276 行：准备 pending（待显示的文字或待完成的任务）：“”。
// 第 277 行：准备 rafId（动画帧编号）：0。
// 第 279 行：定义工具 schedule：小函数，接收 无参数；具体步骤见下面各行。
// 第 280 行：如果 （不满足（动画帧编号） 且 待显示的文字或待完成的任务），动画帧编号 改为 安排下一次屏幕刷新时执行函数。
// 第 281 行：结束前面的代码块、资料列表或函数调用。
// 第 283 行：定义函数 step：在一帧内显示一部分待播放文字；接收 无参数。
// 第 284 行：动画帧编号 改为 0。
// 第 285 行：如果 不满足（待显示的文字或待完成的任务），执行下面这一组步骤。
// 第 286 行：立即结束当前函数，不继续执行下面步骤。
// 第 287 行：结束前面的代码块、资料列表或函数调用。
// 第 290 行：准备 adaptive：取 1、把 （待显示的文字或待完成的任务的length 除以 12） 向上取整 的较大值。
// 第 291 行：准备 take：取 待显示的文字或待完成的任务的length、每帧最多显示的字符数、adaptive 的较小值。
// 第 292 行：在文字节点末尾追加 slice的结果。
// 第 293 行：待显示的文字或待完成的任务 改为 截取 待显示的文字或待完成的任务，范围参数为 take。
// 第 295 行：如果 待显示的文字或待完成的任务，安排下一帧文字显示。
// 第 296 行：结束前面的代码块、资料列表或函数调用。
// 第 298 行：结束当前函数，并返回 一组字段（push 方法、cancel 方法）。
// 第 299 行：定义 对象方法 push，内部步骤见后续各行。
// 第 300 行：如果 不满足（chunk），立即结束当前函数，不继续执行下面步骤。
// 第 301 行：待显示的文字或待完成的任务 累加或追加 chunk。
// 第 302 行：安排下一帧文字显示。
// 第 303 行：结束前面的代码块、资料列表或函数调用。
// 第 304 行：定义 对象方法 cancel，内部步骤见后续各行。
// 第 305 行：如果 动画帧编号，取消动画帧任务 动画帧编号。
// 第 306 行：动画帧编号 改为 0。
// 第 307 行：待显示的文字或待完成的任务 改为 “”。
// 第 308 行：结束前面的代码块、资料列表或函数调用。
// 第 309 行：结束前面的代码块、资料列表或函数调用。
// 第 310 行：结束前面的代码块、资料列表或函数调用。
// 第 316 行：定义异步函数 triggerWithStream：启动一次划词请求并处理返回消息；接收 字段 text、mode、popupTitle、snapshot。
// 第 317 行：空白选区不请求。
// 第 318 行：没有快照就从浏览器当前选区采集。
// 第 319 行：没有指定模式就使用本地分析模式。
// 第 320 行：popupTitle 原值为空或为否时改为 拼接文字和变量（把模式字母换成显示名称（处理模式））。
// 第 321 行：同一选区已有可见且无错误的结果时不重复请求。
// 第 324 行：断开旧请求并取消显示任务。
// 第 325 行：当前选中的原文 改为 文字。
// 第 326 行：当前选区快照 改为 保存的快照。
// 第 327 行：是否正在等待回答 改为 是（true）。
// 第 328 行：当前完整回答 改为 空值 null。
// 第 330 行：优先用真实原文坐标；没有位置时用保存的右键坐标。
// 第 331 行：left 字段设为 右键位置的x。
// 第 332 行：bottom 字段设为 右键位置的y。
// 第 333 行：right 字段设为 右键位置的x。
// 第 334 行：top 字段设为 右键位置的y。
// 第 335 行：结束前面的代码块、资料列表或函数调用。
// 第 337 行：准备 el（当前界面元素）：取得结果浮层，首次使用时创建它。
// 第 338 行：如果 不满足（检查 当前界面元素 是否包含 document的activeElement），关闭时要恢复焦点的元素 改为 document的activeElement。
// 第 339 行：原文的定位锚点 改为 coords。
// 第 340 行：结束拖动并释放指针。
// 第 341 行：拖动后的浮层位置 改为 空值 null。
// 第 342 行：重置下载按钮和计时器。
// 第 343 行：准备 bodyEl：在 当前界面元素 中找到首个匹配 “.ds-body” 的元素。
// 第 344 行：准备 reasoningEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning” 的元素。
// 第 345 行：准备 reasoningTitleEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning-title” 的元素。
// 第 346 行：准备 reasoningBodyEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning-body” 的元素。
// 第 348 行：在 当前界面元素 中找到首个匹配 “.ds-brand” 的元素的textContent 改为 popupTitle。
// 第 349 行：在 当前界面元素 中找到首个匹配 “.ds-quote” 的元素的textContent 改为 把过长文字截短并加省略号（文字、80）。
// 第 350 行：将 “ds-streaming” 加到 bodyEl的classList。
// 第 351 行：reasoningEl的style的display 改为 “none”。
// 第 352 行：reasoningTitleEl的textContent 改为 “思考中…”。
// 第 353 行：在 当前界面元素 中找到首个匹配 ".ds-actions" 的元素的style的display 改为 “none”。
// 第 354 行：在 当前界面元素 中找到首个匹配 “.ds-model-tag” 的元素的textContent 改为 “”。
// 第 356 行：准备 bodyRenderer：创建节流更新 Markdown 的工具（bodyEl）。
// 第 357 行：准备 reasoningRenderer：创建分帧显示思考文字的工具（reasoningBodyEl）。
// 第 358 行：当前的正文和思考显示器 改为 列表 [bodyRenderer、reasoningRenderer]。
// 第 359 行：准备 buffer（暂存的文字）：“”。
// 第 360 行：准备 hasReasoning（是否收到过思考文字）：否（false）。
// 第 361 行：准备 hasContent（是否收到过正文）：否（false）。
// 第 363 行：定位浮层并限制在窗口范围内（coords）。
// 第 366 行：准备 port（与后台通信的连接）：在扩展环境有效时建立连接（拼接文字和变量（取得当前时间的毫秒数））。
// 第 367 行：旧网页的扩展环境已失效时，停止显示并提示刷新网页。
// 第 368 行：是否正在等待回答 改为 否（false）。
// 第 369 行：取消 bodyRenderer，停止读取或更新。
// 第 370 行：从 bodyEl的classList 移除样式标记或元素 “ds-streaming”。
// 第 371 行：bodyEl的innerHTML 改为 “<span class="ds-error">扩展已重载，请刷新页面后重试</span>”。
// 第 372 行：立即结束当前函数，不继续执行下面步骤。
// 第 373 行：结束前面的代码块、资料列表或函数调用。
// 第 374 行：当前请求的通信连接 改为 与后台通信的连接。
// 第 376 行：登记 与后台通信的连接的onMessage 的监听函数，收到通知时执行下面的处理。
// 第 377 行：旧请求的回调不允许修改新请求的浮层。
// 第 378 行：如果 （收到的消息的type 等于 “reasoning-token”），执行下面这一组步骤。
// 第 379 行：是否收到过思考文字 改为 是（true）。
// 第 380 行：reasoningEl的style的display 改为 “block”。
// 第 381 行：把 收到的消息的token 加到 reasoningRenderer 末尾。
// 第 382 行：开始处理正文片段；首次正文到达时更新思考区标题。
// 第 383 行：如果 不满足（是否收到过正文），执行下面这一组步骤。
// 第 384 行：是否收到过正文 改为 是（true）。
// 第 385 行：如果 是否收到过思考文字，reasoningTitleEl的textContent 改为 “思考过程”。
// 第 386 行：结束前面的代码块、资料列表或函数调用。
// 第 387 行：暂存的文字 累加或追加 收到的消息的token。
// 第 388 行：把 收到的消息的token 加到 bodyRenderer 末尾。
// 第 389 行：如果 （收到的消息的type 等于 “done”），执行下面这一组步骤。
// 第 390 行：是否正在等待回答 改为 否（false）。
// 第 391 行：当前完整回答 改为 暂存的文字。
// 第 392 行：完成时保存回答全文，并立即渲染最终 Markdown。
// 第 393 行：从 bodyEl的classList 移除样式标记或元素 “ds-streaming”。
// 第 394 行：在 当前界面元素 中找到首个匹配 ".ds-actions" 的元素的style的display 改为 “flex”。
// 第 395 行：在 当前界面元素 中找到首个匹配 “.ds-model-tag” 的元素的textContent 改为 （收到的消息的model 或 “”）。
// 第 397 行：翻译模式完成后可显示“解释此句”按钮。
// 第 398 行：当前请求的通信连接 改为 空值 null。
// 第 399 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 与后台通信的连接；捕获前面步骤的错误，按下面步骤处理。
// 第 400 行：如果 （收到的消息的type 等于 “error”），执行下面这一组步骤。
// 第 401 行：结束请求并显示错误（当前界面元素、收到的消息的错误）。
// 第 402 行：结束前面的代码块、资料列表或函数调用。
// 第 403 行：结束前面的代码块、资料列表或函数调用。
// 第 405 行：登记 与后台通信的连接的onDisconnect 的监听函数，收到通知时执行下面的处理。
// 第 407 行：如果 （当前请求的通信连接 不等于 与后台通信的连接），立即结束当前函数，不继续执行下面步骤。
// 第 408 行：当前请求的通信连接 改为 空值 null。
// 第 409 行：如果 是否正在等待回答，执行下面这一组步骤。
// 第 410 行：结束请求并显示错误（当前界面元素、“⚠️ 连接中断，请重试”）。
// 第 411 行：结束前面的代码块、资料列表或函数调用。
// 第 412 行：结束前面的代码块、资料列表或函数调用。
// 第 415 行：按上下文偏好决定是否传送采集到的背景材料。
// 第 416 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；通过 与后台通信的连接 发出消息 一组字段。
// 第 417 行：type 字段设为 “STREAM_REQUEST”。
// 第 418 行：mode 字段沿用同名值。
// 第 419 行：text 字段沿用同名值。
// 第 420 行：context 字段沿用同名值。
// 第 421 行：analysis 字段设为 保存的快照的analysis。
// 第 422 行：捕获前面步骤的错误，按下面步骤处理；结束请求并显示错误（当前界面元素、“⚠️ 连接中断，请重试”）。
// 第 423 行：结束前面的代码块、资料列表或函数调用。
// 第 429 行：定义函数 truncate：把过长文字截短并加省略号；接收 文字、max。
// 第 430 行：结束当前函数，并返回 若 （文字的length 大于 max），用 （截取 文字，范围参数为 0、max 加上或拼接 “…”）；否则用 文字。
// 第 431 行：结束前面的代码块、资料列表或函数调用。
// 第 433 行：定义函数 escapeHtml：把文字转成不会被当作 HTML 执行的形式；接收 str。
// 第 434 行：准备 div：创建 “div” 元素。
// 第 435 行：div的textContent 改为 str。
// 第 436 行：结束当前函数，并返回 div的innerHTML。
// 第 437 行：结束前面的代码块、资料列表或函数调用。
// 第 439 行：定义函数 isInTooltip：检查节点是否位于浮层内；接收 网页节点。
// 第 440 行：结束当前函数，并返回 （结果浮层 且 检查 结果浮层 是否包含 网页节点）。
// 第 441 行：结束前面的代码块、资料列表或函数调用。
// 第 447 行：定义函数 getPageContext：取得当前选区的背景材料；接收 无参数。
// 第 448 行：结束当前函数，并返回 （当前选区快照（存在时）的context 或 空值 null）。
// 第 449 行：结束前面的代码块、资料列表或函数调用。
// 第 455 行：定义异步函数 handleCopy：复制回答；接收 当前事件。
// 第 456 行：阻止这次事件继续向外层传播。
// 第 457 行：如果 不满足（当前完整回答），立即结束当前函数，不继续执行下面步骤。
// 第 458 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 459 行：把完整 Markdown 原文写入剪贴板。
// 第 460 行：准备 btn（操作按钮）：在 结果浮层 中找到首个匹配 “.ds-btn-copy .ds-btn-label” 的元素。
// 第 461 行：准备 original：操作按钮的textContent。
// 第 462 行：操作按钮的textContent 改为 “已复制”。
// 第 463 行：操作按钮的style的color 改为 “var(--lc-success)”。
// 第 464 行：短暂显示“已复制”，1.5 秒后恢复按钮文字和颜色。
// 第 465 行：捕获前面步骤的错误，按下面步骤处理。
// 第 466 行：剪贴板接口失败时用临时文本框走旧式复制路径。
// 第 467 行：ta的value 改为 当前完整回答。
// 第 468 行：ta的style的position 改为 “fixed”。
// 第 469 行：ta的style的left 改为 “-9999px”。
// 第 470 行：把 ta 放到 document的body 内部末尾。
// 第 471 行：调用 select（所属对象：ta）。
// 第 472 行：执行旧式浏览器命令 “copy”。
// 第 473 行：从 document的body 移除 ta。
// 第 474 行：结束前面的代码块、资料列表或函数调用。
// 第 475 行：结束前面的代码块、资料列表或函数调用。
// 第 477 行：定义函数 resetDownloadAction：重置下载按钮和计时器；接收 无参数。
// 第 478 行：取消计时器 当前下载操作的延迟计时器。
// 第 479 行：当前下载操作 改为 空值 null。
// 第 480 行：准备 button：在 结果浮层 中找到首个匹配 “.ds-btn-download” 的元素。
// 第 481 行：如果 不满足（button），立即结束当前函数，不继续执行下面步骤。
// 第 482 行：button的disabled 改为 否（false）。
// 第 483 行：在 button 中找到首个匹配 “.ds-btn-label” 的元素的textContent 改为 “下载”。
// 第 484 行：在 button 中找到首个匹配 ".ds-btn-label" 的元素的style的color 改为 “”。
// 第 485 行：结束前面的代码块、资料列表或函数调用。
// 第 487 行：定义异步函数 handleDownload：处理笔记下载；接收 当前事件。
// 第 488 行：阻止这次事件继续向外层传播。
// 第 489 行：没有原文、没有回答，或已有下载进行中时，不重复下载。
// 第 490 行：重置下载按钮和计时器。
// 第 491 行：准备 request：一组字段（pending: 是（true）、timer: 空值 null）。
// 第 492 行：当前下载操作 改为 request。
// 第 493 行：准备 button：在 结果浮层 中找到首个匹配 “.ds-btn-download” 的元素。
// 第 494 行：准备 label：在 button 中找到首个匹配 “.ds-btn-label” 的元素。
// 第 495 行：button的disabled 改为 是（true）。
// 第 496 行：label的textContent 改为 “下载中…”。
// 第 497 行：准备 timeout（超时计时器），暂不赋值。
// 第 498 行：等待后台下载回复；15 秒没有回复时结束等待。
// 第 499 行：type 字段设为 “DOWNLOAD”；text 字段设为 当前选中的原文；explanation 字段设为 当前完整回答。
// 第 500 行：超时计时器 改为 延迟 15000 毫秒后执行函数。
// 第 501 行：结束前面的代码块、资料列表或函数调用。
// 第 502 行：取消计时器 超时计时器。
// 第 503 行：当前结果已被另一操作替换时，忽略旧下载回复。
// 第 504 行：request的pending 改为 否（false）。
// 第 505 行：button的disabled 改为 否（false）。
// 第 506 行：只有后台回复 ok 才显示“已开始下载”，失败时允许重试。
// 第 507 行：label的style的color 改为 若 处理结果（存在时）的ok，用 “var(--lc-success)”；否则用 “var(--lc-error)”。
// 第 508 行：如果 处理结果（存在时）的ok，request的timer 改为 延迟 1500 毫秒后执行函数。
// 第 509 行：如果 （当前下载操作 等于 request），重置下载按钮和计时器。
// 第 510 行：继续前一行的表达式；本行补充 }, 1500);。
// 第 511 行：结束前面的代码块、资料列表或函数调用。
// 第 514 行：定义附加操作：只给模式 B 的译文增加解释此句入口。
// 第 516 行：准备 oldBtn：在 结果浮层 中找到首个匹配 “.ds-btn-explain-this” 的元素。
// 第 517 行：如果 oldBtn，从 oldBtn 移除样式标记或元素 。
// 第 519 行：如果 （处理模式 不等于 “B”），立即结束当前函数，不继续执行下面步骤。
// 第 521 行：准备 btn（操作按钮）：创建 “button” 元素。
// 第 522 行：操作按钮的className 改为 “ds-btn ds-btn-explain-this”。
// 第 523 行：操作按钮的title 改为 “结合上下文解释这句话的含义”。
// 第 524 行：操作按钮的innerHTML 改为 文字“ <span class="ds-btn-icon"> <svg width="14" height="14" viewBox="0 0 2”。
// 第 525 行：创建 行内文字或图标，样式标记 ds-btn-icon。
// 第 526 行：创建 矢量图标；创建 图标圆形，坐标和尺寸决定图标形状；结束 图标圆形；创建 图标直线，坐标和尺寸决定图标形状；结束 图标直线；创建 图标直线，坐标和尺寸决定图标形状；结束 图标直线；结束 矢量图标。
// 第 527 行：结束 行内文字或图标。
// 第 528 行：创建 行内文字或图标，样式标记 ds-btn-label；结束 行内文字或图标；显示文字“解释此句`;”。
// 第 529 行：监听 操作按钮 的 “click” 事件，发生后执行处理函数。
// 第 530 行：监听 操作按钮 的 “mousedown” 事件，发生后执行处理函数；阻止这次事件继续向外层传播。
// 第 531 行：把 操作按钮 放到 在 结果浮层 中找到首个匹配 “.ds-actions” 的元素 内部末尾。
// 第 532 行：结束前面的代码块、资料列表或函数调用。
// 第 534 行：定义异步函数 handleExplainThis：再次解释当前原文；接收 当前事件。
// 第 535 行：阻止这次事件继续向外层传播。
// 第 536 行：阻止浏览器对这次事件执行默认动作。
// 第 538 行：准备 btn（操作按钮）：当前事件的currentTarget。
// 第 540 行：先备份原文，防止等待期间当前选区被清空。
// 第 541 行：如果 不满足（textToExplain），执行下面这一组步骤。
// 第 542 行：在 操作按钮 中找到首个匹配 “.ds-btn-label” 的元素的textContent 改为 “无文本”。
// 第 543 行：立即结束当前函数，不继续执行下面步骤。
// 第 544 行：结束前面的代码块、资料列表或函数调用。
// 第 546 行：操作按钮的disabled 改为 是（true）。
// 第 547 行：在 操作按钮 中找到首个匹配 “.ds-btn-label” 的元素的textContent 改为 “解释中…”。
// 第 549 行：断开旧请求并取消显示任务。
// 第 550 行：是否正在等待回答 改为 是（true）。
// 第 551 行：当前完整回答 改为 空值 null。
// 第 554 行：准备 el（当前界面元素）：取得结果浮层，首次使用时创建它。
// 第 555 行：在 当前界面元素 中找到首个匹配 “.ds-brand” 的元素的textContent 改为 拼接文字和变量（把模式字母换成显示名称（“D”））。
// 第 556 行：将 “ds-visible” 加到 当前界面元素的classList。
// 第 557 行：从 当前界面元素的classList 移除样式标记或元素 “ds-hidden”。
// 第 558 行：当前界面元素的style的display 改为 “flex”。
// 第 559 行：当前界面元素的inert 改为 否（false）。
// 第 560 行：把 当前界面元素 的属性 “aria-hidden” 设为 “false”。
// 第 561 行：重置下载按钮和计时器。
// 第 562 行：在 当前界面元素 中找到首个匹配 ".ds-actions" 的元素的style的display 改为 “none”。
// 第 563 行：在 当前界面元素 中找到首个匹配 “.ds-model-tag” 的元素的textContent 改为 “”。
// 第 565 行：准备 port（与后台通信的连接）：在扩展环境有效时建立连接（拼接文字和变量（取得当前时间的毫秒数））。
// 第 566 行：如果 不满足（与后台通信的连接），执行下面这一组步骤。
// 第 567 行：结束请求并显示错误（当前界面元素、“扩展已重载，请刷新页面后重试”）。
// 第 568 行：立即结束当前函数，不继续执行下面步骤。
// 第 569 行：结束前面的代码块、资料列表或函数调用。
// 第 570 行：当前请求的通信连接 改为 与后台通信的连接。
// 第 572 行：准备 bodyEl：在 当前界面元素 中找到首个匹配 “.ds-body” 的元素。
// 第 573 行：准备 reasoningEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning” 的元素。
// 第 574 行：准备 reasoningTitleEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning-title” 的元素。
// 第 575 行：准备 reasoningBodyEl：在 当前界面元素 中找到首个匹配 “.ds-reasoning-body” 的元素。
// 第 577 行：将 “ds-streaming” 加到 bodyEl的classList。
// 第 578 行：reasoningEl的style的display 改为 “none”。
// 第 579 行：reasoningTitleEl的textContent 改为 “思考中…”。
// 第 580 行：准备 bodyRenderer：创建节流更新 Markdown 的工具（bodyEl）。
// 第 581 行：准备 reasoningRenderer：创建分帧显示思考文字的工具（reasoningBodyEl）。
// 第 582 行：当前的正文和思考显示器 改为 列表 [bodyRenderer、reasoningRenderer]。
// 第 583 行：准备 buffer（暂存的文字）：“”。
// 第 584 行：准备 hasReasoning（是否收到过思考文字）：否（false）。
// 第 586 行：定义工具 cleanup：小函数，接收 无参数；具体步骤见下面各行。
// 第 587 行：是否正在等待回答 改为 否（false）。
// 第 588 行：从 bodyEl的classList 移除样式标记或元素 “ds-streaming”。
// 第 589 行：从 操作按钮 移除样式标记或元素 。
// 第 590 行：当前请求的通信连接 改为 空值 null。
// 第 591 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；断开 与后台通信的连接；捕获前面步骤的错误，按下面步骤处理。
// 第 592 行：结束前面的代码块、资料列表或函数调用。
// 第 594 行：登记 与后台通信的连接的onMessage 的监听函数，收到通知时执行下面的处理。
// 第 595 行：如果 （当前请求的通信连接 不等于 与后台通信的连接），立即结束当前函数，不继续执行下面步骤。
// 第 596 行：如果 （收到的消息的type 等于 “reasoning-token”），执行下面这一组步骤。
// 第 597 行：是否收到过思考文字 改为 是（true）。
// 第 598 行：reasoningEl的style的display 改为 “block”。
// 第 599 行：把 收到的消息的token 加到 reasoningRenderer 末尾。
// 第 600 行：如果 （收到的消息的type 等于 “token”），执行下面这一组步骤。
// 第 601 行：如果 （是否收到过思考文字 且 不满足（暂存的文字）），reasoningTitleEl的textContent 改为 “思考过程”。
// 第 602 行：暂存的文字 累加或追加 收到的消息的token。
// 第 603 行：把 收到的消息的token 加到 bodyRenderer 末尾。
// 第 604 行：如果 （收到的消息的type 等于 “done”），执行下面这一组步骤。
// 第 605 行：当前完整回答 改为 暂存的文字。
// 第 606 行：调用 setFinal（所属对象：bodyRenderer），传入 当前完整回答。
// 第 607 行：在 当前界面元素 中找到首个匹配 ".ds-actions" 的元素的style的display 改为 “flex”。
// 第 608 行：在 当前界面元素 中找到首个匹配 “.ds-model-tag” 的元素的textContent 改为 （收到的消息的model 或 “”）。
// 第 609 行：清理当前操作结束后的状态。
// 第 610 行：如果 （收到的消息的type 等于 “error”），执行下面这一组步骤。
// 第 611 行：结束请求并显示错误（当前界面元素、收到的消息的错误）。
// 第 612 行：清理当前操作结束后的状态。
// 第 613 行：结束前面的代码块、资料列表或函数调用。
// 第 614 行：结束前面的代码块、资料列表或函数调用。
// 第 616 行：登记 与后台通信的连接的onDisconnect 的监听函数，收到通知时执行下面的处理。
// 第 618 行：如果 （当前请求的通信连接 不等于 与后台通信的连接），立即结束当前函数，不继续执行下面步骤。
// 第 619 行：如果 是否正在等待回答，执行下面这一组步骤。
// 第 620 行：结束请求并显示错误（当前界面元素、“⚠️ 连接中断，请重试”）。
// 第 621 行：清理当前操作结束后的状态。
// 第 622 行：结束前面的代码块、资料列表或函数调用。
// 第 623 行：结束前面的代码块、资料列表或函数调用。
// 第 625 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；通过 与后台通信的连接 发出消息 一组字段。
// 第 626 行：type 字段设为 “STREAM_REQUEST”。
// 第 627 行：mode 字段设为 “D”。
// 第 628 行：text 字段设为 textToExplain。
// 第 629 行：context 字段设为 若 是否使用网页背景材料，用 取得当前选区的背景材料；否则用 空值 null。
// 第 630 行：analysis 字段设为 当前选区快照（存在时）的analysis。
// 第 631 行：explicitTask 字段设为 “interpret”。
// 第 632 行：捕获前面步骤的错误，按下面步骤处理；结束请求并显示错误（当前界面元素、“⚠️ 连接中断，请重试”）；清理当前操作结束后的状态。
// 第 633 行：结束前面的代码块、资料列表或函数调用。
// 第 639 行：初始化时读取划词触发方式和上下文偏好。
// 第 640 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 641 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 一组字段 完成。
// 第 642 行：划词触发方式 改为 （已保存的数据的triggerMode 或 “auto”）。
// 第 643 行：是否使用网页背景材料 改为 （已保存的数据的usePageContext 不等于 否（false））。
// 第 644 行：捕获前面步骤的错误，按下面步骤处理。
// 第 645 行：结束初始化函数并立即执行，完成本文件的注册。
// 第 647 行：监听设置变化，让已打开网页同步触发方式和背景偏好。
// 第 648 行：如果 存储变更记录的triggerMode，执行下面这一组步骤。
// 第 649 行：划词触发方式 改为 （存储变更记录的triggerMode的newValue 或 “auto”）。
// 第 650 行：结束前面的代码块、资料列表或函数调用。
// 第 651 行：如果 存储变更记录的usePageContext，执行下面这一组步骤。
// 第 652 行：是否使用网页背景材料 改为 （存储变更记录的usePageContext的newValue 不等于 否（false））。
// 第 653 行：结束前面的代码块、资料列表或函数调用。
// 第 654 行：结束前面的代码块、资料列表或函数调用。
// 第 657 行：监听 document 的 “contextmenu” 事件，发生后执行处理函数。
// 第 658 行：右键发生时保存页面坐标。
// 第 659 行：继续保存纵向坐标。
// 第 660 行：准备 text（文字）：去掉 将 取得浏览器当前文字选区 转成文字 两端空白。
// 第 661 行：有选中文字时保存右键快照，没有时清空。
// 第 662 行：结束前面的代码块、资料列表或函数调用。
// 第 665 行：定义函数 isEditingElement：检查用户是否正在输入或编辑；接收 无参数。
// 第 666 行：准备 el（当前界面元素）：document的activeElement。
// 第 667 行：如果 不满足（当前界面元素），结束当前函数，并返回 否（false）。
// 第 668 行：如果 （（当前界面元素的tagName 等于 “INPUT”） 或 （当前界面元素的tagName 等于 “TEXTAREA”）），结束当前函数，并返回 是（true）。
// 第 669 行：如果 当前界面元素的isContentEditable，结束当前函数，并返回 是（true）。
// 第 670 行：准备 role：读取 当前界面元素 的属性 “role”。
// 第 671 行：如果 （（role 等于 “searchbox”） 或 （role 等于 “textbox”）），结束当前函数，并返回 是（true）。
// 第 672 行：结束当前函数，并返回 否（false）。
// 第 673 行：结束前面的代码块、资料列表或函数调用。
// 第 676 行：监听 document 的 “mouseup” 事件，发生后执行处理函数。
// 第 677 行：拖动正在进行或刚结束 300 毫秒内，不触发新的划词请求。
// 第 678 行：浮层内选字不触发新解释。
// 第 679 行：仅右键模式下不自动请求。
// 第 680 行：只处理鼠标左键松开。
// 第 682 行：清除上次尚未执行的延迟。
// 第 683 行：延迟 150 毫秒再确认选区，避免连续操作重复触发。
// 第 684 行：如果 检查用户是否正在输入或编辑，立即结束当前函数，不继续执行下面步骤。
// 第 685 行：准备 sel：取得浏览器当前文字选区。
// 第 686 行：准备 text（文字）：去掉 将 sel 转成文字 两端空白。
// 第 687 行：如果 （外部关闭时的原文 不等于 空值 null），执行下面这一组步骤。
// 第 688 行：准备 closedText：外部关闭时的原文。
// 第 689 行：外部关闭时的原文 改为 空值 null。
// 第 692 行：外部关闭后选区没变化时保持关闭；真的选择了新文字才再次触发。
// 第 693 行：结束前面的代码块、资料列表或函数调用。
// 第 694 行：如果 不满足（文字），执行下面这一组步骤。
// 第 695 行：立即结束当前函数，不继续执行下面步骤。
// 第 696 行：结束前面的代码块、资料列表或函数调用。
// 第 697 行：启动一次划词请求并处理返回消息（一组字段）。
// 第 698 行：继续前一行的表达式；本行补充 }, 150);。
// 第 699 行：结束前面的代码块、资料列表或函数调用。
// 第 702 行：登记 chrome的runtime的onMessage 的监听函数，收到通知时执行下面的处理。
// 第 703 行：如果 （（消息或提示文字的type 等于 “TRIGGER_EXPLAIN”） 且 消息或提示文字的text），执行下面这一组步骤。
// 第 704 行：准备 snapshot（保存的快照）：若 （右键时的选区快照（存在时）的text 等于 消息或提示文字的text），用 右键时的选区快照；否则用 空值 null。
// 第 705 行：右键时的选区快照 改为 空值 null。
// 第 706 行：启动一次划词请求并处理返回消息（一组字段）。
// 第 707 行：结束前面的代码块、资料列表或函数调用。
// 第 708 行：如果 （消息或提示文字的type 等于 “TRIGGER_FULLPAGE_TRANSLATE”），执行下面这一组步骤。
// 第 709 行：在扩展环境有效时发送消息（一组字段）。
// 第 710 行：结束前面的代码块、资料列表或函数调用。
// 第 711 行：结束前面的代码块、资料列表或函数调用。
// 第 715 行：定义函数 isTooltipVisible：检查浮层是否处于可见状态；接收 无参数。
// 第 716 行：结束当前函数，并返回 （不满足（不满足（结果浮层）） 且 检查 结果浮层的classList 是否包含 “ds-visible”）。
// 第 717 行：结束前面的代码块、资料列表或函数调用。
// 第 719 行：定义函数 isEventInsideTooltip：检查事件是否来自浮层内部；接收 当前事件。
// 第 720 行：如果 检查节点是否位于浮层内（当前事件的target），结束当前函数，并返回 是（true）。
// 第 721 行：结束当前函数，并返回 （（当前事件的composedPath的数据类型 等于 “function”） 且 检查 调用 composedPath（所属对象：当前事件） 是否包含 结果浮层）。
// 第 722 行：结束前面的代码块、资料列表或函数调用。
// 第 726 行：准备 lastOutsideClosedText（外部关闭时的原文）：空值 null。
// 第 728 行：定义函数 clearSelectionDebounce：取消尚未触发的划词延迟；接收 无参数。
// 第 729 行：如果 划词延迟计时器，执行下面这一组步骤。
// 第 730 行：取消计时器 划词延迟计时器。
// 第 731 行：划词延迟计时器 改为 空值 null。
// 第 732 行：结束前面的代码块、资料列表或函数调用。
// 第 733 行：结束前面的代码块、资料列表或函数调用。
// 第 735 行：定义函数 handleDocumentPointerDown：处理点击外部关闭；接收 当前事件。
// 第 736 行：只响应主按键关闭，右键留给菜单使用。
// 第 737 行：取消尚未触发的划词延迟。
// 第 738 行：外部关闭时的原文 改为 空值 null。
// 第 739 行：如果 不满足（检查浮层是否处于可见状态），立即结束当前函数，不继续执行下面步骤。
// 第 740 行：如果 检查事件是否来自浮层内部（当前事件），立即结束当前函数，不继续执行下面步骤。
// 第 742 行：外部关闭时的原文 改为 当前选中的原文。
// 第 743 行：关闭浮层并清理请求和状态。
// 第 744 行：结束前面的代码块、资料列表或函数调用。
// 第 746 行：定义函数 handleDocumentKeyDown：处理 Esc 关闭；接收 当前事件。
// 第 747 行：输入法正在组字时不处理 Esc。
// 第 748 行：只有 Escape 键才进入关闭逻辑。
// 第 749 行：取消尚未触发的划词延迟。
// 第 750 行：如果 不满足（检查浮层是否处于可见状态），立即结束当前函数，不继续执行下面步骤。
// 第 751 行：关闭浮层并清理请求和状态。
// 第 752 行：结束前面的代码块、资料列表或函数调用。
// 第 755 行：捕获阶段监听指针按下，以便及时处理外部关闭。
// 第 756 行：捕获阶段监听按键以处理 Esc。
// 第 758 行：监听 window 的 “scroll” 事件，发生后执行处理函数。
// 第 759 行：监听 window 的 “resize” 事件，发生后执行处理函数。
// 第 760 行：监听 window 的 “blur” 事件，发生后执行处理函数。
