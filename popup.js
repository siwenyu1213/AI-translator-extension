// 文件职责：设置持久化、厂家模型查询、Key 编辑、DeepSeek 开关联动与触发方式保存。
// 按接口开放列表选模型，Key 保存后收起，保留上下文偏好。
const $ = id => document.getElementById(id);
const $apiKey = $('api-key'), $apiBaseUrl = $('api-base-url');
const $catalogStatus = $('catalog-status'), $status = $('status');
const tabs = ['explain', 'translate'].map(kind => ({
  kind, key: kind + 'Model', manufacturer: $(kind + '-manufacturer'),
  select: $(kind + '-model'), detail: $(kind + '-model-detail')
}));
let activeTabIndex = 0, connectionProvider = 'openai';
let providerConnections = {}, savedKeys = {}, modelList = [], savedConfig = {};
let catalogSnapshot = AIModelCatalog.BUILTIN, catalogRefreshing = false, catalogError = '';
const providerErrors = new Map(), providerRequests = new Map();
const editingKeys = new Set();
LingoTheme.attach(document.body);
LingoTheme.subscribe(theme => { $('ui-theme').value = theme; });
LingoTheme.ready.then(theme => { $('ui-theme').value = theme; });
$('ui-theme').addEventListener('change', async () => {
  const select = $('ui-theme'), requested = LingoTheme.normalize(select.value);
  select.disabled = true;
  try {
    await chrome.storage.local.set({uiTheme:requested});
    LingoTheme.apply(requested);
    $('theme-status').textContent = '主题已保存'; $('theme-status').className = 'hint';
  } catch {
    select.value = LingoTheme.current;
    $('theme-status').textContent = '主题保存失败，请重试。'; $('theme-status').className = 'inline-error';
  } finally { select.disabled = false; }
});

function providerConnection(provider) {
  const entry = providerConnections[provider] || {};
  return { ...entry, apiBaseUrl: AIConfig.endpointFor(provider, entry),
    apiKey: entry.apiKey || '', availableModels: entry.availableModels || [], modelEntries: entry.modelEntries || [] };
}
function captureConnection() {
  const previous = providerConnection(connectionProvider);
  const apiKey = $apiKey.value.trim() || savedKeys[connectionProvider] || '';
  providerConnections[connectionProvider] = { ...previous, apiKey,
    ...(apiKey !== previous.apiKey ? {availableModels:[], modelEntries:[], modelsCheckedAt:''} : {}) };
}
function showConnection() {
  connectionProvider = tabs[activeTabIndex].manufacturer.value;
  const connection = providerConnection(connectionProvider);
  $apiBaseUrl.value = connection.apiBaseUrl;
  $apiKey.value = connection.apiKey;
  $apiKey.placeholder = '填写所选厂家的 API Key';
  const edit = !savedKeys[connectionProvider] || editingKeys.has(connectionProvider);
  $('key-editor').hidden = !edit;
  $('rewrite-key').hidden = edit;
  $('key-saved').hidden = edit;
  $('cancel-key').hidden = !savedKeys[connectionProvider];
  $('custom-connection-button').hidden = connectionProvider !== 'custom';
  $('key-msg').textContent = '';
  renderCatalogStatus();
}
function renderCatalogStatus() {
  const missingAddress = connectionProvider === 'custom' && !providerConnection(connectionProvider).apiBaseUrl;
  const message = missingAddress ? '请先配置自定义接口地址。' : providerErrors.get(connectionProvider) || catalogError;
  $catalogStatus.textContent = message;
  $catalogStatus.hidden = !message;
}
function catalogState(message = '') { catalogError = message; renderCatalogStatus(); }
function renderManufacturers() {
  tabs.forEach(tab => {
    const selected = tab.manufacturer.value || 'openai';
    tab.manufacturer.replaceChildren();
    for (const maker of [...catalogSnapshot.providers, {id:'custom',name:'自定义接口'}]) {
      const option = document.createElement('option');
      option.value = maker.id; option.textContent = maker.name;
      tab.manufacturer.append(option);
    }
    tab.manufacturer.value = selected;
  });
}
function renderModelOptions(tab) {
  const selected = tab.select.value, provider = tab.manufacturer.value;
  const connection = providerConnection(provider);
  const missingAddress = provider === 'custom' && !connection.apiBaseUrl;
  const entries = missingAddress ? [] : AIModelCatalog.interfaceModels(connection.modelEntries.length ? connection.modelEntries :
    connection.availableModels.map(id => ({id})), provider);
  const catalog = catalogSnapshot.providers.find(p => p.id === provider)?.models || [];
  tab.select.replaceChildren();
  for (const entry of entries) {
    const known = catalog.find(m => entry.id === m.id || entry.id === AIModelCatalog.nativeId(m));
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name !== entry.id ? entry.name : known?.name || entry.id;
    tab.select.append(option);
    if (!modelList.includes(entry.id)) modelList.push(entry.id);
  }
  if (entries.some(entry => entry.id === selected)) tab.select.value = selected;
  tab.select.disabled = !entries.length;
  if (!entries.length) {
    const option = document.createElement('option'); option.value = '';
    option.textContent = missingAddress ? '先配置自定义接口地址' : connection.apiKey ? '暂无可用模型' : '填写 API Key 后加载模型';
    tab.select.append(option);
  }
  tab.detail.textContent = !entries.length && connection.apiKey ? '模型列表由当前接口提供。' : '';
  tab.detail.hidden = !tab.detail.textContent;
  renderThinkingControls(tab);
}
function renderThinkingControls(tab) {
  const kind = tab.kind;
  const deepSeek = AIConfig.isDeepSeekEndpoint(providerConnection(tab.manufacturer.value).apiBaseUrl);
  $(kind+'-deepseek-thinking-section').hidden = !deepSeek;
  const blocked = deepSeek && !$(kind+'-deepseek-thinking').checked;
  $(kind+'-thinking').disabled = blocked;
  if (blocked) $(kind+'-thinking').checked = false;
  $(kind+'-effort-section').style.display = $(kind+'-thinking').checked ? '' : 'none';
}
function renderAllModelOptions() { tabs.forEach(renderModelOptions); }
function setTabSelection(tab, id) {
  if ([...tab.select.options].some(option => option.value === id)) tab.select.value = id;
}
function manufacturerSettings() {
  return {providerConfigVersion:1, providerConnections:AIConfig.normalizeConnections(providerConnections),
    explainManufacturer:tabs[0].manufacturer.value, translateManufacturer:tabs[1].manufacturer.value};
}
function modelSettings() {
  return {modelList:modelList.slice(), explainModel:tabs[0].select.value, translateModel:tabs[1].select.value};
}
function showStatus(message, type = 'success') {
  $status.textContent = message; $status.className = 'status ' + type;
  clearTimeout($status.hideTimer);
  $status.hideTimer = setTimeout(() => {$status.textContent='';$status.className='status';}, 4000);
}

function renderEnabledState() { $('disabled-extension').hidden = savedConfig.enabled !== false; }
chrome.storage.onChanged.addListener((changes,area) => {
  if (area === 'local' && changes.enabled) {
    savedConfig.enabled = changes.enabled.newValue !== false;
    renderEnabledState();
  }
});
$('enable-extension').addEventListener('click',async()=>{
  $('enable-extension').disabled=true;
  try {
    await chrome.storage.local.set({enabled:true});
    savedConfig.enabled=true; renderEnabledState(); showStatus('扩展已启用。');
  } catch {showStatus('启用失败，请重试。','error');}
  finally {$('enable-extension').disabled=false;}
});

