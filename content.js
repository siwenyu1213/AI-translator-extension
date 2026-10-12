// ========== AI 智能解释 & 翻译 — Content Script ==========
// 职责：划词检测 → 流式弹窗（解释/翻译共用）、动态菜单联动、全文翻译入口

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
    tooltip.inert = true;
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.innerHTML = `
      <div class="ds-header">
        <button class="ds-drag-handle" type="button" title="拖动移动；点击展开移动按钮；方向键微调" aria-label="移动结果浮层，方向键微调，点击展开移动按钮" aria-expanded="false">
          <svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="9" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="9" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="9" cy="13" r="1.2"/></svg>
          <span class="ds-brand">AI 解释</span><span class="ds-drag-hint">拖动</span>
        </button>
        <button class="ds-close" title="关闭" aria-label="关闭结果">×</button>
      </div>
      <div class="ds-move-controls" hidden>
        <button type="button" data-ds-move="left" aria-label="向左移动">←</button>
        <button type="button" data-ds-move="up" aria-label="向上移动">↑</button>
        <button type="button" data-ds-move="down" aria-label="向下移动">↓</button>
        <button type="button" data-ds-move="right" aria-label="向右移动">→</button>
        <button type="button" data-ds-move="reset">自动定位</button>
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
        <span class="ds-powered">Powered by AI</span>
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
    const handle = tooltip.querySelector('.ds-drag-handle');
    handle.addEventListener('click', (e) => {
      if (Date.now() - tooltipDragEndedAt < 300) { e.preventDefault(); return; }
      const controls = tooltip.querySelector('.ds-move-controls');
      controls.hidden = !controls.hidden;
      handle.setAttribute('aria-expanded', String(!controls.hidden));
      scheduleTooltipPosition();
    });
    handle.addEventListener('keydown', (e) => {
      const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'reset' }[e.key];
      if (!direction) return;
      e.preventDefault();
      nudgeTooltip(direction, e.shiftKey ? 40 : 10);
    });
    tooltip.querySelector('.ds-move-controls').addEventListener('click', (e) => {
      const direction = e.target.closest('[data-ds-move]')?.dataset.dsMove;
      if (direction) nudgeTooltip(direction, 40);
    });
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

function nudgeTooltip(direction, step) {
  if (direction === 'reset') tooltipManualPosition = null;
  else {
    const rect = tooltip.getBoundingClientRect();
    tooltipManualPosition = { left: rect.left + (direction === 'left' ? -step : direction === 'right' ? step : 0),
      top: rect.top + (direction === 'up' ? -step : direction === 'down' ? step : 0) };
  }
  positionTooltip(tooltipAnchor);
}

function startTooltipDrag(e) {
  if (e.button !== 0 || !e.isPrimary || e.target.closest('.ds-close')) return;
  const rect = tooltip.getBoundingClientRect();
  const captureTarget = e.target.closest('.ds-drag-handle') || e.currentTarget;
  tooltipDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false, captureTarget };
  captureTarget.setPointerCapture(e.pointerId);
  // Preserve the original selection instead of starting a new text selection in the header.
  e.preventDefault();
}

function moveTooltipDrag(e) {
  if (!tooltipDrag || tooltipDrag.id !== e.pointerId) return;
  const dx = e.clientX - tooltipDrag.x, dy = e.clientY - tooltipDrag.y;
  if (!tooltipDrag.moved && Math.hypot(dx, dy) < 3) return;
  tooltipDrag.moved = true;
  tooltip.classList.add('ds-dragging');
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
  popupTitle ||= `AI ${modeLabel(mode)}`;
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
  el.querySelector('.ds-move-controls').hidden = true;
  el.querySelector('.ds-drag-handle').setAttribute('aria-expanded', 'false');
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
    btn.style.color = '#16a34a';
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
  label.style.color = result?.ok ? '#16a34a' : '#dc2626';
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
  el.querySelector('.ds-brand').textContent = `AI ${modeLabel('D')}`;
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
