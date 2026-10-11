// Verify review findings through the installed extension, actual Edge ports and localhost SSE.
// A confirmed defect is a successful reproduction, not a successful product acceptance test.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv.includes('--playwright')?arg('--playwright'):'playwright');
const output=resolve(root,'artifacts/qa/adversarial-validation-2026-10-11/browser');
const profile=resolve(root,'.local/browser-profile/adversarial-validation',`browser-${Date.now()}`);
mkdirSync(output,{recursive:true});
const results=[],controls=[],requests=[],pending=[],sockets=new Set();
let html='',mode='normal',context,worker,browserVersion,currentPage;
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/sample/')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><title>Synthetic validation fixture</title></head><body>'+html+'</body></html>');return;}
 if(req.url.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'test-chat'}]}));return;}
 if(!req.url.endsWith('/chat/completions')){res.writeHead(404);res.end('{}');return;}
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw),prompt=body.messages[1].content;
 const items=[...prompt.split('\n输出要求：')[0].matchAll(/<<<DS_ITEM_([A-Za-z0-9_]+)>>>([\s\S]*?)<<<DS_END_\1>>>/g)].map(m=>({id:m[1],text:m[2].trim()}));
 const request={path:req.url,model:body.model,prompt,batch:items.length>0,authenticated:req.headers.authorization==='Bearer synthetic-validation-only'};
 requests.push(request);
 const requestMode=mode;
 const complete=()=>{
  if(res.destroyed||res.writableEnded)return;
  if(requestMode==='explain-error'){res.writeHead(400,{'Content-Type':'application/json'});res.end('{"error":{"message":"synthetic unsupported generation"}}');return;}
  const content=items.length?(requestMode==='batch-fail'?'invalid synthetic batch':items.map(item=>`<<<DS_ITEM_${item.id}>>>译文：${item.text}<<<DS_END_${item.id}>>>`).join('\n')):'SYNTHETIC TRANSLATION RESULT';
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.end(`data: ${JSON.stringify({choices:[{delta:{content}}]})}\n\ndata: [DONE]\n\n`);
 };
 if(requestMode==='manual'||requestMode==='disconnect'||(requestMode==='batch-fail'&&!items.length))pending.push({complete,res});
 else complete();
});
server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
async function until(predicate,timeout=10000){const start=Date.now();while(!await predicate()){if(Date.now()-start>timeout)throw new Error('Condition timed out');await new Promise(r=>setTimeout(r,30));}}
async function check(id,title,fn){try{results.push({id,title,status:'confirmed',...(await fn())});console.log(`CONFIRMED ${id}: ${title}`);}catch(e){results.push({id,title,status:e.code==='ERR_ASSERTION'?'not_reproduced':'check_failed',error:e.message});process.exitCode=1;console.error(`${id}: ${e.message}`);}}
async function seed(targetLanguage='zh'){
 await worker.evaluate(async({base,targetLanguage})=>{
  const config=AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,providerConfigVersion:1,
   enabled:true,usePageContext:true,triggerMode:'auto',language:'auto',targetLanguage,
   modelList:['test-chat'],explainModel:'test-chat',translateModel:'test-chat',
   explainManufacturer:'custom',translateManufacturer:'custom',providerConnections:{custom:{apiBaseUrl:base+'/v1',apiKey:'synthetic-validation-only',availableModels:['test-chat'],modelEntries:[{id:'test-chat'}],modelsCheckedAt:new Date().toISOString()}}});
  await chrome.storage.local.clear();await chrome.storage.local.set(config);
  CACHE.clear();configCache=null;globalThis.validationStats={fetchStarts:0,pending:0,maxPending:0,ports:0};
 },{base,targetLanguage});
}
let sampleSeq=0;
async function sample(markup,scenario='normal',target='zh'){
 if(currentPage){await currentPage.close();currentPage=null;}
 for(const p of pending.splice(0)){if(!p.res.destroyed)p.res.destroy();}
 mode=scenario;html=markup;requests.length=0;
 await seed(target);
 const page=await context.newPage();currentPage=page;await page.goto(`${base}/sample/${sampleSeq++}`);
 await page.waitForTimeout(120);
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
 return {page,tabId};
}
async function triggerFull(tabId){await worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'TRIGGER_FULLPAGE_TRANSLATE'}),tabId);await currentPage.locator('#ds-translate-toolbar').waitFor();}
async function fullDone(page){await page.waitForFunction(()=>{const nums=document.querySelector('#ds-tb-progress')?.textContent.split('/').map(Number);return nums?.[1]>0&&nums[0]===nums[1];});}
async function select(page,selector,start=0,end){await page.evaluate(({selector,start,end})=>{const el=document.querySelector(selector),node=el.firstChild;const range=document.createRange();range.setStart(node,start);range.setEnd(node,end??node.length);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));},{selector,start,end});}
try{
 context=await chromium.launchPersistentContext(profile,{...(process.argv.includes('--edge')?{executablePath:arg('--edge')}:{channel:'msedge'}),headless:true,viewport:{width:1100,height:900},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-first-run'],ignoreDefaultArgs:['--disable-extensions']});
 browserVersion=context.browser()?.version();
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:20000});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 // Instrumentation delegates every fetch to the native implementation; it does not fake ports.
 await worker.evaluate(()=>{
  globalThis.validationNativeFetch=fetch;globalThis.validationPorts=[];
  chrome.runtime.onConnect.addListener(port=>{if(port.name.startsWith('stream-')){validationPorts.push(port);validationStats.ports++;port.onDisconnect.addListener(()=>{globalThis.validationDisconnects=(globalThis.validationDisconnects||0)+1;});}});
  globalThis.fetch=async(...args)=>{
   if(!String(args[0]).endsWith('/chat/completions'))return validationNativeFetch(...args);
   const stats=validationStats;stats.fetchStarts++;stats.pending++;stats.maxPending=Math.max(stats.maxPending,stats.pending);
   try{return await validationNativeFetch(...args);}finally{stats.pending--;}
  };
 });
 await check('R01','page text update is overwritten by stale translation and restore',async()=>{
  const {page,tabId}=await sample('<p id="p">Original source paragraph.</p>','manual');await triggerFull(tabId);await until(()=>requests.length===1);
  await page.evaluate(()=>document.querySelector('#p').firstChild.data='New app state while translating.');pending.splice(0).forEach(p=>p.complete());await fullDone(page);
  const afterResponse=await page.locator('#p').textContent();await page.locator('#ds-tb-cancel').click();const afterCancel=await page.locator('#p').textContent();
  assert.equal(afterResponse,'SYNTHETIC TRANSLATION RESULT');assert.equal(afterCancel,'Original source paragraph.');return{observed:{afterResponse,afterCancel,expectedCurrentPageState:'New app state while translating.'}};
 });
 await check('R02','moving a translated DOM node loses its original snapshot',async()=>{
  const {page,tabId}=await sample('<div id="old"><p id="p">Original movable paragraph.</p></div><div id="new"></div>');await triggerFull(tabId);await fullDone(page);
  await page.evaluate(()=>document.querySelector('#new').appendChild(document.querySelector('#p')));await page.waitForTimeout(150);await page.locator('#ds-tb-cancel').click();
  const text=await page.locator('#p').textContent(),mark=await page.locator('#p').getAttribute('data-ds-translated');assert.equal(text,'SYNTHETIC TRANSLATION RESULT');assert.equal(mark,'true');return{observed:{textAfterCancel:text,translationAttribute:mark}};
 });
 await check('R03','editable drafts and descendants of skipped containers are requested',async()=>{
  const {page,tabId}=await sample('<div data-ds-skip><p id="skip">Protected source text.</p></div><pre><div id="code">const source = "private synthetic code";</div></pre><div contenteditable="true"><p id="draft">My unsaved synthetic draft.</p></div>');await triggerFull(tabId);await fullDone(page);
  const prompt=requests.map(r=>r.prompt).join('\n');for(const term of ['Protected source text.','private synthetic code','My unsaved synthetic draft.'])assert.ok(prompt.includes(term));
  const texts=await page.locator('#skip,#code,#draft').allTextContents();assert.ok(texts.every(t=>t.includes('译文：')));return{observed:{sentEditableDraft:true,texts,requestCount:requests.length}};
 });
 await check('R04','fallback creates more than 50 simultaneously pending native fetch calls',async()=>{
  const {page,tabId}=await sample('<style>p{position:absolute;top:100px;left:0}</style>'+Array.from({length:512},(_,i)=>`<p>Unique source paragraph ${i}.</p>`).join(''),'batch-fail');await triggerFull(tabId);
  try {
   await until(()=>worker.evaluate(()=>validationStats.maxPending>50),10000);
   await page.waitForTimeout(250);
   const observed=await worker.evaluate(()=>({fetchStarts:validationStats.fetchStarts,pendingFetches:validationStats.pending,maxPendingFetches:validationStats.maxPending,createdPorts:validationStats.ports}));
   observed.serverReceivedSingles=requests.filter(r=>!r.batch).length;observed.serverReceivedBatches=requests.filter(r=>r.batch).length;
   assert.ok(observed.maxPendingFetches>50);
   return{observed,boundary:'Native fetch invocations include requests waiting in the browser network pool; this is not a claim of 512 simultaneous TCP connections or provider billing events.'};
  } finally {await page.locator('#ds-tb-cancel').click();}
 });
 await check('R06','translation erases the visible label of an existing link',async()=>{
  const original='Read the documentation carefully.';const {page,tabId}=await sample('<p id="p">Read the <a href="/details">documentation</a> carefully.</p>');await triggerFull(tabId);await fullDone(page);
  const label=await page.locator('#p a').textContent(),href=await page.locator('#p a').getAttribute('href');assert.equal(label,'');assert.equal(href,'/details');
  await page.screenshot({path:resolve(output,'R06-link.png')});await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#p').textContent(),original);assert.equal(await page.locator('#p a').textContent(),'documentation');controls.push({case:'static paragraph and link restore on cancel',status:'passed'});return{observed:{labelDuringTranslation:label,href,restoredLabel:'documentation'}};
 });
 await check('R07','French to English and Chinese to Japanese are skipped without requests',async()=>{
  const observed=[];for(const [source,target]of[['Bonjour, cette phrase est seulement en français.','en'],['这里是一段需要翻译成日语的中文内容。','ja']]){
   const {page,tabId}=await sample(`<p>${source}</p>`,'normal',target);await triggerFull(tabId);await page.waitForTimeout(350);const status=await page.locator('.ds-tb-status').textContent();assert.equal(requests.length,0);assert.ok(status.includes('已是目标语言'));observed.push({source,target,requestCount:requests.length,status});
  }return{observed};
 });
 await check('R08','new inline text in an existing translated block is not scanned',async()=>{
  const {page,tabId}=await sample('<p id="p">Initial synthetic content.</p>');await triggerFull(tabId);await fullDone(page);const before=requests.length;
  await page.evaluate(()=>{const span=document.createElement('span');span.id='added';span.textContent=' Newly added untranslated text.';document.querySelector('#p').append(span);});await page.waitForTimeout(500);
  assert.equal(requests.length,before);assert.equal(await page.locator('#added').textContent(),' Newly added untranslated text.');return{observed:{requestCountBefore:before,requestCountAfter:requests.length,newText:await page.locator('#added').textContent()}};
 });
 await check('R10','unexpected real port disconnect blocks retry of the same selection',async()=>{
  const {page,tabId}=await sample('<p id="word">retry this synthetic phrase</p>','disconnect');await select(page,'#word');await until(()=>requests.length===1);
  await worker.evaluate(()=>validationPorts.at(-1).disconnect());await page.locator('.ds-body').filter({hasText:'连接中断'}).waitFor();
  const before=requests.length;await worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'TRIGGER_EXPLAIN',text:'retry this synthetic phrase'}),tabId);await page.waitForTimeout(400);
  assert.equal(requests.length,before);const errorElement=await page.locator('.ds-error').count();assert.equal(errorElement,0);
  await page.keyboard.press('Escape');mode='normal';await worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'TRIGGER_EXPLAIN',text:'retry this synthetic phrase'}),tabId);await until(()=>requests.length===before+1);controls.push({case:'closing card allows same selection to retry',status:'passed'});return{observed:{requestsBeforeRetry:before,requestsAfterVisibleRetry:before,errorElement,requestsAfterClose:requests.length}};
 });
 await check('R11','explain failure retains stale result for actual clipboard copy',async()=>{
  const {page}=await sample('<p id="long">This synthetic paragraph contains more than ten separate English words for translation.</p>');await select(page,'#long');await page.locator('.ds-btn-explain-this').waitFor();
  mode='explain-error';await page.locator('.ds-btn-explain-this').click();await page.locator('.ds-error').waitFor();const error=await page.locator('.ds-body').textContent();
  await page.locator('.ds-btn-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(copied,'SYNTHETIC TRANSLATION RESULT');await page.screenshot({path:resolve(output,'R11-stale-copy.png')});return{observed:{visibleError:error,actualClipboard:copied}};
 });
 await check('R12','second occurrence selection sends first occurrence context to localhost API',async()=>{
  const source='The bank raised rates. Along the river, the bank was muddy.';const {page}=await sample(`<p id="p">${source}</p>`);const offset=source.lastIndexOf('bank');await select(page,'#p',offset,offset+4);await until(()=>requests.length===1);
  const prompt=requests[0].prompt;assert.ok(prompt.includes('上文：The \n'));assert.ok(!prompt.includes('上文：The bank raised rates. Along the river, the '));return{observed:{selectedOffset:offset,actualBefore:'The ',expectedBefore:source.slice(0,offset),capturedPrompt:prompt}};
 });
 // Delay delivery of a real chrome.storage read. AIConfig.load and its caller are unchanged.
 async function holdNativeStorageRead(){
  await worker.evaluate(()=>{
   globalThis.validationNativeStorageGet=chrome.storage.local.get.bind(chrome.storage.local);
   globalThis.validationReadGate={captured:false,used:false};
   validationReadGate.delivery=new Promise(resolve=>validationReadGate.release=resolve);
   chrome.storage.local.get=async keys=>{
    const snapshot=await validationNativeStorageGet(keys);
    if(keys===null&&!validationReadGate.used){validationReadGate.used=true;validationReadGate.captured=true;await validationReadGate.delivery;}
    return snapshot;
   };
   configCache=null;
  });
 }
 async function restoreNativeStorageRead(){await worker.evaluate(()=>{validationReadGate.release();chrome.storage.local.get=validationNativeStorageGet;});}
 await check('R05','actual Worker caches an old native storage read after real onChanged',async()=>{
  const {page}=await sample('<p id="race">synthetic configuration race</p>');await holdNativeStorageRead();
  try {
   await worker.evaluate(()=>{globalThis.validationOldLoad=getConfig();});await until(()=>worker.evaluate(()=>validationReadGate.captured));
   const oldRevision=await worker.evaluate(()=>cacheRevision);
   await worker.evaluate(async base=>{
    const current=await validationNativeStorageGet(null);
    await chrome.storage.local.set({...current,modelList:['test-chat','new-chat'],explainModel:'new-chat',translateModel:'new-chat',targetLanguage:'ja',
     providerConnections:{custom:{...current.providerConnections.custom,apiBaseUrl:base+'/new/v1',availableModels:['new-chat'],modelEntries:[{id:'new-chat'}]}}});
   },base);
   await until(()=>worker.evaluate(old=>cacheRevision>old,oldRevision));
   await worker.evaluate(()=>validationReadGate.release());await worker.evaluate(()=>validationOldLoad);
   await select(page,'#race');await until(()=>requests.length===1);
   const observed=await worker.evaluate(async()=>{const current=await validationNativeStorageGet(null),next=await getConfig();return {currentStorage:{model:current.explainModel,url:current.providerConnections.custom.apiBaseUrl,target:current.targetLanguage},cachedConfig:{model:next.explainModel,url:next.providerConnections.custom.apiBaseUrl,target:next.targetLanguage}};});
   observed.actualRequest={path:requests[0].path,model:requests[0].model};
   assert.equal(observed.currentStorage.model,'new-chat');assert.equal(observed.cachedConfig.model,'test-chat');assert.equal(observed.actualRequest.model,'test-chat');assert.equal(observed.actualRequest.path,'/v1/chat/completions');
   await worker.evaluate(()=>chrome.storage.local.set({language:'en'}));
   await until(()=>worker.evaluate(()=>configCache===null));
   const control=await worker.evaluate(async()=>{const next=await getConfig();return {model:next.explainModel,target:next.targetLanguage};});assert.equal(control.model,'new-chat');controls.push({case:'actual Worker storage change after filled cache gets new model',status:'passed',observed:control});return{observed,instrumentation:'Native chrome.storage.local.get snapshot captured; only its delivery is gated. Real onChanged was observed before releasing old read; AIConfig.load was not replaced.'};
  }finally{await restoreNativeStorageRead();}
 });
 await check('R09','actual content-port cancellation during native config read still sends POST',async()=>{
  const {page}=await sample('<p id="cancel">synthetic cancellation race</p>');await holdNativeStorageRead();
  try {
   const before=await worker.evaluate(()=>validationDisconnects||0);
   await select(page,'#cancel');await until(()=>worker.evaluate(()=>validationReadGate.captured));
   await page.keyboard.press('Escape');await until(()=>worker.evaluate(before=>(validationDisconnects||0)>before,before));
   assert.equal(requests.length,0);
   await worker.evaluate(()=>validationReadGate.release());await until(()=>requests.length===1);
   const observed={requestCountAfterCancel:requests.length,actualRequest:{path:requests[0].path,model:requests[0].model},cardHidden:await page.locator('#deepseek-explain-tooltip').evaluate(el=>el.classList.contains('ds-hidden'))};
   assert.equal(observed.cardHidden,true);assert.equal(observed.requestCountAfterCancel,1);return{observed,instrumentation:'Real content port disconnected and actual Worker onDisconnect event observed before delivering native storage read; product abort listener registration is unchanged.'};
  }finally{await restoreNativeStorageRead();}
 });
}catch(e){results.push({id:'setup',status:'check_failed',error:e.message});process.exitCode=1;console.error(e);}
finally{
 if(context)await context.close();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));
 const report={date:new Date().toISOString(),timezone:'Asia/Shanghai',node:process.version,browserVersion,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),kind:'Actual unpacked extension in headless Edge; actual storage, Worker, runtime ports, injection and native localhost HTTP SSE. No real provider credentials.',profile,profileClosed:true,profileRemoved:false,results,controls,unverified:['Native context-menu mouse interaction','Real provider APIs','Actual rate limiting and billing']};
 writeFileSync(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({results:results.map(r=>({id:r.id,status:r.status})),controls,report:resolve(output,'results.json')},null,2));
 copyFileSync(resolve(output,'results.json'),resolve(output,`results-${Date.now()}.json`));
}