// 每个厂家独立查询；仅将响应写回请求使用的连接，不覆盖中途修改的 Key/地址。
async function queryWithFallback(message, fallback) {
  let result;
  try { result = await chrome.runtime.sendMessage(message); }
  catch (err) {
    if (!/receiving end does not exist|could not establish connection|message port closed|message channel closed/i.test(err.message)) throw err;
  }
  // 无回复/通信中断才恢复；后台明确的接口错误交给各自调用方处理。
  return result == null ? fallback() : result;
}
function requestProviderModels(connection) {
  return queryWithFallback({type:'LIST_MODELS',connection},()=>AIModelCatalog.fetchInterface(connection));
}
function modelFailureMessage(result, provider) {
  const name = catalogSnapshot.providers.find(p=>p.id===provider)?.name || '模型接口';
  const code = result?.code || ({401:'key_invalid',402:'balance',403:'forbidden',404:'unsupported',429:'rate_limit'})[result?.status];
  const messages = {
    key_missing:'请先填写 API Key。', key_invalid:'API Key 无效，请重新填写。',
    balance:'账户余额不足，请检查账户。', forbidden:'API Key 无权获取模型，请检查权限。',
    unsupported:'当前接口不支持获取模型列表。', rate_limit:'请求过于频繁，请稍后重试。',
    timeout:'获取模型超时，请稍后重试。', network:`无法连接 ${name}，请检查网络。`,
    format:'模型列表格式异常，请稍后重试。', address:'接口地址无效，请检查配置。',
    service:'模型服务暂不可用，请稍后重试。'
  };
  return messages[code] || '无法获取模型，请重新加载扩展后重试。';
}
async function refreshProviderModels(provider = connectionProvider) {
  const connection = providerConnection(provider);
  if (provider === 'custom' && !connection.apiBaseUrl) {
    providerErrors.set(provider, '请先配置自定义接口地址。');
    renderCatalogStatus();
    return;
  }
  if (!connection.apiKey || connection.apiKey !== savedKeys[provider]) return;
  const signature = JSON.stringify([connection.apiBaseUrl, connection.apiKey]);
  if (providerRequests.get(provider)?.signature === signature) return providerRequests.get(provider).promise;
  const request = {signature};
  const unchanged = () => {
    const current = providerConnection(provider);
    return JSON.stringify([current.apiBaseUrl,current.apiKey]) === signature && providerRequests.get(provider) === request;
  };
  providerRequests.set(provider,request);
  request.promise = (async () => {
    try {
      const result = await requestProviderModels(connection);
      if (!unchanged()) return;
      if (!result?.ok) {
        const error = new Error(modelFailureMessage(result,provider));
        error.modelFailure = result;
        throw error;
      }
      const entries = AIModelCatalog.interfaceModels(result.entries || result.models.map(id => ({id})), provider);
      providerConnections[provider] = { ...connection, availableModels:entries.map(m => m.id), modelEntries:entries,
        modelsCheckedAt:new Date().toISOString() };
      providerErrors.delete(provider);
      const currentSelections = tabs.map(tab => tab.select.value);
      renderAllModelOptions();
      tabs.forEach((tab,index) => setTabSelection(tab,currentSelections[index]));
      const renderedSelections = tabs.map(tab => tab.select.value);
      const stored = await chrome.storage.local.get(['providerConnections','explainManufacturer','translateManufacturer','explainModel','translateModel','modelList']);
      if (!unchanged()) return;
      // 首次从无缓存加载列表时恢复仍开放的已保存型号，不把自动首项当作用户选择。
      tabs.forEach((tab,index)=>{
        if (!currentSelections[index] && tab.select.value===renderedSelections[index] &&
            tab.manufacturer.value===provider && stored[tab.kind+'Manufacturer']===provider) {
          setTabSelection(tab,stored[tab.key]);
        }
      });
      const connections = AIConfig.normalizeConnections(stored.providerConnections);
      connections[provider] = providerConnections[provider];
      const updates = {providerConnections:connections,modelList:AIConfig.normalizeModels([...(stored.modelList||[]),...entries.map(m=>m.id)])};
      // 只更新已保存为该厂家的用途，避免把未保存的厂家选择写入后台。
      for (const tab of tabs) {
        if (stored[tab.kind+'Manufacturer'] === provider && !entries.some(m=>m.id === stored[tab.key])) {
          updates[tab.key] = entries[0]?.id || '';
        }
      }
      await chrome.storage.local.set(updates);
    } catch (err) {
      if (unchanged()) {
        const cached=providerConnection(provider).modelEntries.length || providerConnection(provider).availableModels.length;
        const message = err.modelFailure ? modelFailureMessage(err.modelFailure,provider) : '无法获取模型，请重新加载扩展后重试。';
        providerErrors.set(provider,message + (cached ? ' 已保留已有列表。' : ''));
        console.warn('接口模型列表更新失败：', {provider,code:err.modelFailure?.code || 'communication',status:err.modelFailure?.status});
      }
    } finally {
      if (providerRequests.get(provider) === request) providerRequests.delete(provider);
      renderCatalogStatus();
    }
  })();
  return request.promise;
}

async function requestCatalogSnapshot() {
  const result = await queryWithFallback({type:'REFRESH_MODEL_CATALOG'},async()=>{
    const stored = await chrome.storage.local.get('catalogSnapshot');
    const snapshot = await AIModelCatalog.refresh(stored.catalogSnapshot);
    await chrome.storage.local.set({catalogSnapshot:snapshot});
    return {ok:true,snapshot};
  });
  if (!result.ok) throw new Error(result.error || '后台未提供更新结果');
  if (result.snapshot?.source !== AIModelCatalog.SOURCE || !Array.isArray(result.snapshot.providers)) throw new Error('模型目录无效');
  return {snapshot:result.snapshot};
}
async function refreshCatalog() {
  if (catalogRefreshing) return;
  catalogRefreshing = true; catalogState();
  try {
    const {snapshot} = await requestCatalogSnapshot();
    const selections = tabs.map(tab=>tab.select.value);
    catalogSnapshot = AIModelCatalog.normalizeSnapshot(snapshot);
    renderManufacturers(); renderAllModelOptions();
    tabs.forEach((tab,index)=>setTabSelection(tab,selections[index]));
    await chrome.storage.local.set({catalogLastCheckedAt:new Date().toISOString()});
    catalogState(catalogSnapshot.providers.some(p=>p.stale) ? '部分厂家的模型暂未更新，已保留已有列表。' : '');
  } catch (err) {
    catalogState('暂时无法获取模型，已保留已有列表。');
    console.warn('公开模型目录刷新失败：',err.message);
  } finally {catalogRefreshing=false;}
}

