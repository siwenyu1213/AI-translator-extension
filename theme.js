// 文件职责：独立保存/同步 uiTheme、应用三主题、加载扩展本地图标和字体。
// 外观不携带或保存接口、Key、模型草稿。
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

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 主题逻辑：保存和同步外观，注册本地字体，给扩展界面挂上主题标记。
// popup.js 改 uiTheme → 本地存储通知 → 本文件更新浮层、工具栏和设置页。
// 只对 attach 登记的扩展元素应用主题，外观不负责保存模型或 Key。
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
// 第 4 行：允许三种主题：cobalt、playful、vellum，固定这份列表。
// 第 5 行：定义 normalize：合法主题原样保留，其他值改为默认 cobalt。
// 第 6 行：roots 保存要换主题的界面根元素，listeners 保存要通知的函数；两个集合都不重复。
// 第 7 行：当前主题先设为 cobalt；revision 记录主题被更新了几次。
// 第 9 行：逐个读取字体名称、文件名和支持的粗细范围。
// 第 10 行：登记 Syne 和 Space 两种本地字体资料。
// 第 11 行：登记 Inter 和 Cormorant 两种本地字体资料。
// 第 12 行：取得扩展内字体地址，创建 FontFace 并加入网页字体集；字体未加载时先用备用字体。
// 第 13 行：定义函数 apply：应用主题并通知订阅者；接收 待处理的值。
// 第 14 行：当前值 改为 将主题限定在允许的三种外观中（待处理的值）。
// 第 15 行：逐项读取 登记的扩展界面根元素，当前项记作 界面或扫描区域根元素，执行下面步骤。
// 第 16 行：已经离开页面的根元素从集合删除，跳过它。
// 第 17 行：给根元素设置当前主题标记，CSS 会按标记匹配颜色和字体。
// 第 18 行：结束前面的代码块、资料列表或函数调用。
// 第 19 行：逐个调用订阅函数，把当前主题告诉它们。
// 第 20 行：结束当前函数，并返回 当前值。
// 第 21 行：结束前面的代码块、资料列表或函数调用。
// 第 22 行：定义函数 attach：登记扩展界面根元素并设置品牌资源；接收 界面或扫描区域根元素。
// 第 23 行：给元素加 lc-theme 样式标记，设置当前主题，并登记到 roots。
// 第 24 行：把品牌图标的扩展内地址放入 CSS 变量，供界面显示。
// 第 25 行：结束前面的代码块、资料列表或函数调用。
// 第 26 行：监听浏览器存储变化。
// 第 27 行：仅处理 local 中的 uiTheme 变化；版本加一，立即应用新主题。
// 第 28 行：结束前面的代码块、资料列表或函数调用。
// 第 29 行：记住开始读取时的版本。
// 第 30 行：读取已保存的 uiTheme，成功后处理结果，失败时保留当前主题。
// 第 31 行：读取期间没有发生新主题修改，才应用这次读取结果，避免旧值覆盖新值。
// 第 32 行：结束当前函数，并返回 当前值。
// 第 33 行：若读取失败，返回现有主题。
// 第 34 行：把主题工具公开为 LingoTheme，并提供只读的当前主题属性。
// 第 35 行：subscribe 登记一个通知函数，返回一个可取消这次订阅的函数。
// 第 36 行：结束初始化函数并立即执行，完成本文件的注册。
