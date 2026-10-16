// 设置页的本地菜单：保留select作为配置状态源，以自绘列表提供统一外观与键盘操作。
(() => {
  const entries = new Map();
  let opened = null, sequence = 0;
  const arrow = '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>';
  const tick = '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg>';

  function sync(entry) {
    const { select, button, text } = entry;
    text.textContent = select.selectedOptions[0]?.textContent || '请选择';
    button.disabled = select.disabled;
    button.title = text.textContent;
    if (opened === entry) {
      if (select.disabled || !button.checkVisibility()) close(false);
      else render(entry);
    }
  }
  function syncAll() { for (const entry of entries.values()) sync(entry); }
  function close(restoreFocus = false) {
    if (!opened) return;
    const entry = opened; opened = null;
    entry.button.setAttribute('aria-expanded', 'false');
    entry.button.removeAttribute('aria-activedescendant');
    entry.search.removeAttribute('aria-activedescendant');
    entry.menu.hidePopover();
    if (restoreFocus && entry.button.checkVisibility()) entry.button.focus();
  }
  function position(entry) {
    const rect = entry.button.getBoundingClientRect();
    const bottom = Math.min(innerHeight, document.body.getBoundingClientRect().bottom);
    const top = Math.max(0, document.body.getBoundingClientRect().top);
    const below = bottom - rect.bottom - 10, above = rect.top - top - 10;
    const upwards = below < 220 && above > below;
    const space = Math.max(64, upwards ? above : below);
    entry.menu.style.width = Math.min(Math.max(rect.width, 242), innerWidth - 20) + 'px';
    entry.menu.style.maxHeight = Math.min(space, 300) + 'px';
    entry.menu.style.left = Math.max(10, Math.min(rect.left, innerWidth - entry.menu.getBoundingClientRect().width - 10)) + 'px';
    entry.menu.style.top = (upwards ? Math.max(top + 6, rect.top - entry.menu.getBoundingClientRect().height - 6) : rect.bottom + 6) + 'px';
  }
  function activate(entry, index, scroll = true) {
    if (!entry.items.length) { entry.active = -1; entry.button.removeAttribute('aria-activedescendant'); entry.search.removeAttribute('aria-activedescendant'); return; }
    entry.active = Math.max(0, Math.min(index, entry.items.length - 1));
    const nodes = [...entry.list.children];
    nodes.forEach((node, i) => node.classList.toggle('is-active', i === entry.active));
    entry.button.setAttribute('aria-activedescendant', nodes[entry.active].id);
    entry.search.setAttribute('aria-activedescendant', nodes[entry.active].id);
    if (scroll) nodes[entry.active].scrollIntoView({block:'nearest'});
  }
  function choose(entry, item) {
    if (!item || item.disabled) return;
    entry.select.value = item.value;
    close(true);
    entry.select.dispatchEvent(new Event('input', {bubbles:true}));
    entry.select.dispatchEvent(new Event('change', {bubbles:true}));
    syncAll();
  }
  function render(entry) {
    const filter = entry.search.value.trim().toLocaleLowerCase();
    entry.items = [...entry.select.options].filter(option => !option.hidden && !option.disabled && option.textContent.toLocaleLowerCase().includes(filter));
    entry.list.replaceChildren();
    for (const [index, item] of entry.items.entries()) {
      const row = document.createElement('div');
      row.className = 'lc-select-option'; row.id = `${entry.list.id}-${index}`;
      row.dataset.value = item.value;
      row.setAttribute('role','option');
      row.setAttribute('aria-selected', String(item.value === entry.select.value));
      const label = document.createElement('span'); label.textContent = item.textContent;
      const mark = document.createElement('span'); mark.className = 'lc-select-check'; mark.innerHTML = tick;
      row.append(label,mark);
      row.addEventListener('pointermove',()=>activate(entry,index,false));
      row.addEventListener('click',()=>choose(entry,item));
      entry.list.append(row);
    }
    entry.empty.hidden = entry.items.length !== 0;
    const current = entry.items.findIndex(option => option.value === entry.select.value);
    activate(entry, current < 0 ? 0 : current, false);
    if (opened === entry) position(entry);
  }
  function open(entry, last = false) {
    if (entry.select.disabled) return;
    close(false); sync(entry); opened = entry;
    entry.search.value = '';
    entry.search.hidden = entry.select.options.length <= 8;
    entry.button.setAttribute('aria-expanded','true');
    entry.menu.showPopover(); render(entry);
    activate(entry, last ? entry.items.length - 1 : Math.max(0, entry.items.findIndex(item=>item.value===entry.select.value)));
    position(entry);
  }
  function keydown(event, entry) {
    const isOpen = opened === entry;
    if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) open(entry,event.key==='ArrowUp');
      else activate(entry, (entry.active + (event.key==='ArrowDown'?1:-1) + entry.items.length) % Math.max(1,entry.items.length));
      return;
    }
    if (isOpen && (event.key === 'Home' || event.key === 'End') && event.target !== entry.search) {
      event.preventDefault(); activate(entry,event.key==='Home'?0:entry.items.length-1); return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && event.target !== entry.search)) {
      event.preventDefault();
      if (isOpen) choose(entry,entry.items[entry.active]); else open(entry);
      return;
    }
    if (isOpen && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !entry.search.hidden && event.target !== entry.search) {
      event.preventDefault(); entry.search.focus(); entry.search.value += event.key; render(entry);
    }
  }
  function attach(select) {
    const id = select.id || 'lc-select-'+(++sequence);
    const wrapper = document.createElement('div'); wrapper.className='lc-select';
    select.before(wrapper); wrapper.append(select);
    select.classList.add('lc-select-native'); select.tabIndex=-1; select.setAttribute('aria-hidden','true');
    const button = document.createElement('button');
    button.type='button'; button.id=id+'-trigger'; button.className='select lc-select-trigger';
    button.setAttribute('role','combobox'); button.setAttribute('aria-haspopup','listbox'); button.setAttribute('aria-expanded','false');
    const text = document.createElement('span'); text.className='lc-select-value'; text.id=id+'-value';
    const caret = document.createElement('span'); caret.className='lc-select-caret'; caret.innerHTML=arrow;
    button.append(text,caret); wrapper.append(button);
    const label = [...document.querySelectorAll('label')].find(node=>node.htmlFor===id);
    if (label) {
      label.id ||= id+'-label'; label.htmlFor=button.id;
      button.setAttribute('aria-labelledby',label.id+' '+text.id);
    }
    if (select.getAttribute('aria-describedby')) button.setAttribute('aria-describedby',select.getAttribute('aria-describedby'));
    const menu=document.createElement('div'); menu.className='lc-select-menu'; menu.setAttribute('popover','auto');
    const search=document.createElement('input'); search.type='search'; search.className='lc-select-search';
    search.placeholder='搜索'; search.autocomplete='off'; search.spellcheck=false;
    search.setAttribute('aria-label','搜索'+(label?.textContent||'选项'));
    const list=document.createElement('div'); list.className='lc-select-list'; list.id=id+'-list'; list.setAttribute('role','listbox');
    list.setAttribute('aria-label',label?.textContent||'选项');
    const empty=document.createElement('p'); empty.className='lc-select-empty'; empty.textContent='没有匹配的选项'; empty.hidden=true;
    menu.append(search,list,empty); document.body.append(menu);
    button.setAttribute('aria-controls',list.id); search.setAttribute('aria-controls',list.id);
    const entry={select,button,text,menu,search,list,empty,active:-1,items:[]}; entries.set(select,entry);
    button.addEventListener('click',()=>opened===entry?close(true):open(entry));
    button.addEventListener('keydown',event=>keydown(event,entry));
    search.addEventListener('keydown',event=>keydown(event,entry));
    search.addEventListener('input',()=>render(entry));
    menu.addEventListener('toggle',event=>{
      if (event.newState==='closed' && opened===entry) {
        opened=null; button.setAttribute('aria-expanded','false'); button.removeAttribute('aria-activedescendant');
      }
    });
    select.addEventListener('change',()=>sync(entry));
    new MutationObserver(()=>syncAll()).observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','label','value']});
    sync(entry);
  }
  for (const select of document.querySelectorAll('select')) attach(select);
  document.addEventListener('change',event=>{if(event.target instanceof HTMLSelectElement)queueMicrotask(syncAll);});
  document.addEventListener('pointerdown',event=>{
    if (opened && !opened.menu.contains(event.target) && !opened.button.contains(event.target)) close(false);
  });
  document.addEventListener('scroll',event=>{if(opened && !opened.menu.contains(event.target))close(false);},true);
  document.querySelectorAll('.tab-btn').forEach(button=>button.addEventListener('click',()=>{close(false);syncAll();}));
  addEventListener('resize',()=>close(false));
  LingoTheme.subscribe(()=>queueMicrotask(syncAll)); LingoTheme.ready.then(syncAll);
  globalThis.LingoSelects={sync:syncAll,close:()=>close(false)};
})();