document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
  captureConnection();
  $('custom-connection-dialog').close();
  activeTabIndex = button.dataset.tab === 'translate' ? 1 : 0;
  document.querySelectorAll('.tab-btn').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button));});
  document.querySelectorAll('.tab-panel').forEach(p=>{const active=p.id==='panel-'+button.dataset.tab;p.classList.toggle('active',active);p.hidden=!active;});
  showConnection(); renderAllModelOptions();
}));
document.querySelector('.tab-bar').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const buttons = [...document.querySelectorAll('.tab-btn')];
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 2) % 2;
  buttons[next].focus(); buttons[next].click();
});
tabs.forEach(tab => tab.manufacturer.addEventListener('change', () => {
  if (tab === tabs[activeTabIndex]) {captureConnection();showConnection();}
  renderModelOptions(tab);
  refreshProviderModels(tab.manufacturer.value);
}));
for (const kind of ['explain','translate']) {
  const tab = tabs.find(tab=>tab.kind===kind);
  $(kind+'-thinking').addEventListener('change',()=>renderThinkingControls(tab));
  $(kind+'-deepseek-thinking').addEventListener('change',()=>renderThinkingControls(tab));
}
$('rewrite-key').addEventListener('click',()=>{
  editingKeys.add(connectionProvider);
  $('key-editor').hidden=false; $('rewrite-key').hidden=true; $('key-saved').hidden=true;
  $apiKey.value=''; $apiKey.focus();
});
$('cancel-key').addEventListener('click',async()=> {
  editingKeys.delete(connectionProvider);
  const provider = connectionProvider;
  const stored = await chrome.storage.local.get('providerConnections');
  providerConnections[provider] = AIConfig.normalizeConnections(stored.providerConnections)[provider] || {};
  if (connectionProvider === provider) showConnection();
  renderAllModelOptions();
});
$('save-key').addEventListener('click', async()=>{
  const key=$apiKey.value.trim(), provider=connectionProvider;
  if (!key) {$('key-msg').textContent='请输入 API Key。';$apiKey.focus();return;}
  $('save-key').disabled=true;
  try {
    captureConnection();
    const stored=await chrome.storage.local.get(['providerConnections','explainManufacturer','translateManufacturer']);
    const connections=AIConfig.normalizeConnections(stored.providerConnections);
    const changed=connections[provider]?.apiKey!==key;
    connections[provider]=providerConnections[provider];
    const updates={providerConnections:connections,requiresApiSetup:false};
    if(changed) for(const tab of tabs) if(stored[tab.kind+'Manufacturer']===provider) updates[tab.key]='';
    await chrome.storage.local.set(updates);
    savedKeys[provider]=key; editingKeys.delete(provider);
    if (connectionProvider===provider) showConnection();
    renderAllModelOptions();
    refreshProviderModels(provider);
  } catch (err) {$('key-msg').textContent='保存失败，请重试。';}
  finally {$('save-key').disabled=false;}
});
$('custom-connection-button').addEventListener('click',()=>{
  $apiBaseUrl.value=providerConnection('custom').apiBaseUrl;
  $('custom-msg').textContent='';
  $('custom-connection-dialog').showModal(); $apiBaseUrl.focus();
});
$('custom-cancel').addEventListener('click',()=>$('custom-connection-dialog').close());
$('custom-save').addEventListener('click',async()=>{
  let previous;
  $('custom-save').disabled=true;
  try {
    const apiBaseUrl=AIConfig.normalizeBaseUrl($apiBaseUrl.value);
    previous=providerConnection('custom');
    // 先使旧地址的在途列表响应失效；内存仍保留未保存的 Key 草稿。
    const draftProfile={...previous,apiBaseUrl,
      ...(previous.apiBaseUrl!==apiBaseUrl ? {availableModels:[],modelEntries:[],modelsCheckedAt:''} : {})};
    providerConnections.custom=draftProfile;
    const stored=await chrome.storage.local.get(['providerConnections','explainManufacturer','translateManufacturer']);
    const connections=AIConfig.normalizeConnections(stored.providerConnections);
    const saved=connections.custom || {apiKey:'',availableModels:[],modelEntries:[],modelsCheckedAt:''};
    const changed=(saved.apiBaseUrl || '')!==apiBaseUrl;
    // 地址保存只保存地址和已保存 Key，不能顺带保存切换标签时捕获的 Key 草稿。
    const profile={...saved,apiBaseUrl,
      ...(changed ? {availableModels:[],modelEntries:[],modelsCheckedAt:''} : {})};
    connections.custom=profile;
    const updates={providerConnections:connections};
    if (changed) for (const tab of tabs) if (stored[tab.kind+'Manufacturer']==='custom') updates[tab.key]='';
    await chrome.storage.local.set(updates);
    providerConnections.custom={...profile,apiKey:draftProfile.apiKey};
    if (draftProfile.apiKey!==profile.apiKey) Object.assign(providerConnections.custom,{availableModels:[],modelEntries:[],modelsCheckedAt:''});
    providerErrors.delete('custom');
    $('custom-connection-dialog').close(); renderAllModelOptions();
    refreshProviderModels('custom');
  } catch(err) {if(previous) providerConnections.custom=previous;$('custom-msg').textContent=err.message;}
  finally {$('custom-save').disabled=false;}
});
$('save-btn').addEventListener('click',async()=>{
  try {
    captureConnection();
    renderAllModelOptions();
    const config={...manufacturerSettings(),...modelSettings(),
      explainThinkingEnabled:$('explain-thinking').checked,explainReasoningEffort:$('explain-effort').value,
      translateThinkingEnabled:$('translate-thinking').checked,translateReasoningEffort:$('translate-effort').value,
      explainDeepSeekThinkingEnabled:$('explain-deepseek-thinking').checked,
      translateDeepSeekThinkingEnabled:$('translate-deepseek-thinking').checked,
      language:$('explain-language').value,targetLanguage:$('target-language').value,
      enabled:savedConfig.enabled!==false,usePageContext:savedConfig.usePageContext!==false,
      triggerMode:$('trigger-mode').value,requiresApiSetup:false};
    await chrome.storage.local.set(config);
    for (const [provider,connection] of Object.entries(providerConnections)) savedKeys[provider]=connection.apiKey;
    editingKeys.clear();showConnection();
    showStatus('设置已保存。');
    const providers=new Set(tabs.map(tab=>tab.manufacturer.value));
    for (const provider of providers) refreshProviderModels(provider);
  } catch(err) {showStatus('保存失败，请重试。','error');}
});

(async()=>{
  const config=await AIConfig.load(); savedConfig=config;
  renderEnabledState();
  modelList=config.modelList.slice();
  catalogSnapshot=AIModelCatalog.normalizeSnapshot(config.catalogSnapshot);
  providerConnections=AIConfig.normalizeConnections(config.providerConnections);
  savedKeys=Object.fromEntries(Object.entries(providerConnections).map(([id,c])=>[id,c.apiKey]));
  renderManufacturers();
  for (const tab of tabs) {
    tab.manufacturer.value=config[tab.kind+'Manufacturer'];
    $(tab.kind+'-thinking').checked=config[tab.kind+'ThinkingEnabled']===true;
    $(tab.kind+'-deepseek-thinking').checked=config[tab.kind+'DeepSeekThinkingEnabled']===true;
    $(tab.kind+'-effort').value=config[tab.kind+'ReasoningEffort']||'high';
    $(tab.kind+'-effort-section').style.display=$(tab.kind+'-thinking').checked ? '' : 'none';
  }
  $('explain-language').value=config.language||'auto';$('target-language').value=config.targetLanguage||'zh';
  $('trigger-mode').value=config.triggerMode;
  showConnection();renderAllModelOptions();
  tabs.forEach(tab=>setTabSelection(tab,config[tab.key]));
  refreshCatalog();
  for (const provider of new Set(tabs.map(tab=>tab.manufacturer.value))) refreshProviderModels(provider);
})().catch(err=>showStatus('读取设置失败，请重新打开。','error'));

