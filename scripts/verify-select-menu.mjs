// 实际Edge解压扩展；合成模型与本机SSE，验证自绘菜单/字体，不读取日常配置。
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),arg=name=>process.argv[process.argv.indexOf(name)+1];
const {chromium}=createRequire(import.meta.url)(arg('--playwright'));
const output=resolve(root,process.argv.includes('--output')?arg('--output'):'artifacts/qa/select-menu');
mkdirSync(output,{recursive:true});
const checks=[],errors=[];let context,popup,worker,page;
const models=Array.from({length:24},(_,i)=>({id:'reading-model-'+i,name:'Reading '+i}));
const server=createServer(async(req,res)=>{
  if(req.url.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:models}));return;}
  if(req.url.startsWith('/sample')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Menu font QA</title><p id="word">serendipity</p>');return;}
  for await(const chunk of req){}
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.end('data: '+JSON.stringify({choices:[{delta:{content:'# serendipity\n\n意外发现美好事物的机缘。'}}]})+'\n\ndata: [DONE]\n\n');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
async function check(name,fn){try{const evidence=await fn();checks.push({name,status:'passed',evidence});console.log('PASSED: '+name);}catch(error){checks.push({name,status:'failed',error:error.message});throw error;}}
async function fontsFor(surface,selector){
  const client=await context.newCDPSession(surface);await client.send('DOM.enable');await client.send('CSS.enable');
  const {root:doc}=await client.send('DOM.getDocument');const {nodeId}=await client.send('DOM.querySelector',{nodeId:doc.nodeId,selector});
  const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId});await client.detach();return fonts;
}
try{
  context=await chromium.launchPersistentContext(resolve(root,'.local/browser-profile/select-menu/run-'+Date.now()),{channel:'msedge',headless:true,viewport:{width:1000,height:750},args:['--disable-extensions-except='+root,'--load-extension='+root,'--no-first-run'],ignoreDefaultArgs:['--disable-extensions']});
  await context.route('**/*',route=>!route.request().url().startsWith('http')||route.request().url().startsWith(base)?route.continue():route.abort());
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async base=>{const nativeFetch=fetch;globalThis.fetch=(url,init)=>String(url).startsWith(base)?nativeFetch(url,init):Promise.reject(Error('QA blocks external network'));AIModelCatalog.refresh=async()=>({...AIModelCatalog.BUILTIN,providers:AIModelCatalog.BUILTIN.providers.map(p=>({...p,stale:false}))});await chrome.storage.local.set(AIConfig.migrate({apiConfigVersion:1,providerConfigVersion:1,modelCatalogVersion:1,explainManufacturer:'custom',translateManufacturer:'custom',explainModel:'reading-model-0',translateModel:'reading-model-0',language:'zh',providerConnections:{custom:{apiKey:'synthetic-menu-only',apiBaseUrl:base+'/v1',availableModels:Array.from({length:24},(_,i)=>'reading-model-'+i)}}}));},base);
  const url='chrome-extension://'+new URL(worker.url()).host+'/popup.html';
  popup=await context.newPage();popup.on('pageerror',error=>errors.push(error.message));await popup.setViewportSize({width:390,height:600});await popup.goto(url);
  await popup.waitForFunction(()=>document.querySelector('#explain-model').options.length===24&&!!globalThis.LingoSelects);
  await popup.evaluate(()=>document.fonts.ready);
  await check('中文标题和英文字体实际来自本地设计字体',async()=>{
    const title=await fontsFor(popup,'.title'),latin=await fontsFor(popup,'#explain-model-value');
    assert.ok(title.some(f=>f.isCustomFont&&/WenKai/i.test(f.familyName)),JSON.stringify(title));
    assert.ok(latin.some(f=>f.isCustomFont&&/Space/i.test(f.familyName)),JSON.stringify(latin));
    assert.equal(await popup.locator('.lc-select-trigger').count(),await popup.locator('select').count());
    return{title,latin};
  });
  await check('厂家菜单自绘、勾选与边界，点击外部关闭',async()=>{
    await popup.evaluate(()=>{const nativeFetch=fetch;globalThis.fetch=(url,init)=>String(url).includes('api.deepseek.com')?Promise.resolve(Response.json({data:[{id:'deepseek-flash'}]})):nativeFetch(url,init);});
    await popup.locator('#explain-manufacturer-trigger').click();
    await popup.getByRole('option',{name:'DeepSeek',exact:true}).click();
    await popup.waitForFunction(()=>document.querySelector('#explain-manufacturer').value==='deepseek');
    await popup.locator('#explain-manufacturer-trigger').click();
    assert.equal(await popup.locator('#explain-manufacturer-trigger').getAttribute('aria-expanded'),'true');
    assert.equal(await popup.getByRole('option',{name:'DeepSeek',exact:true}).getAttribute('aria-selected'),'true');
    await popup.locator('.lc-select-menu:popover-open .lc-select-list').evaluate(el=>el.scrollTop=0);
    await popup.screenshot({path:resolve(output,'manufacturer-open.png')});
    await popup.locator('.title').click();
    assert.equal(await popup.locator('.lc-select-menu:popover-open').count(),0);
    await popup.locator('#explain-manufacturer').selectOption('custom');
    await popup.waitForFunction(()=>document.querySelector('#explain-model').options.length===24);
  });
  await check('长型号列表搜索、无结果、选择回写和保存重开',async()=>{
    await popup.locator('#explain-model-trigger').click();
    const menu=popup.locator('.lc-select-menu:popover-open');
    await menu.locator('input').fill('not-found');assert.equal(await menu.locator('.lc-select-empty').isVisible(),true);
    await menu.locator('input').fill('Reading 17');await popup.getByRole('option',{name:'Reading 17',exact:true}).click();
    assert.equal(await popup.locator('#explain-model').inputValue(),'reading-model-17');assert.equal(await popup.locator('#explain-model-value').textContent(),'Reading 17');
    await popup.locator('#save-btn').click();await popup.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));
    await popup.reload();await popup.waitForFunction(()=>document.querySelector('#explain-model').value==='reading-model-17');
    await popup.waitForFunction(()=>document.querySelector('#explain-model-value').textContent==='Reading 17');
  });
  await check('菜单键盘上下/Home/End/Enter/Escape和Tab退出',async()=>{
    const button=popup.locator('#explain-language-trigger');await button.focus();await popup.keyboard.press('ArrowDown');await popup.keyboard.press('End');await popup.keyboard.press('Enter');
    assert.equal(await popup.locator('#explain-language').inputValue(),'en');
    await popup.keyboard.press('Space');await popup.keyboard.press('Home');await popup.keyboard.press('Enter');assert.equal(await popup.locator('#explain-language').inputValue(),'auto');
    await popup.keyboard.press('Space');await popup.keyboard.press('ArrowDown');await popup.keyboard.press('Escape');assert.equal(await popup.locator('#explain-language').inputValue(),'auto');
    assert.equal(await popup.evaluate(()=>document.activeElement.id),'explain-language-trigger');
    await popup.keyboard.press('Space');await popup.keyboard.press('Tab');assert.equal(await popup.locator('.lc-select-menu:popover-open').count(),0);
  });
  await check('用途切换和异步厂家列表同步，停用模型不打开菜单',async()=>{
    await popup.locator('#explain-manufacturer-trigger').click();await popup.getByRole('option',{name:'OpenAI',exact:true}).click();
    await popup.waitForFunction(()=>document.querySelector('#explain-model-trigger').disabled);
    assert.equal(await popup.locator('#explain-model-trigger').isDisabled(),true);
    await popup.locator('#tab-translate').click();assert.equal(await popup.locator('#translate-model-trigger').isEnabled(),true);
    await popup.locator('#tab-explain').click();await popup.locator('#explain-manufacturer').selectOption('custom');
    await popup.waitForFunction(()=>!document.querySelector('#explain-model-trigger').disabled);
  });
  await check('三配色和260/320/390px菜单边界、滚动关闭',async()=>{
    const bounds=[];
    for(const theme of ['cobalt','playful','vellum']){
      await popup.locator('#ui-theme').selectOption(theme);await popup.waitForFunction(theme=>document.body.dataset.lcTheme===theme,theme);
      for(const width of [260,320,390]){
        await popup.setViewportSize({width,height:600});await popup.locator('#explain-model-trigger').click();
        const rect=await popup.locator('.lc-select-menu:popover-open').evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,limit:Math.min(innerHeight,document.body.getBoundingClientRect().bottom)};});
        assert.ok(rect.left>=0&&rect.right<=rect.width&&rect.top>=0&&rect.bottom<=rect.limit+1,JSON.stringify(rect));bounds.push({theme,width,...rect});
        await popup.keyboard.press('Escape');
      }
    }
    await popup.setViewportSize({width:390,height:600});await popup.locator('#ui-theme').selectOption('cobalt');
    await popup.setViewportSize({width:390,height:320});await popup.evaluate(()=>window.scrollTo(0,0));
    await popup.locator('#explain-model-trigger').click();await popup.evaluate(()=>window.scrollBy(0,25));await popup.waitForFunction(()=>!document.querySelector('.lc-select-menu:popover-open'));
    await popup.setViewportSize({width:390,height:600});
    return bounds;
  });
  await check('结果浮层中文也使用文楷，未改宿主网页字体',async()=>{
    page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/sample');
    await page.evaluate(()=>{const el=document.querySelector('#word');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));});
    await page.waitForFunction(()=>document.querySelector('.ds-actions')?.style.display==='flex');await page.evaluate(()=>document.fonts.ready);
    const fonts=await fontsFor(page,'.ds-body p');assert.ok(fonts.some(f=>f.isCustomFont&&/WenKai/i.test(f.familyName)),JSON.stringify(fonts));
    await page.locator('#deepseek-explain-tooltip').screenshot({path:resolve(output,'result.png')});
    await popup.locator('#tab-explain').click();await popup.evaluate(()=>window.scrollTo(0,0));await popup.locator('body').screenshot({path:resolve(output,'settings.png')});
    return fonts;
  });
  assert.deepEqual(errors,[]);
}catch(error){console.error(error);process.exitCode=1;}
finally{
  writeFileSync(resolve(output,'report.json'),JSON.stringify({date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:context?.browser().version(),node:process.version,checks,errors,scope:'Actual isolated Edge extension and localhost SSE; native toolbar popup shell and real providers unverified'},null,2)+'\n');
  await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
}
