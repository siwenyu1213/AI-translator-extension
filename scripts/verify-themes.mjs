// 实际 Edge 解压扩展、隔离 storage、合成网页与本机 SSE；不使用真实 Key。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(), arg = name => process.argv[process.argv.indexOf(name)+1];
const {chromium} = createRequire(import.meta.url)(arg('--playwright'));
const output = resolve(root,'artifacts/qa/themes-2026-10-13');
const profile = resolve(root,'.local/browser-profile/themes',`run-${Date.now()}`);
mkdirSync(output,{recursive:true}); mkdirSync(profile,{recursive:true});
const checks=[],errors=[],requests=[];
let context,worker,popup,page,browserVersion;
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/sample')){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html><head><title>Theme synthetic sample</title><style>body{margin:24px;font:16px Arial;background:#fff;color:#222}article{margin-top:100px;width:600px;max-width:90vw}p{line-height:1.8}</style></head><body><article><p id="word">A moment of serendipity brings an unexpected discovery.</p><p id="paragraph">This is a synthetic paragraph for full page translation.</p></article></body></html>');return;
  }
  if(req.url.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end('{"data":[{"id":"qa-model"}]}');return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  if(req.url.endsWith('/chat/completions')){
    const request=JSON.parse(raw);requests.push({model:request.model});
    const items=[...(request.messages[1]?.content||'').matchAll(/<<<DS_ITEM_([A-Za-z0-9_]+)>>>([\s\S]*?)<<<DS_END_\1>>>/g)];
    const answer=items.length?items.map(item=>`<<<DS_ITEM_${item[1]}>>>本机模拟译文。<<<DS_END_${item[1]}>>>`).join('\n'):'# serendipity\n\n意外发现美好事物的机缘。\n\n## 在这句话中\n\n指偶然获得有价值的发现。\n\n`account` 与 **语境** 仅作排版示例。';
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    res.end('data: '+JSON.stringify({choices:[{delta:{content:answer}}]})+'\n\ndata: [DONE]\n\n');return;
  }
  res.writeHead(404);res.end('{}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function check(name,fn){try{const evidence=await fn();checks.push({name,status:'passed',evidence});console.log('PASSED: '+name);}catch(error){checks.push({name,status:'failed',error:error.message});throw error;}}
async function selectWord(){
  await page.evaluate(()=>{const el=document.querySelector('#word');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));const start=el.firstChild.data.indexOf('serendipity');const range=document.createRange();range.setStart(el.firstChild,start);range.setEnd(el.firstChild,start+11);getSelection().removeAllRanges();getSelection().addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));});
  await page.locator('#deepseek-explain-tooltip.ds-visible').waitFor();
  await page.waitForFunction(()=>document.querySelector('.ds-actions')?.style.display==='flex');
}
const snapshot=()=>worker.evaluate(()=>chrome.storage.local.get(['providerConnections','explainModel','translateModel','explainManufacturer','translateManufacturer','language','targetLanguage']));
async function setTheme(theme){await popup.locator('#ui-theme').selectOption(theme);await popup.waitForFunction(theme=>document.body.dataset.lcTheme===theme,theme);await popup.waitForFunction(()=>!document.querySelector('#ui-theme').disabled);}
const luminance=color=>{const values=color.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
try{
  context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:1000,height:850},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-first-run'],ignoreDefaultArgs:['--disable-extensions']});
  browserVersion=context.browser().version();
  await context.route('**/*',route=>!route.request().url().startsWith('http')||route.request().url().startsWith(base)?route.continue():route.abort());
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(base=>{const nativeFetch=fetch;globalThis.fetch=(url,init)=>String(url).startsWith(base)?nativeFetch(url,init):Promise.reject(Error('QA blocks external network'));},base);
  await worker.evaluate(()=>{AIModelCatalog.refresh=async()=>({...AIModelCatalog.BUILTIN,source:AIModelCatalog.SOURCE,providers:AIModelCatalog.BUILTIN.providers.map(provider=>({...provider,stale:false}))});});
  await worker.evaluate(()=>chrome.storage.local.clear());
  const url=`chrome-extension://${new URL(worker.url()).host}/popup.html`;
  popup=await context.newPage();popup.on('pageerror',e=>errors.push(e.message));await popup.setViewportSize({width:380,height:900});await popup.goto(url);
  await popup.waitForFunction(()=>document.querySelector('#explain-manufacturer').options.length===11);
  await check('旧配置和首次使用默认钴蓝纸页，三主题可选，删除 DeepSeek 提示',async()=>{
    await popup.evaluate(()=>LingoTheme.ready);
    assert.equal(await popup.locator('body').getAttribute('data-lc-theme'),'cobalt');
    assert.deepEqual(await popup.locator('#ui-theme option').evaluateAll(options=>options.map(o=>o.value)),['cobalt','playful','vellum']);
    assert.equal((await popup.locator('body').textContent()).includes('固定关闭思考'),false);
    assert.equal(await popup.locator('#api-key').isVisible(),true);
    await popup.locator('.container').screenshot({path:resolve(output,'first-run.png')});
  });
  await check('首次无 Key 也可独立保存主题，关闭并重开保留',async()=>{
    await setTheme('playful');assert.equal((await worker.evaluate(()=>chrome.storage.local.get('uiTheme'))).uiTheme,'playful');
    await popup.close();popup=await context.newPage();popup.on('pageerror',e=>errors.push(e.message));await popup.setViewportSize({width:380,height:900});await popup.goto(url);
    await popup.waitForFunction(()=>document.querySelector('#ui-theme').value==='playful');
  });
  await worker.evaluate(async base=>{await chrome.storage.local.set(AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,providerConfigVersion:1,enabled:true,triggerMode:'auto',language:'zh',targetLanguage:'zh',explainManufacturer:'custom',translateManufacturer:'custom',explainModel:'qa-model',translateModel:'qa-model',modelList:['qa-model'],providerConnections:{custom:{apiBaseUrl:base+'/v1',apiKey:'theme-synthetic-only',availableModels:['qa-model'],modelEntries:[{id:'qa-model'}],modelsCheckedAt:'2026-10-13'}}}));},base);
  await popup.reload();await popup.waitForFunction(()=>document.querySelector('#explain-model').value==='qa-model');
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/sample');await selectWord();
  const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
  await worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'TRIGGER_FULLPAGE_TRANSLATE'}),tabId);
  await page.locator('#ds-translate-toolbar').waitFor();
  await page.waitForFunction(()=>document.querySelector('.ds-tb-status').textContent==='翻译完成');
  await page.locator('#ds-tb-show-original').click();
  await selectWord();
  const before=await snapshot();
  for(const [theme,color]of[['cobalt','rgb(253, 250, 231)'],['playful','rgb(240, 200, 160)'],['vellum','rgb(42, 56, 112)']]){
    await check(`${theme} 即时同步设置/已打开结果/全文工具栏，连接和模型保持`,async()=>{
      await setTheme(theme);
      await page.waitForFunction(theme=>['deepseek-explain-tooltip','ds-translate-toolbar'].every(id=>document.getElementById(id)?.dataset.lcTheme===theme),theme);
      assert.deepEqual(await snapshot(),before);
      assert.equal(await popup.evaluate(()=>getComputedStyle(document.body).backgroundColor),color);
      assert.equal(await page.locator('#deepseek-explain-tooltip').evaluate(el=>getComputedStyle(el).backgroundColor),color);
      await popup.evaluate(()=>document.fonts.ready);await page.evaluate(()=>document.fonts.ready);
      await popup.locator('.container').screenshot({path:resolve(output,`${theme}-settings.png`)});
      await page.locator('#deepseek-explain-tooltip').screenshot({path:resolve(output,`${theme}-result.png`)});
      await page.screenshot({path:resolve(output,`${theme}-result-toolbar.png`)});
      return{color};
    });
    await check(`${theme} 正文/提示/按钮文本对比度与本地字体`,async()=>{
      const colors=await popup.evaluate(()=>{const body=getComputedStyle(document.body),hint=getComputedStyle(document.querySelector('#theme-status')),button=getComputedStyle(document.querySelector('#save-btn'));return{bg:body.backgroundColor,ink:body.color,muted:hint.color,button:button.backgroundColor,on:button.color};});
      for(const value of[ratio(colors.bg,colors.ink),ratio(colors.bg,colors.muted),ratio(colors.button,colors.on)])assert.ok(value>=4.5,String(value));
      const family=theme==='playful'?'LC Space':'LC Inter';
      for(const surface of[popup,page]){
        const faces=await surface.evaluate(()=>[...document.fonts].map(face=>({family:face.family,status:face.status})));
        assert.equal(faces.some(face=>face.family.replaceAll('"','')===family&&face.status==='loaded'),true,JSON.stringify({surface:surface===popup?'popup':'page',faces}));
      }
      return colors;
    });
  }
  await check('切主题不保存模型/语言/Key 草稿，保存设置不回退主题',async()=>{
    await popup.locator('#explain-language').selectOption('en');await popup.locator('#rewrite-key').click();await popup.locator('#api-key').fill('unsaved-synthetic-draft');
    await setTheme('playful');assert.deepEqual(await snapshot(),before);assert.equal(await popup.locator('#api-key').inputValue(),'unsaved-synthetic-draft');
    await popup.locator('#cancel-key').click();await popup.locator('#save-btn').click();
    await popup.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('uiTheme'))).uiTheme,'playful');
  });
  await check('主题写入失败给出提示并恢复已保存选择',async()=>{
    await popup.evaluate(()=>{globalThis.qaThemeStorageSet=chrome.storage.local.set;chrome.storage.local.set=(value)=>Object.hasOwn(value,'uiTheme')?Promise.reject(Error('synthetic write failure')):qaThemeStorageSet(value);});
    await popup.locator('#ui-theme').selectOption('vellum');await popup.waitForFunction(()=>document.querySelector('#theme-status').textContent.includes('保存失败'));
    assert.equal(await popup.locator('#ui-theme').inputValue(),'playful');assert.equal(await popup.locator('body').getAttribute('data-lc-theme'),'playful');
    await popup.evaluate(()=>{chrome.storage.local.set=qaThemeStorageSet;delete globalThis.qaThemeStorageSet;});
  });
  await check('损坏或已删除的主题值回退钴蓝，现有网页同步',async()=>{
    await worker.evaluate(()=>chrome.storage.local.set({uiTheme:'unknown-theme'}));await popup.waitForFunction(()=>document.body.dataset.lcTheme==='cobalt');
    await page.waitForFunction(()=>document.querySelector('#deepseek-explain-tooltip').dataset.lcTheme==='cobalt');
    await worker.evaluate(()=>chrome.storage.local.remove('uiTheme'));await popup.reload();await popup.waitForFunction(()=>document.querySelector('#ui-theme').value==='cobalt');
  });
  await check('键盘切换两用途、隐藏面板不可聚焦，主题控件键盘可用',async()=>{
    await popup.locator('#tab-explain').focus();await popup.keyboard.press('ArrowRight');assert.equal(await popup.locator('#tab-translate').getAttribute('aria-selected'),'true');assert.equal(await popup.locator('#panel-explain').isVisible(),false);
    await popup.keyboard.press('Home');assert.equal(await popup.locator('#tab-explain').getAttribute('aria-selected'),'true');await popup.locator('#ui-theme').focus();
    assert.equal(await popup.evaluate(()=>document.activeElement.id),'ui-theme');
  });
  await check('320px 设置页与375px结果/工具栏无横向溢出，网页本身样式不变',async()=>{
    await popup.setViewportSize({width:320,height:600});assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:375,height:650});
    const geometry=await page.locator('#ds-translate-toolbar').evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth};});assert.ok(geometry.left>=0&&geometry.right<=geometry.width);
    const pageColors=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily}));assert.equal(pageColors.bg,'rgb(255, 255, 255)');assert.equal(pageColors.font,'Arial');
    await popup.setViewportSize({width:380,height:900});
  });
  await check('本地品牌PNG尺寸与清单一致、界面/工具栏使用同一引号图标',async()=>{
    for(const size of[16,32,48,128]){const data=readFileSync(resolve(root,`icons/icon${size}.png`));assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);}
    const brand=await popup.locator('.lc-brand-icon').evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(brand.includes('/icons/brand.svg'));
    const contentBrand=await page.locator('#deepseek-explain-tooltip .lc-brand-icon').evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(contentBrand.startsWith('url("chrome-extension://'));
    assert.equal(await page.evaluate(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth===128);image.onerror=()=>resolve(false);image.src=url;}),contentBrand.slice(5,-2)),true);
    assert.equal(await page.locator('.lc-brand-icon').count(),2);return{sizes:[16,32,48,128]};
  });
  await check('全文原文切换/取消、浮层关闭在主题切换后正常',async()=>{
    await page.locator('#ds-tb-show-original').click();assert.equal(await page.locator('#ds-tb-show-original').textContent(),'显示原文');await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#ds-translate-toolbar').count(),0);
    await selectWord();await page.locator('.ds-close').click();assert.equal(await page.locator('#deepseek-explain-tooltip').evaluate(el=>el.classList.contains('ds-hidden')),true);
  });
  await check('新网页与重新打开设置继续使用保存主题，无脚本错误',async()=>{
    await setTheme('vellum');await popup.reload();await popup.waitForFunction(()=>document.querySelector('#ui-theme').value==='vellum');
    await page.goto(base+'/sample-new');await selectWord();assert.equal(await page.locator('#deepseek-explain-tooltip').getAttribute('data-lc-theme'),'vellum');assert.deepEqual(errors,[]);
  });
}catch(error){console.error(error);process.exitCode=1;}
finally{
  writeFileSync(resolve(output,'report.json'),JSON.stringify({date:'2026-10-13 Asia/Shanghai',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browserVersion,profile:relative(root,profile),checks,errors,requests,scope:'Actual Edge extension DOM/storage with localhost synthetic SSE; native toolbar popup and real provider APIs unverified'},null,2)+'\n');
  await context?.close();await new Promise(resolve=>server.close(resolve));
}