// 中文逐句导读（不参与运行）
//
// 一、这个文件在项目中做什么
// 设置页逻辑：读写配置，管理厂家、Key、模型和思考选项，响应按钮操作。
// popup.html 提供控件 → 本文件处理操作 → config.js 整理配置 → 浏览器本地存储。
// 页面的草稿和已保存配置是两回事；主题独立保存，保存地址也不顺带保存 Key 草稿。
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
// 第 3 行：定义 $：按 id 找到设置页控件，后续代码少写重复查找。
// 第 4 行：准备 $apiKey（Key 输入框）：找到页面中 id 为 “api-key” 的控件；准备 $apiBaseUrl（地址输入框）：找到页面中 id 为 “api-base-url” 的控件。
// 第 5 行：准备 $catalogStatus（模型目录提示区）：找到页面中 id 为 “catalog-status” 的控件；准备 $status（保存结果提示区）：找到页面中 id 为 “status” 的控件。
// 第 6 行：为解释和翻译建立两个面板的资料。
// 第 7 行：每个面板保存用途、配置字段名和厂家控件。
// 第 8 行：继续保存型号下拉框和型号说明控件。
// 第 9 行：结束前面的代码块、资料列表或函数调用。
// 第 10 行：准备 activeTabIndex（当前标签编号）：0；准备 connectionProvider（当前正在编辑的厂家）：“openai”。
// 第 11 行：准备 providerConnections（各厂家的连接草稿）：空资料对象 {}；准备 savedKeys（各厂家已保存的 Key）：空资料对象 {}；准备 modelList（模型名列表）：列表 []；准备 savedConfig（已保存配置）：空资料对象 {}。
// 第 12 行：准备 catalogSnapshot（模型目录快照）：AIModelCatalog的BUILTIN；准备 catalogRefreshing（是否正在刷新公开目录）：否（false）；准备 catalogError（公开目录错误提示）：“”。
// 第 13 行：准备 providerErrors（各厂家的查询错误）：建立按标识存取资料的 Map 表；准备 providerRequests（各厂家的查询任务）：建立按标识存取资料的 Map 表。
// 第 14 行：准备 editingKeys（正在编辑 Key 的厂家集合）：建立不重复的 Set 集合。
// 第 15 行：登记扩展界面根元素并设置品牌资源（document的请求内容或正文元素）。
// 第 16 行：登记主题变化后的处理函数；找到页面中 id 为 “ui-theme” 的控件的value 改为 theme。
// 第 17 行：在 LingoTheme的ready 成功后执行处理函数；找到页面中 id 为 “ui-theme” 的控件的value 改为 theme。
// 第 18 行：用户换主题时立即保存，其他模型和 Key 草稿不随主题保存。
// 第 19 行：准备 select：找到页面中 id 为 “ui-theme” 的控件；准备 requested：将主题限定在允许的三种外观中（select的待处理的值）。
// 第 20 行：select的disabled 改为 是（true）。
// 第 21 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 22 行：等待 向浏览器本地存储保存 一组字段 完成。
// 第 23 行：应用主题并通知订阅者（requested）。
// 第 24 行：找到页面中 id 为 “theme-status” 的控件的textContent 改为 “主题已保存”；找到页面中 id 为 “theme-status” 的控件的className 改为 “hint”。
// 第 25 行：捕获前面步骤的错误，按下面步骤处理。
// 第 26 行：select的value 改为 LingoTheme的current。
// 第 27 行：找到页面中 id 为 “theme-status” 的控件的textContent 改为 “主题保存失败，请重试。”；找到页面中 id 为 “theme-status” 的控件的className 改为 “inline-error”。
// 第 28 行：select的disabled 改为 否（false）。
// 第 29 行：结束前面的代码块、资料列表或函数调用。
// 第 31 行：定义函数 providerConnection：取得当前厂家连接草稿；接收 厂家标识。
// 第 32 行：准备 entry（一条资料）：（各厂家的连接草稿的第 [厂家标识] 项 或 空资料对象 {}）。
// 第 33 行：结束当前函数，并返回 一组字段（沿用已有字段、apiBaseUrl: endpointFor的结果、apiKey: （一条资料的apiKey 或 “”）、availableModels: （一条资料的availableModels 或 列表 []）、modelEntries: （一条资料的modelEntries 或 列表 []））。
// 第 34 行：apiKey 字段设为 （一条资料的apiKey 或 “”）；availableModels 字段设为 （一条资料的availableModels 或 列表 []）；modelEntries 字段设为 （一条资料的modelEntries 或 列表 []）。
// 第 35 行：结束前面的代码块、资料列表或函数调用。
// 第 36 行：定义函数 captureConnection：记住正在编辑的 Key，变化时清旧型号；接收 无参数。
// 第 37 行：准备 previous：取得当前厂家连接草稿（当前正在编辑的厂家）。
// 第 38 行：输入框有新 Key 用新值，否则用该厂家的已保存 Key。
// 第 39 行：各厂家的连接草稿的第 [当前正在编辑的厂家] 项 改为 一组字段（沿用已有字段、apiKey、沿用已有字段）。
// 第 40 行：Key 改了就清旧型号与查询时间，避免沿用另一 Key 的权限结果。
// 第 41 行：结束前面的代码块、资料列表或函数调用。
// 第 42 行：定义函数 showConnection：显示当前厂家的连接和 Key 编辑状态；接收 无参数。
// 第 43 行：当前正在编辑的厂家 改为 解释和翻译两个面板的控件资料的第 [当前标签编号] 项的manufacturer的value。
// 第 44 行：准备 connection（接口连接资料）：取得当前厂家连接草稿（当前正在编辑的厂家）。
// 第 45 行：地址输入框的value 改为 接口连接资料的apiBaseUrl。
// 第 46 行：Key 输入框的value 改为 接口连接资料的apiKey。
// 第 47 行：Key 输入框的placeholder 改为 “填写所选厂家的 API Key”。
// 第 48 行：没有已保存 Key 或正在重填时，显示编辑区域。
// 第 49 行：找到页面中 id 为 “key-editor” 的控件的hidden 改为 不满足（edit）。
// 第 50 行：找到页面中 id 为 “rewrite-key” 的控件的hidden 改为 edit。
// 第 51 行：找到页面中 id 为 “key-saved” 的控件的hidden 改为 edit。
// 第 52 行：找到页面中 id 为 “cancel-key” 的控件的hidden 改为 不满足（各厂家已保存的 Key的第 [当前正在编辑的厂家] 项）。
// 第 53 行：找到页面中 id 为 “custom-connection-button” 的控件的hidden 改为 （当前正在编辑的厂家 不等于 “custom”）。
// 第 54 行：找到页面中 id 为 “key-msg” 的控件的textContent 改为 “”。
// 第 55 行：显示当前连接或目录的错误。
// 第 56 行：结束前面的代码块、资料列表或函数调用。
// 第 57 行：定义函数 renderCatalogStatus：显示当前连接或目录的错误；接收 无参数。
// 第 58 行：准备 missingAddress：（（当前正在编辑的厂家 等于 “custom”） 且 不满足（取得当前厂家连接草稿（当前正在编辑的厂家）的apiBaseUrl））。
// 第 59 行：准备 message（消息或提示文字）：若 missingAddress，用 “请先配置自定义接口地址。”；否则用 （从 各厂家的查询错误 读取 当前正在编辑的厂家 或 公开目录错误提示）。
// 第 60 行：模型目录提示区的textContent 改为 消息或提示文字。
// 第 61 行：模型目录提示区的hidden 改为 不满足（消息或提示文字）。
// 第 62 行：结束前面的代码块、资料列表或函数调用。
// 第 63 行：定义函数 catalogState：更新公开目录提示；接收 消息或提示文字，未传入时用 “”；公开目录错误提示 改为 消息或提示文字；显示当前连接或目录的错误。
// 第 64 行：定义函数 renderManufacturers：重建厂家下拉选项；接收 无参数。
// 第 65 行：对 解释和翻译两个面板的控件资料 每项执行 下方处理函数。
// 第 66 行：准备 selected（选中的任务或文字）：（tab的manufacturer的value 或 “openai”）。
// 第 67 行：用 无参数 替换 tab的manufacturer 原有内容。
// 第 68 行：逐项读取 列表 [展开或收集 模型目录快照的providers、一组字段（id: “custom”、name: “自定义接口”）]，当前项记作 maker，执行下面步骤；id 字段设为 “custom”；name 字段设为 “自定义接口”。
// 第 69 行：准备 option：创建 “option” 元素。
// 第 70 行：option的value 改为 maker的id；option的textContent 改为 maker的name。
// 第 71 行：把 option 追加到 tab的manufacturer。
// 第 72 行：结束前面的代码块、资料列表或函数调用。
// 第 73 行：tab的manufacturer的value 改为 选中的任务或文字。
// 第 74 行：结束前面的代码块、资料列表或函数调用。
// 第 75 行：结束前面的代码块、资料列表或函数调用。
// 第 76 行：定义函数 renderModelOptions：显示当前接口开放的文本型号；接收 tab。
// 第 77 行：准备 selected（选中的任务或文字）：tab的select的value；准备 provider（厂家标识）：tab的manufacturer的value。
// 第 78 行：取得该面板当前厂家连接。
// 第 79 行：自定义地址缺失时视为未配置。
// 第 80 行：优先用缓存的型号详细资料，没有则从型号名生成资料，再按当前厂家过滤。
// 第 81 行：继续传入当前厂家作为过滤条件。
// 第 82 行：准备 catalog：（从 模型目录快照的providers 找首个满足 （p的id 等于 厂家标识） 的项（存在时）的models 或 列表 []）。
// 第 83 行：用 无参数 替换 tab的select 原有内容。
// 第 84 行：逐项读取 资料列表，当前项记作 一条资料，执行下面步骤。
// 第 85 行：准备 known：从 catalog 找首个满足 （（一条资料的id 等于 m的id） 或 （一条资料的id 等于 把目录模型名转换为原生调用名（m））） 的项。
// 第 86 行：准备 option：创建 “option” 元素。
// 第 87 行：option的value 改为 一条资料的id。
// 第 88 行：option的textContent 改为 若 （一条资料的name 不等于 一条资料的id），用 一条资料的name；否则用 （known（存在时）的name 或 一条资料的id）。
// 第 89 行：把 option 追加到 tab的select。
// 第 90 行：如果 不满足（检查 模型名列表 是否包含 一条资料的标识），把 一条资料的id 加到 模型名列表 末尾。
// 第 91 行：结束前面的代码块、资料列表或函数调用。
// 第 92 行：如果 检查 资料列表 是否至少一项满足 （一条资料的id 等于 选中的任务或文字），tab的select的value 改为 选中的任务或文字。
// 第 93 行：tab的select的disabled 改为 不满足（资料列表的length）。
// 第 94 行：如果 不满足（资料列表的length），执行下面这一组步骤。
// 第 95 行：模型列表为空时，下拉框显示一个说明选项。
// 第 96 行：根据缺地址、有 Key 无列表或没 Key，显示不同说明。
// 第 97 行：把 option 追加到 tab的select。
// 第 98 行：结束前面的代码块、资料列表或函数调用。
// 第 99 行：tab的detail的textContent 改为 若 （不满足（资料列表的长度或数量） 且 接口连接资料的apiKey），用 “模型列表由当前接口提供。”；否则用 “”。
// 第 100 行：tab的detail的hidden 改为 不满足（tab的detail的textContent）。
// 第 101 行：按厂家和开关更新思考控件（tab）。
// 第 102 行：结束前面的代码块、资料列表或函数调用。
// 第 103 行：定义函数 renderThinkingControls：按厂家和开关更新思考控件；接收 tab。
// 第 104 行：准备 kind（当前用途或内容类型）：tab的kind。
// 第 105 行：准备 deepSeek（是否为 DeepSeek 官方接口）：只按主机名判断 DeepSeek 官方地址（providerConnection的结果的接口基础地址）。
// 第 106 行：只对 DeepSeek 官方地址展示专用思考控件。
// 第 107 行：DeepSeek 总开关关闭时，深度思考控件不可用。
// 第 108 行：禁用深度思考控件。
// 第 109 行：被总开关限制时，同时取消深度思考勾选。
// 第 110 行：深度思考开启才显示强度下拉框。
// 第 111 行：结束前面的代码块、资料列表或函数调用。
// 第 112 行：定义函数 renderAllModelOptions：更新两个用途的型号选项；接收 无参数；对 解释和翻译两个面板的控件资料 每项执行 renderModelOptions。
// 第 113 行：定义函数 setTabSelection：仅当选项存在时选择型号；接收 tab、标识。
// 第 114 行：如果 检查 列表 [展开或收集 tab的select的options] 是否至少一项满足 （option的value 等于 标识），tab的select的value 改为 标识。
// 第 115 行：结束前面的代码块、资料列表或函数调用。
// 第 116 行：定义函数 manufacturerSettings：整理厂家和连接配置；接收 无参数。
// 第 117 行：结束当前函数，并返回 一组字段（providerConfigVersion: 1、providerConnections: normalizeConnections的结果、explainManufacturer: 解释和翻译两个面板的控件资料的按 0 取得的项目的manufacturer的待处理的值、translateManufacturer: 解释和翻译两个面板的控件资料的按 1 取得的项目的manufacturer的待处理的值）。
// 第 118 行：explainManufacturer 字段设为 解释和翻译两个面板的控件资料的第 [0] 项的manufacturer的value；translateManufacturer 字段设为 解释和翻译两个面板的控件资料的第 [1] 项的manufacturer的value。
// 第 119 行：结束前面的代码块、资料列表或函数调用。
// 第 120 行：定义函数 modelSettings：整理模型选择配置；接收 无参数。
// 第 121 行：结束当前函数，并返回 一组字段（modelList: slice的结果、explainModel: 解释和翻译两个面板的控件资料的按 0 取得的项目的select的待处理的值、translateModel: 解释和翻译两个面板的控件资料的按 1 取得的项目的select的待处理的值）。
// 第 122 行：结束前面的代码块、资料列表或函数调用。
// 第 123 行：定义函数 showStatus：显示操作结果并稍后清空；接收 消息或提示文字、type，未传入时用 “success”。
// 第 124 行：保存结果提示区的textContent 改为 消息或提示文字；保存结果提示区的className 改为 （“status ” 加上或拼接 type）。
// 第 125 行：取消计时器 保存结果提示区的hideTimer。
// 第 126 行：保存结果提示区的hideTimer 改为 延迟 4000 毫秒后执行函数；保存结果提示区的textContent 改为 “”；保存结果提示区的className 改为 “status”。
// 第 127 行：结束前面的代码块、资料列表或函数调用。
// 第 129 行：定义函数 renderEnabledState：显示扩展停用时的恢复入口；接收 无参数；找到页面中 id 为 “disabled-extension” 的控件的hidden 改为 （已保存配置的enabled 不等于 否（false））。
// 第 130 行：登记 chrome的storage的onChanged 的监听函数，收到通知时执行下面的处理。
// 第 131 行：如果 （（存储区域 等于 “local”） 且 存储变更记录的enabled），执行下面这一组步骤。
// 第 132 行：已保存配置的enabled 改为 （存储变更记录的enabled的newValue 不等于 否（false））。
// 第 133 行：显示扩展停用时的恢复入口。
// 第 134 行：结束前面的代码块、资料列表或函数调用。
// 第 135 行：结束前面的代码块、资料列表或函数调用。
// 第 136 行：监听 找到页面中 id 为 “enable-extension” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 137 行：找到页面中 id 为 “enable-extension” 的控件的disabled 改为 是（true）。
// 第 138 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 139 行：等待 向浏览器本地存储保存 一组字段 完成。
// 第 140 行：已保存配置的enabled 改为 是（true）；显示扩展停用时的恢复入口；显示操作结果并稍后清空（“扩展已启用。”）。
// 第 141 行：捕获前面步骤的错误，按下面步骤处理；显示操作结果并稍后清空（“启用失败，请重试。”、“error”）。
// 第 142 行：找到页面中 id 为 “enable-extension” 的控件的disabled 改为 否（false）。
// 第 143 行：结束前面的代码块、资料列表或函数调用。
// 第 146 行：定义异步函数 queryWithFallback：后台通信无回复时使用本地恢复路径；接收 消息或提示文字、fallback。
// 第 147 行：准备 result（处理结果），暂不赋值。
// 第 148 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行；处理结果 改为 等待 向扩展发送消息 消息或提示文字 完成。
// 第 149 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 150 行：只针对后台通信不存在或中断进行恢复；其他错误继续报给调用方。
// 第 151 行：结束前面的代码块、资料列表或函数调用。
// 第 153 行：后台没有结果时执行备用查询，有明确结果时使用后台结果。
// 第 154 行：结束前面的代码块、资料列表或函数调用。
// 第 155 行：定义函数 requestProviderModels：请求账号模型列表；接收 接口连接资料。
// 第 156 行：结束当前函数，并返回 后台通信无回复时使用本地恢复路径（一组字段、带当前 Key 查询模型列表并分类错误（接口连接资料））。
// 第 157 行：结束前面的代码块、资料列表或函数调用。
// 第 158 行：定义函数 modelFailureMessage：把查询错误换成易读提示；接收 处理结果、厂家标识。
// 第 159 行：准备 name（名称）：（从 模型目录快照的providers 找首个满足 （p的id 等于 厂家标识） 的项（存在时）的name 或 “模型接口”）。
// 第 160 行：准备 code（代码特征）：（处理结果（存在时）的code 或 一组字段（401: “key_invalid”、402: “balance”、403: “forbidden”、404: “unsupported”、429: “rate_limit”）的第 [处理结果（存在时）的status] 项）。
// 第 161 行：准备 messages：一组字段（key_missing: “请先填写 API Key。”、key_invalid: “API Key 无效，请重新填写。”、balance: “账户余额不足，请检查账户。”、forbidden: “API Key 无权获取模型，请检查权限。”、unsupported: “当前接口不支持获取模型列表。”、rate_limit: “请求过于频繁，请稍后重试。”、timeout: “获取模型超时，请稍后重试。”、network: 拼接文字和变量（名称）、format: “模型列表格式异常，请稍后重试。”、address: “接口地址无效，请检查配置。”、service: “模型服务暂不可用，请稍后重试。”）。
// 第 162 行：key_missing 字段设为 “请先填写 API Key。”；key_invalid 字段设为 “API Key 无效，请重新填写。”。
// 第 163 行：balance 字段设为 “账户余额不足，请检查账户。”；forbidden 字段设为 “API Key 无权获取模型，请检查权限。”。
// 第 164 行：unsupported 字段设为 “当前接口不支持获取模型列表。”；rate_limit 字段设为 “请求过于频繁，请稍后重试。”。
// 第 165 行：timeout 字段设为 “获取模型超时，请稍后重试。”；network 字段设为 拼接文字和变量（名称）。
// 第 166 行：format 字段设为 “模型列表格式异常，请稍后重试。”；address 字段设为 “接口地址无效，请检查配置。”。
// 第 167 行：service 字段设为 “模型服务暂不可用，请稍后重试。”。
// 第 168 行：结束前面的代码块、资料列表或函数调用。
// 第 169 行：结束当前函数，并返回 （messages的第 [代码特征] 项 或 “无法获取模型，请重新加载扩展后重试。”）。
// 第 170 行：结束前面的代码块、资料列表或函数调用。
// 第 171 行：定义异步函数 refreshProviderModels：刷新一个厂家型号并防止旧请求覆盖新设置；接收 厂家标识，未传入时用 当前正在编辑的厂家。
// 第 172 行：准备 connection（接口连接资料）：取得当前厂家连接草稿（厂家标识）。
// 第 173 行：如果 （（厂家标识 等于 “custom”） 且 不满足（接口连接资料的apiBaseUrl）），执行下面这一组步骤。
// 第 174 行：在 各厂家的查询错误 保存 厂家标识 对应的 “请先配置自定义接口地址。”。
// 第 175 行：显示当前连接或目录的错误。
// 第 176 行：立即结束当前函数，不继续执行下面步骤。
// 第 177 行：结束前面的代码块、资料列表或函数调用。
// 第 178 行：只有已保存且没有继续改动的 Key 才触发自动型号查询。
// 第 179 行：将地址和 Key 编成连接签名，用于排除旧响应。
// 第 180 行：同一厂家同一连接已有查询时，共用正在进行的任务。
// 第 181 行：准备 request：一组字段（signature）。
// 第 182 行：定义工具 unchanged：小函数，接收 无参数；具体步骤见下面各行。
// 第 183 行：准备 current（当前值）：取得当前厂家连接草稿（厂家标识）。
// 第 184 行：连接签名和请求对象都未变才允许写回结果。
// 第 185 行：结束前面的代码块、资料列表或函数调用。
// 第 186 行：在 各厂家的查询任务 保存 厂家标识 对应的 request。
// 第 187 行：request的promise 改为 定义并立即执行初始化函数；内部步骤见下面各行。
// 第 188 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 189 行：准备 result（处理结果）：等待 请求账号模型列表（接口连接资料） 完成。
// 第 190 行：先确认当前请求仍有效，再处理结果。
// 第 191 行：如果 不满足（处理结果（存在时）的ok），执行下面这一组步骤。
// 第 192 行：准备 error（错误）：建立错误信息（modelFailureMessage的结果）。
// 第 193 行：错误的modelFailure 改为 处理结果。
// 第 194 行：报告错误并中断当前正常流程：错误。
// 第 195 行：结束前面的代码块、资料列表或函数调用。
// 第 196 行：准备 entries（资料列表）：去重并过滤适合文本请求的接口型号（（处理结果的entries 或 逐项转换 处理结果的models，转换规则为 一组字段（id））、厂家标识）。
// 第 197 行：各厂家的连接草稿的第 [厂家标识] 项 改为 一组字段（沿用已有字段、availableModels: map的结果、modelEntries: 资料列表、modelsCheckedAt: toISOString的结果）。
// 第 198 行：modelsCheckedAt 字段设为 调用 toISOString（所属对象：取得日期时间）。
// 第 199 行：从 各厂家的查询错误 删除 厂家标识。
// 第 200 行：准备 currentSelections：逐项转换 解释和翻译两个面板的控件资料，转换规则为 tab的select的value。
// 第 201 行：更新两个用途的型号选项。
// 第 202 行：重新绘制型号后尽量保留原来的选择。
// 第 203 行：准备 renderedSelections：逐项转换 解释和翻译两个面板的控件资料，转换规则为 tab的select的value。
// 第 204 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 列表 完成。
// 第 205 行：如果 不满足（检查 Key、地址和查询任务是否仍匹配），立即结束当前函数，不继续执行下面步骤。
// 第 207 行：对 解释和翻译两个面板的控件资料 每项执行 下方处理函数。
// 第 208 行：首次无缓存加载时，只为仍匹配已保存厂家的面板恢复已保存型号。
// 第 209 行：继续前一行的判断条件；本行补充 tab.manufacturer.value===provider && stored[tab.kind+'Manufacturer']===provider) {。
// 第 210 行：若旧型号仍在列表中，就恢复它，不把自动首项当用户选择。
// 第 211 行：结束前面的代码块、资料列表或函数调用。
// 第 212 行：结束前面的代码块、资料列表或函数调用。
// 第 213 行：准备 connections（各厂家的连接资料）：整理各厂家连接资料（已保存的数据的各厂家的连接草稿）。
// 第 214 行：各厂家的连接资料的第 [厂家标识] 项 改为 各厂家的连接草稿的第 [厂家标识] 项。
// 第 215 行：准备 updates（待保存的变化）：一组字段（providerConnections: 各厂家的连接资料、modelList: normalizeModels的结果）。
// 第 217 行：逐项读取 解释和翻译两个面板的控件资料，当前项记作 tab，执行下面步骤。
// 第 218 行：只更新已保存为当前厂家的用途；未保存的厂家草稿不写入后台。
// 第 219 行：已保存型号下架时改为新列表首项，没有可用项则留空。
// 第 220 行：结束前面的代码块、资料列表或函数调用。
// 第 221 行：结束前面的代码块、资料列表或函数调用。
// 第 222 行：等待 向浏览器本地存储保存 待保存的变化 完成。
// 第 223 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 224 行：如果 检查 Key、地址和查询任务是否仍匹配，执行下面这一组步骤。
// 第 225 行：准备 cached（缓存回答）：（取得当前厂家连接草稿（厂家标识）的modelEntries的length 或 取得当前厂家连接草稿（厂家标识）的availableModels的length）。
// 第 226 行：准备 message（消息或提示文字）：若 错误的modelFailure，用 把查询错误换成易读提示（错误的modelFailure、厂家标识）；否则用 “无法获取模型，请重新加载扩展后重试。”。
// 第 227 行：查询失败仍保留同一连接已有的型号列表，并显示原因。
// 第 228 行：向开发者工具记录诊断提示。
// 第 229 行：结束前面的代码块、资料列表或函数调用。
// 第 230 行：进入无论成功或失败都会执行的清理步骤。
// 第 231 行：如果 （从 各厂家的查询任务 读取 厂家标识 等于 request），从 各厂家的查询任务 删除 厂家标识。
// 第 232 行：显示当前连接或目录的错误。
// 第 233 行：结束前面的代码块、资料列表或函数调用。
// 第 234 行：结束初始化函数并立即执行，完成本文件的注册。
// 第 235 行：结束当前函数，并返回 request的promise。
// 第 236 行：结束前面的代码块、资料列表或函数调用。
// 第 238 行：定义异步函数 requestCatalogSnapshot：通过后台或恢复路径取得公开目录；接收 无参数。
// 第 239 行：准备 result（处理结果）：等待 后台通信无回复时使用本地恢复路径（一组字段、下方处理函数） 完成。
// 第 240 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 “catalogSnapshot” 完成。
// 第 241 行：准备 snapshot（保存的快照）：等待 不带用户 Key 刷新公开型号资料（已保存的数据的模型目录快照） 完成。
// 第 242 行：等待 向浏览器本地存储保存 一组字段 完成。
// 第 243 行：结束当前函数，并返回 一组字段（ok: 是（true）、snapshot）。
// 第 244 行：结束前面的代码块、资料列表或函数调用。
// 第 245 行：如果 不满足（处理结果的ok），报告错误并中断当前正常流程：建立错误信息（（处理结果的error 或 “后台未提供更新结果”））。
// 第 246 行：公开目录来源或结构不合法时停止使用该结果。
// 第 247 行：结束当前函数，并返回 一组字段（snapshot: 处理结果的保存的快照）。
// 第 248 行：结束前面的代码块、资料列表或函数调用。
// 第 249 行：定义异步函数 refreshCatalog：刷新公开目录并保留当前选择；接收 无参数。
// 第 250 行：如果 是否正在刷新公开目录，立即结束当前函数，不继续执行下面步骤。
// 第 251 行：是否正在刷新公开目录 改为 是（true）；更新公开目录提示。
// 第 252 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 253 行：准备 字段 snapshot：等待 通过后台或恢复路径取得公开目录 完成。
// 第 254 行：准备 selections：逐项转换 解释和翻译两个面板的控件资料，转换规则为 tab的select的value。
// 第 255 行：模型目录快照 改为 校验目录快照，缺失数据使用内置资料（保存的快照）。
// 第 256 行：重建厂家下拉选项；更新两个用途的型号选项。
// 第 257 行：对 解释和翻译两个面板的控件资料 每项执行 仅当选项存在时选择型号（tab、selections的按 序号 取得的项目）。
// 第 258 行：等待 向浏览器本地存储保存 一组字段 完成。
// 第 259 行：更新公开目录提示（catalogSnapshot.providers.some(p=>p.stale) ? '部分厂家的模型暂未更新，已保留已有列表。' : '' 的计算结果）。
// 第 260 行：捕获前面步骤的错误，记为 错误，按下面步骤处理。
// 第 261 行：更新公开目录提示（“暂时无法获取模型，已保留已有列表。”）。
// 第 262 行：向开发者工具记录诊断提示。
// 第 263 行：是否正在刷新公开目录 改为 否（false）。
// 第 264 行：结束前面的代码块、资料列表或函数调用。
// 第 266 行：对 在 document 中找到所有匹配 “.tab-btn” 的元素 每项执行 监听 button 的 “click” 事件，发生后执行处理函数。
// 第 267 行：点击用途标签时先记住当前 Key 草稿。
// 第 268 行：调用 close（所属对象：找到页面中 id 为 “custom-connection-dialog” 的控件）。
// 第 269 行：当前标签编号 改为 若 （button的dataset的tab 等于 “translate”），用 1；否则用 0。
// 第 270 行：切换标签按钮的 active 样式和辅助阅读选中状态。
// 第 271 行：切换对应面板的 active 样式与 hidden 状态。
// 第 272 行：显示当前厂家的连接和 Key 编辑状态；更新两个用途的型号选项。
// 第 273 行：结束前面的代码块、资料列表或函数调用。
// 第 274 行：监听 在 document 中找到首个匹配 “.tab-bar” 的元素 的 “keydown” 事件，发生后执行处理函数。
// 第 275 行：如果 不满足（检查 列表 [“ArrowLeft”、“ArrowRight”、“Home”、“End”] 是否包含 当前事件的字段名或 Key），立即结束当前函数，不继续执行下面步骤。
// 第 276 行：准备 buttons：列表 [展开或收集 在 document 中找到所有匹配 “.tab-btn” 的元素]。
// 第 277 行：准备 index（序号）：找 document的activeElement 在 buttons 中的位置。
// 第 278 行：如果 （序号 小于 0），立即结束当前函数，不继续执行下面步骤。
// 第 279 行：阻止浏览器对这次事件执行默认动作。
// 第 280 行：按左右方向、Home、End 计算下一个标签编号。
// 第 281 行：把键盘焦点放到 buttons的第 [next] 项；调用 click（所属对象：buttons的第 [next] 项）。
// 第 282 行：结束前面的代码块、资料列表或函数调用。
// 第 283 行：对 解释和翻译两个面板的控件资料 每项执行 监听 tab的manufacturer 的 “change” 事件，发生后执行处理函数。
// 第 284 行：如果 （tab 等于 解释和翻译两个面板的控件资料的第 [当前标签编号] 项），执行下面这一组步骤；记住正在编辑的 Key，变化时清旧型号；显示当前厂家的连接和 Key 编辑状态。
// 第 285 行：显示当前接口开放的文本型号（tab）。
// 第 286 行：刷新一个厂家型号并防止旧请求覆盖新设置（tab的manufacturer的待处理的值）。
// 第 287 行：结束前面的代码块、资料列表或函数调用。
// 第 288 行：逐项读取 列表 [“explain”、“translate”]，当前项记作 当前用途或内容类型，执行下面步骤。
// 第 289 行：准备 tab：从 解释和翻译两个面板的控件资料 找首个满足 （tab的kind 等于 当前用途或内容类型） 的项。
// 第 290 行：监听 找到页面中 id 为 （当前用途或内容类型 加上或拼接 “-thinking”） 的控件 的 “change” 事件，发生后执行处理函数。
// 第 291 行：监听 找到页面中 id 为 （当前用途或内容类型 加上或拼接 “-deepseek-thinking”） 的控件 的 “change” 事件，发生后执行处理函数。
// 第 292 行：结束前面的代码块、资料列表或函数调用。
// 第 293 行：监听 找到页面中 id 为 “rewrite-key” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 294 行：将 当前正在编辑的厂家 加到 正在编辑 Key 的厂家集合。
// 第 295 行：找到页面中 id 为 “key-editor” 的控件的hidden 改为 否（false）；找到页面中 id 为 “rewrite-key” 的控件的hidden 改为 是（true）；找到页面中 id 为 “key-saved” 的控件的hidden 改为 是（true）。
// 第 296 行：Key 输入框的value 改为 “”；把键盘焦点放到 Key 输入框。
// 第 297 行：结束前面的代码块、资料列表或函数调用。
// 第 298 行：监听 找到页面中 id 为 “cancel-key” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 299 行：从 正在编辑 Key 的厂家集合 删除 当前正在编辑的厂家。
// 第 300 行：准备 provider（厂家标识）：当前正在编辑的厂家。
// 第 301 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 “providerConnections” 完成。
// 第 302 行：各厂家的连接草稿的第 [厂家标识] 项 改为 （整理各厂家连接资料（已保存的数据的各厂家的连接草稿）的第 [厂家标识] 项 或 空资料对象 {}）。
// 第 303 行：如果 （当前正在编辑的厂家 等于 厂家标识），显示当前厂家的连接和 Key 编辑状态。
// 第 304 行：更新两个用途的型号选项。
// 第 305 行：结束前面的代码块、资料列表或函数调用。
// 第 306 行：监听 找到页面中 id 为 “save-key” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 307 行：保存 Key 前清掉输入两端空白，并记住正在保存的厂家。
// 第 308 行：如果 不满足（字段名或 Key），执行下面这一组步骤；找到页面中 id 为 “key-msg” 的控件的textContent 改为 “请输入 API Key。”；把键盘焦点放到 Key 输入框；立即结束当前函数，不继续执行下面步骤。
// 第 309 行：找到页面中 id 为 “save-key” 的控件的disabled 改为 是（true）。
// 第 310 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 311 行：记住正在编辑的 Key，变化时清旧型号。
// 第 312 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 列表 完成。
// 第 313 行：准备 connections（各厂家的连接资料）：整理各厂家连接资料（已保存的数据的各厂家的连接草稿）。
// 第 314 行：准备 changed：（各厂家的连接资料的第 [厂家标识] 项（存在时）的apiKey 不等于 字段名或 Key）。
// 第 315 行：各厂家的连接资料的第 [厂家标识] 项 改为 各厂家的连接草稿的第 [厂家标识] 项。
// 第 316 行：准备 updates（待保存的变化）：一组字段（providerConnections: 各厂家的连接资料、requiresApiSetup: 否（false））。
// 第 317 行：Key 真正变化时，清掉已保存为该厂家的用途型号，等待新列表重选。
// 第 318 行：等待 向浏览器本地存储保存 待保存的变化 完成。
// 第 319 行：各厂家已保存的 Key的第 [厂家标识] 项 改为 字段名或 Key；从 正在编辑 Key 的厂家集合 删除 厂家标识。
// 第 320 行：如果 （当前正在编辑的厂家 等于 厂家标识），显示当前厂家的连接和 Key 编辑状态。
// 第 321 行：更新两个用途的型号选项。
// 第 322 行：刷新一个厂家型号并防止旧请求覆盖新设置（厂家标识）。
// 第 323 行：捕获前面步骤的错误，记为 错误，按下面步骤处理；找到页面中 id 为 “key-msg” 的控件的textContent 改为 “保存失败，请重试。”。
// 第 324 行：找到页面中 id 为 “save-key” 的控件的disabled 改为 否（false）。
// 第 325 行：结束前面的代码块、资料列表或函数调用。
// 第 326 行：监听 找到页面中 id 为 “custom-connection-button” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 327 行：地址输入框的value 改为 取得当前厂家连接草稿（“custom”）的apiBaseUrl。
// 第 328 行：找到页面中 id 为 “custom-msg” 的控件的textContent 改为 “”。
// 第 329 行：调用 showModal（所属对象：找到页面中 id 为 “custom-connection-dialog” 的控件）；把键盘焦点放到 地址输入框。
// 第 330 行：结束前面的代码块、资料列表或函数调用。
// 第 331 行：监听 找到页面中 id 为 “custom-cancel” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 332 行：监听 找到页面中 id 为 “custom-save” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 333 行：准备 previous，暂不赋值。
// 第 334 行：找到页面中 id 为 “custom-save” 的控件的disabled 改为 是（true）。
// 第 335 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 336 行：准备 apiBaseUrl（接口基础地址）：检查地址并去掉末尾接口路径（地址输入框的待处理的值）。
// 第 337 行：previous 改为 取得当前厂家连接草稿（“custom”）。
// 第 339 行：地址换了就使旧地址查询失效；内存中暂时保留未保存 Key 草稿。
// 第 340 行：availableModels 字段设为 列表 []；modelEntries 字段设为 列表 []；modelsCheckedAt 字段设为 “”。
// 第 341 行：各厂家的连接草稿的custom 改为 draftProfile。
// 第 342 行：准备 stored（已保存的数据）：等待 从浏览器本地存储读取 列表 完成。
// 第 343 行：准备 connections（各厂家的连接资料）：整理各厂家连接资料（已保存的数据的各厂家的连接草稿）。
// 第 344 行：准备 saved：（各厂家的连接资料的custom 或 一组字段（apiKey: “”、availableModels: 列表、modelEntries: 列表、modelsCheckedAt: “”））。
// 第 345 行：准备 changed：（（saved的apiBaseUrl 或 “”） 不等于 接口基础地址）。
// 第 347 行：地址保存只使用已保存的连接资料，避免顺带保存 Key 草稿。
// 第 348 行：availableModels 字段设为 列表 []；modelEntries 字段设为 列表 []；modelsCheckedAt 字段设为 “”。
// 第 349 行：各厂家的连接资料的custom 改为 profile。
// 第 350 行：准备 updates（待保存的变化）：一组字段（providerConnections: 各厂家的连接资料）。
// 第 351 行：如果 changed，逐项读取 解释和翻译两个面板的控件资料，当前项记作 tab，执行下面步骤；如果 （已保存的数据的第 [（tab的kind 加上或拼接 “Manufacturer”）] 项 等于 “custom”），待保存的变化的第 [tab的key] 项 改为 “”。
// 第 352 行：等待 向浏览器本地存储保存 待保存的变化 完成。
// 第 353 行：保存地址后在内存恢复 Key 草稿；若草稿和已存 Key 不同就清旧列表。
// 第 354 行：如果 （draftProfile的apiKey 不等于 profile的apiKey），将后面资料的字段合入 各厂家的连接草稿的custom。
// 第 355 行：从 各厂家的查询错误 删除 “custom”。
// 第 356 行：调用 close（所属对象：找到页面中 id 为 “custom-connection-dialog” 的控件）；更新两个用途的型号选项。
// 第 357 行：刷新一个厂家型号并防止旧请求覆盖新设置（“custom”）。
// 第 358 行：捕获前面步骤的错误，记为 错误，按下面步骤处理；如果 previous，各厂家的连接草稿的custom 改为 previous；找到页面中 id 为 “custom-msg” 的控件的textContent 改为 错误的message。
// 第 359 行：找到页面中 id 为 “custom-save” 的控件的disabled 改为 否（false）。
// 第 360 行：结束前面的代码块、资料列表或函数调用。
// 第 361 行：监听 找到页面中 id 为 “save-btn” 的控件 的 “click” 事件，发生后执行处理函数。
// 第 362 行：尝试执行下面步骤；出错时转到 catch，finally 中的清理总会执行。
// 第 363 行：点击保存设置时，先捕获连接草稿并刷新控件状态。
// 第 364 行：更新两个用途的型号选项。
// 第 365 行：组装两个用途的型号、厂家、思考、语言和触发方式等设置。
// 第 366 行：explainThinkingEnabled 字段设为 找到页面中 id 为 “explain-thinking” 的控件的checked；explainReasoningEffort 字段设为 找到页面中 id 为 “explain-effort” 的控件的value。
// 第 367 行：translateThinkingEnabled 字段设为 找到页面中 id 为 “translate-thinking” 的控件的checked；translateReasoningEffort 字段设为 找到页面中 id 为 “translate-effort” 的控件的value。
// 第 368 行：explainDeepSeekThinkingEnabled 字段设为 找到页面中 id 为 “explain-deepseek-thinking” 的控件的checked。
// 第 369 行：translateDeepSeekThinkingEnabled 字段设为 找到页面中 id 为 “translate-deepseek-thinking” 的控件的checked。
// 第 370 行：language 字段设为 找到页面中 id 为 “explain-language” 的控件的value；targetLanguage 字段设为 找到页面中 id 为 “target-language” 的控件的value。
// 第 371 行：保存启用和上下文偏好，沿用此前值，不被其他设置草稿改变。
// 第 372 行：保存选定的划词触发方式，并标记 API 已配置。
// 第 373 行：等待 向浏览器本地存储保存 配置 完成。
// 第 374 行：逐项读取 取得 各厂家的连接草稿 的字段名和值配对列表，当前项记作 列表 [厂家标识、接口连接资料]，执行下面步骤；各厂家已保存的 Key的第 [厂家标识] 项 改为 接口连接资料的apiKey。
// 第 375 行：清空 正在编辑 Key 的厂家集合；显示当前厂家的连接和 Key 编辑状态。
// 第 376 行：显示操作结果并稍后清空（“设置已保存。”）。
// 第 377 行：准备 providers：建立不重复的 Set 集合（map的结果）。
// 第 378 行：逐项读取 providers，当前项记作 厂家标识，执行下面步骤；刷新一个厂家型号并防止旧请求覆盖新设置（厂家标识）。
// 第 379 行：捕获前面步骤的错误，记为 错误，按下面步骤处理；显示操作结果并稍后清空（“保存失败，请重试。”、“error”）。
// 第 380 行：结束前面的代码块、资料列表或函数调用。
// 第 382 行：开始设置页初始化。
// 第 383 行：读取并整理已保存配置。
// 第 384 行：显示扩展停用时的恢复入口。
// 第 385 行：模型名列表 改为 复制 配置的modelList 的列表内容。
// 第 386 行：模型目录快照 改为 校验目录快照，缺失数据使用内置资料（配置的模型目录快照）。
// 第 387 行：各厂家的连接草稿 改为 整理各厂家连接资料（配置的各厂家的连接草稿）。
// 第 388 行：各厂家已保存的 Key 改为 将 map的结果 的配对列表转为资料对象。
// 第 389 行：重建厂家下拉选项。
// 第 390 行：逐项读取 解释和翻译两个面板的控件资料，当前项记作 tab，执行下面步骤。
// 第 391 行：tab的manufacturer的value 改为 配置的第 [（tab的kind 加上或拼接 “Manufacturer”）] 项。
// 第 392 行：将该用途的深度思考状态填入复选框。
// 第 393 行：将 DeepSeek 总开关填入对应复选框。
// 第 394 行：找到页面中 id 为 （tab的kind 加上或拼接 “-effort”） 的控件的value 改为 （配置的第 [（tab的当前用途或内容类型 加上或拼接 "ReasoningEffort"）] 项 或 “high”）。
// 第 395 行：找到页面中 id 为 （tab的kind 加上或拼接 “-effort-section”） 的控件的style的display 改为 若 找到页面中 id 为 （tab的kind 加上或拼接 “-thinking”） 的控件的checked，用 “”；否则用 “none”。
// 第 396 行：结束前面的代码块、资料列表或函数调用。
// 第 397 行：找到页面中 id 为 “explain-language” 的控件的value 改为 （配置的language 或 “auto”）；找到页面中 id 为 “target-language” 的控件的value 改为 （配置的targetLanguage 或 “zh”）。
// 第 398 行：找到页面中 id 为 “trigger-mode” 的控件的value 改为 配置的triggerMode。
// 第 399 行：显示当前厂家的连接和 Key 编辑状态；更新两个用途的型号选项。
// 第 400 行：显示连接和型号选项后恢复已保存型号。
// 第 401 行：刷新公开目录并保留当前选择。
// 第 402 行：逐项读取 建立不重复的 Set 集合（map的结果），当前项记作 厂家标识，执行下面步骤；刷新一个厂家型号并防止旧请求覆盖新设置（厂家标识）。
// 第 403 行：初始化失败时显示读取设置失败提示。
