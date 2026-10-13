// 外观只读写 uiTheme，不携带或保存接口、Key、模型草稿。
(() => {
  const THEMES = Object.freeze(['cobalt', 'playful', 'vellum']);
  const normalize = value => THEMES.includes(value) ? value : 'cobalt';
  const roots = new Set(), listeners = new Set();
  let current = 'cobalt', revision = 0;
  // 注入CSS中的相对URL会落到宿主页面；FontFace与图标使用明确的扩展URL。
  for (const [name, file, weight] of [
    ['LC Syne','syne.ttf','400 800'], ['LC Space','space-grotesk.ttf','300 700'],
    ['LC Inter','inter.ttf','100 900'], ['LC Cormorant','cormorant-garamond.ttf','300 700']
  ]) document.fonts.add(new FontFace(name, `url("${chrome.runtime.getURL('vendor/fonts/' + file)}")`, {weight, display:'swap'}));
  function apply(value) {
    current = normalize(value);
    for (const root of roots) {
      if (!root.isConnected) { roots.delete(root); continue; }
      root.dataset.lcTheme = current;
    }
    for (const listener of listeners) listener(current);
    return current;
  }
  function attach(root) {
    root.classList.add('lc-theme'); root.dataset.lcTheme = current; roots.add(root);
    root.style.setProperty('--lc-brand-image', `url("${chrome.runtime.getURL('icons/brand.svg')}")`);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uiTheme) { revision++; apply(changes.uiTheme.newValue); }
  });
  const startedAt = revision;
  const ready = chrome.storage.local.get('uiTheme').then(stored => {
    if (revision === startedAt) apply(stored.uiTheme);
    return current;
  }).catch(() => current);
  globalThis.LingoTheme = { normalize, apply, attach, ready, get current() { return current; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
})();
