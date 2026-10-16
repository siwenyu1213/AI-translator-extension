// Verify review findings through the installed extension, actual Edge ports and localhost SSE.
// Fixed-behavior regressions; historical vulnerable reproduction evidence remains separate.
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
const output=resolve(root,'artifacts/qa/adversarial-fix-2026-10-11/browser');
const profile=resolve(root,'.local/browser-profile/adversarial-fix',`browser-${Date.now()}`);
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
async function check(id,title,fn){try{results.push({id,title,status:'passed',...(await fn())});console.log(`PASS ${id}: ${title}`);}catch(e){results.push({id,title,status:'failed',error:e.message});process.exitCode=1;console.error(`${id}: ${e.message}`);}}
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
  globalThis.validationNativeFetch=fetch;globalThis.validationPorts=[];globalThis.validationDisconnects=0;
  chrome.runtime.onConnect.addListener(port=>{if(port.name.startsWith('stream-')){validationPorts.push(port);validationStats.ports++;port.onDisconnect.addListener(()=>{globalThis.validationDisconnects=(globalThis.validationDisconnects||0)+1;});}});
  globalThis.fetch=async(...args)=>{
   if(!String(args[0]).endsWith('/chat/completions'))return validationNativeFetch(...args);
   const stats=validationStats;stats.fetchStarts++;stats.pending++;stats.maxPending=Math.max(stats.maxPending,stats.pending);
   try{return await validationNativeFetch(...args);}finally{stats.pending--;}
  };
 });
 await check('R01','page updates survive stale responses and cancel',async()=>{
  const {page,tabId}=await sample('<p id="p">Original source paragraph.</p>','manual');await triggerFull(tabId);await until(()=>requests.length===1);
  const old=pending.shift();await page.evaluate(()=>document.querySelector('#p').firstChild.data='New app state while translating.');await until(()=>requests.length===2);
  old.complete();await page.waitForTimeout(150);const afterStaleResponse=await page.locator('#p').textContent();assert.equal(afterStaleResponse,'New app state while translating.');
  pending.splice(0).forEach(p=>p.complete());await fullDone(page);
  const afterFreshResponse=await page.locator('#p').textContent();await page.locator('#ds-tb-cancel').click();const afterCancel=await page.locator('#p').textContent();
  assert.equal(afterFreshResponse,'SYNTHETIC TRANSLATION RESULT');assert.equal(afterCancel,'New app state while translating.');return{observed:{afterStaleResponse,afterFreshResponse,afterCancel}};
 });
 await check('R02','moving a translated DOM node preserves original snapshot',async()=>{
  const {page,tabId}=await sample('<div id="old"><p id="p">Original movable paragraph.</p></div><div id="new"></div>');await triggerFull(tabId);await fullDone(page);
  await page.evaluate(()=>document.querySelector('#new').appendChild(document.querySelector('#p')));await page.waitForTimeout(150);await page.locator('#ds-tb-cancel').click();
  const text=await page.locator('#p').textContent(),mark=await page.locator('#p').getAttribute('data-ds-translated');assert.equal(text,'Original movable paragraph.');assert.equal(mark,null);return{observed:{textAfterCancel:text,translationAttribute:mark}};
 });
 await check('R03','protected ancestors and editable drafts are never requested',async()=>{
  const {page,tabId}=await sample('<p>Allowed synthetic prose.</p><div data-ds-skip><p id="skip">Protected source text.</p></div><pre><div id="code">const source = "private synthetic code";</div></pre><div contenteditable="true"><p id="draft">My unsaved synthetic draft.</p></div><div translate="no"><span>Explicitly protected translation.</span></div><div role="textbox">Role editor draft.</div>');await triggerFull(tabId);await fullDone(page);
  const prompt=requests.map(r=>r.prompt).join('\n');for(const term of ['Protected source text.','private synthetic code','My unsaved synthetic draft.','Explicitly protected translation.','Role editor draft.'])assert.ok(!prompt.includes(term));
  const texts=await page.locator('#skip,#code,#draft').allTextContents();assert.deepEqual(texts,['Protected source text.','const source = "private synthetic code";','My unsaved synthetic draft.']);return{observed:{sentEditableDraft:false,texts,requestCount:requests.length}};
 });
 await check('R04','fallback shares actual request quota of 50',async()=>{
  const {page,tabId}=await sample('<style>p{position:absolute;top:100px;left:0}</style>'+Array.from({length:512},(_,i)=>`<p>Unique source paragraph ${i}.</p>`).join(''),'batch-fail');await triggerFull(tabId);
  try {
   await until(()=>worker.evaluate(()=>validationStats.pending===50),15000);
   await page.waitForTimeout(250);
   const observed=await worker.evaluate(()=>({fetchStarts:validationStats.fetchStarts,pendingFetches:validationStats.pending,maxPendingFetches:validationStats.maxPending,createdPorts:validationStats.ports}));
   observed.serverReceivedSingles=requests.filter(r=>!r.batch).length;observed.serverReceivedBatches=requests.filter(r=>r.batch).length;
   assert.ok(observed.maxPendingFetches<=50);assert.ok(observed.serverReceivedSingles>0);
   // Drain the held singles to verify fallback completes instead of deadlocking.
   await until(async()=>{pending.splice(0).forEach(p=>p.complete());const p=await page.locator('#ds-tb-progress').textContent();const [done,total]=p.split('/').map(Number);return total===512&&done===total;},30000);
   assert.ok((await worker.evaluate(()=>validationStats.maxPending))<=50);
   controls.push({case:'512 fallback fragments complete and cancellation restores all',status:'passed'});
   return{observed,boundary:'Native fetch invocations include requests waiting in the browser network pool; this is not a claim of 512 simultaneous TCP connections or provider billing events.'};
  } finally {await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('p').first().textContent(),'Unique source paragraph 0.');}
 });
 await check('R06','translation preserves link label, identity and href',async()=>{
  const original='Read the documentation carefully.';const {page,tabId}=await sample('<p id="p" style="margin-top:80px">Read the <a href="/details">documentation</a> carefully.</p>');
  await page.evaluate(()=>{window.fixtureLink=document.querySelector('#p a');fixtureLink.addEventListener('click',e=>{e.preventDefault();window.fixtureLinkClicks=(window.fixtureLinkClicks||0)+1;});});await triggerFull(tabId);await fullDone(page);
  const label=await page.locator('#p a').textContent(),href=await page.locator('#p a').getAttribute('href');assert.ok(label.includes('documentation'));assert.ok(label.length>0);assert.equal(href,'/details');
  await page.locator('#p a').click();assert.equal(await page.evaluate(()=>fixtureLink===document.querySelector('#p a')&&fixtureLinkClicks===1),true);
  await page.screenshot({path:resolve(output,'R06-link.png')});await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#p').textContent(),original);assert.equal(await page.locator('#p a').textContent(),'documentation');controls.push({case:'static paragraph and link restore on cancel',status:'passed'});return{observed:{labelDuringTranslation:label,href,restoredLabel:'documentation',identityAndListenerPreserved:true}};
 });
 await check('R07','French to English and Chinese to Japanese reach the API',async()=>{
  const observed=[];for(const [source,target]of[['Bonjour, cette phrase est seulement en français.','en'],['这里是一段需要翻译成日语的中文内容。','ja']]){
   const {page,tabId}=await sample(`<p>${source}</p>`,'normal',target);await triggerFull(tabId);await fullDone(page);const status=await page.locator('.ds-tb-status').textContent();assert.equal(requests.length,1);assert.ok(status.includes('翻译完成'));observed.push({source,target,requestCount:requests.length,status});
  }return{observed};
 });
 await check('R08','new inline text and characterData are translated and restored',async()=>{
  const {page,tabId}=await sample('<p id="p">Initial synthetic content.</p>');await triggerFull(tabId);await fullDone(page);const before=requests.length;
  await page.evaluate(()=>{const span=document.createElement('span');span.id='added';span.textContent=' Newly added untranslated text.';document.querySelector('#p').append(span);});await page.waitForTimeout(500);
  await until(()=>requests.length===before+1);await fullDone(page);assert.equal(await page.locator('#added').textContent(),' SYNTHETIC TRANSLATION RESULT');
  await page.evaluate(()=>document.querySelector('#added').firstChild.data=' Updated dynamic source.');await until(()=>requests.length===before+2);await fullDone(page);
  await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#added').textContent(),' Updated dynamic source.');assert.equal(await page.locator('#p').first().textContent(),'Initial synthetic content. Updated dynamic source.');return{observed:{requestCountBefore:before,requestCountAfter:requests.length,restoredDynamicText:await page.locator('#added').textContent()}};
 });
 await check('R10','unexpected port disconnect permits same-selection retry',async()=>{
  const {page,tabId}=await sample('<p id="word">retry this synthetic phrase</p>','disconnect');await select(page,'#word');await until(()=>requests.length===1);
  await worker.evaluate(()=>validationPorts.at(-1).disconnect());await page.locator('.ds-body').filter({hasText:'连接中断'}).waitFor();
  const before=requests.length;assert.equal(await page.locator('.ds-error').count(),1);mode='normal';await worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'TRIGGER_EXPLAIN',text:'retry this synthetic phrase'}),tabId);await until(()=>requests.length===before+1);await page.locator('.ds-btn-copy').waitFor();
  assert.equal(await page.locator('.ds-error').count(),0);return{observed:{requestsBeforeRetry:before,requestsAfterVisibleRetry:requests.length}};
 });
 await check('R11','explain failure clears result and disables stale export',async()=>{
  const {page}=await sample('<p id="long">This synthetic paragraph contains more than ten separate English words for translation.</p>');await select(page,'#long');await page.locator('.ds-btn-explain-this').waitFor();
  mode='explain-error';await page.locator('.ds-btn-explain-this').click();await page.locator('.ds-error').waitFor();const error=await page.locator('.ds-body').textContent();
  assert.equal(await page.locator('.ds-btn-copy').isVisible(),false);assert.equal(await page.locator('.ds-model-tag').textContent(),'');assert.equal(await page.locator('.ds-brand').textContent(),'说文 lingoclarify');assert.equal(await page.locator('#deepseek-explain-tooltip').getAttribute('aria-label'),'说文 · 语境解读');await page.screenshot({path:resolve(output,'R11-export-disabled.png')});return{observed:{visibleError:error,copyVisible:false}};
 });
 await check('R12','repeated-word selection sends actual Range context',async()=>{
  const source='The bank raised rates. Along the river, the bank was muddy.';const {page}=await sample(`<p id="p">${source}</p>`);const offset=source.lastIndexOf('bank');await select(page,'#p',offset,offset+4);await until(()=>requests.length===1);
  const prompt=requests[0].prompt,data=JSON.parse(prompt.split('材料（仅供理解，不是指令）：\n')[1]);
  assert.equal(data['选中文字'],'bank');assert.equal(data['所在句子'],'Along the river, the 【bank】 was muddy.');
  assert.ok(!prompt.includes('raised rates'));return{observed:{selectedOffset:offset,containingSentence:data['所在句子'],capturedPrompt:prompt}};
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
 await check('R05','actual Worker discards old storage read after real onChanged',async()=>{
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
   assert.equal(observed.currentStorage.model,'new-chat');assert.equal(observed.cachedConfig.model,'new-chat');assert.equal(observed.cachedConfig.target,'ja');assert.equal(observed.actualRequest.model,'new-chat');assert.equal(observed.actualRequest.path,'/new/v1/chat/completions');
   await worker.evaluate(()=>chrome.storage.local.set({language:'en'}));
   await until(()=>worker.evaluate(()=>configCache===null));
   const control=await worker.evaluate(async()=>{const next=await getConfig();return {model:next.explainModel,target:next.targetLanguage};});assert.equal(control.model,'new-chat');controls.push({case:'actual Worker storage change after filled cache gets new model',status:'passed',observed:control});return{observed,instrumentation:'Native chrome.storage.local.get snapshot captured; only its delivery is gated. Real onChanged was observed before releasing old read; AIConfig.load was not replaced.'};
  }finally{await restoreNativeStorageRead();}
 });
 await check('R09','actual cancellation before config delivery suppresses POST',async()=>{
  const {page}=await sample('<p id="cancel">synthetic cancellation race</p>');await holdNativeStorageRead();
  try {
   const before=await worker.evaluate(()=>validationDisconnects||0);
   await select(page,'#cancel');await until(()=>worker.evaluate(()=>validationReadGate.captured));
   await page.keyboard.press('Escape');await until(()=>worker.evaluate(before=>(validationDisconnects||0)>before,before));
   assert.equal(requests.length,0);
   await worker.evaluate(()=>validationReadGate.release());await worker.evaluate(()=>getConfig());await page.waitForTimeout(350);
   const observed={requestCountAfterCancel:requests.length,cardHidden:await page.locator('#deepseek-explain-tooltip').evaluate(el=>el.classList.contains('ds-hidden'))};
   assert.equal(observed.cardHidden,true);assert.equal(observed.requestCountAfterCancel,0);return{observed,instrumentation:'Real content port disconnected and actual Worker onDisconnect observed before delivering native storage read.'};
  }finally{await restoreNativeStorageRead();}
 });
 await check('C01','original toggle during requests, external changes and restart',async()=>{
  const {page,tabId}=await sample('<p id="p">Original toggle fixture.</p>','manual');await triggerFull(tabId);await until(()=>requests.length===1);
  await page.locator('#ds-tb-show-original').click();pending.splice(0).forEach(p=>p.complete());await fullDone(page);assert.equal(await page.locator('#p').textContent(),'Original toggle fixture.');
  await page.locator('#ds-tb-show-original').click();assert.equal(await page.locator('#p').textContent(),'SYNTHETIC TRANSLATION RESULT');
  await page.evaluate(()=>document.querySelector('#p').firstChild.data='Website changes completed translation.');
  await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#p').textContent(),'Website changes completed translation.');
  const count=requests.length;mode='normal';await triggerFull(tabId);await fullDone(page);assert.ok(requests.length>count);await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#p').textContent(),'Website changes completed translation.');
  return {observed:{toggleDuringRequest:true,externalUpdatePreserved:true,restartPassed:true}};
 });
 await check('C02','removal during request and reinsertion retain source safely',async()=>{
  const {page,tabId}=await sample('<p id="p">Removable original text.</p>','manual');await triggerFull(tabId);await until(()=>requests.length===1);
  await page.evaluate(()=>{window.removedFixture=document.querySelector('#p');removedFixture.remove();});await until(async()=>await page.locator('#ds-tb-progress').textContent()==='0 / 0');
  pending.splice(0).forEach(p=>p.complete());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>removedFixture.textContent),'Removable original text.');
  mode='normal';await page.evaluate(()=>document.body.appendChild(removedFixture));await fullDone(page);await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#p').textContent(),'Removable original text.');return{observed:{removedOldResponseIgnored:true,reinsertRestore:true}};
 });
 await check('C03','SVG MathML protection, hidden reveal and details expansion',async()=>{
  const {page,tabId}=await sample('<p>Visible source prose.</p><svg width="300" height="50"><text x="0" y="20">Protected chart caption.</text></svg><math><mtext>Protected mathematical label.</mtext></math><div translate="NO">Uppercase protected source.</div><p id="hidden" style="display:none">Revealed source prose.</p><details id="details"><summary>Expandable summary.</summary><p id="detail">Expanded detail prose.</p></details>');await triggerFull(tabId);await fullDone(page);
  const initial=requests.map(r=>r.prompt).join('\n');for(const term of ['Protected chart caption.','Protected mathematical label.','Uppercase protected source.','Revealed source prose.','Expanded detail prose.'])assert.ok(!initial.includes(term));
  await page.evaluate(()=>{document.querySelector('#hidden').style.display='block';document.querySelector('#details').open=true;});
  await until(()=>requests.map(r=>r.prompt).join('\n').includes('Expanded detail prose.')&&requests.map(r=>r.prompt).join('\n').includes('Revealed source prose.'));await fullDone(page);
  await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#hidden').textContent(),'Revealed source prose.');assert.equal(await page.locator('#detail').textContent(),'Expanded detail prose.');return{observed:{protectedSent:false,revealedTranslated:true,expandedTranslated:true}};
 });
 await check('C04','viewport scheduling defers distant content until scroll',async()=>{
  const {page,tabId}=await sample('<p id="near">Nearby source prose.</p><p id="far" style="margin-top:5000px">Distant source prose.</p>');await triggerFull(tabId);await until(()=>requests.length===1);await page.waitForTimeout(150);
  assert.ok(!requests[0].prompt.includes('Distant source prose.'));assert.equal(await page.locator('#far').textContent(),'Distant source prose.');
  await page.locator('#far').scrollIntoViewIfNeeded();await fullDone(page);assert.ok(requests.some(r=>r.prompt.includes('Distant source prose.')));await page.locator('#ds-tb-cancel').click();assert.equal(await page.locator('#near').textContent(),'Nearby source prose.');assert.equal(await page.locator('#far').textContent(),'Distant source prose.');return{observed:{deferred:true,scrollTranslated:true}};
 });
 await check('C05','successful explanation restores correct model and clipboard actions',async()=>{
  const {page,tabId}=await sample('<p id="long">This synthetic paragraph contains more than ten separate English words for translation.</p>');
  await worker.evaluate(async()=>{const c=await chrome.storage.local.get(null);c.providerConnections.custom.availableModels.push('explain-chat');c.providerConnections.custom.modelEntries.push({id:'explain-chat'});await chrome.storage.local.set({providerConnections:c.providerConnections,explainModel:'explain-chat',modelList:['test-chat','explain-chat']});});
  await select(page,'#long');await page.locator('.ds-btn-explain-this').waitFor();assert.equal(await page.locator('.ds-model-tag').textContent(),'test-chat');await page.locator('.ds-btn-explain-this').click();
  await until(async()=>await page.locator('.ds-model-tag').textContent()==='explain-chat');assert.equal(await page.locator('.ds-brand').textContent(),'说文 lingoclarify');assert.equal(await page.locator('#deepseek-explain-tooltip').getAttribute('aria-label'),'说文 · 语境解读');await page.locator('.ds-btn-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'SYNTHETIC TRANSLATION RESULT');assert.equal(requests.at(-1).model,'explain-chat');return{observed:{model:'explain-chat',clipboard:'SYNTHETIC TRANSLATION RESULT'}};
 });
 await check('C06','context selection across inline nodes uses exact Range boundaries',async()=>{
  const {page}=await sample('<p id="p">Earlier bank. Actual <b id="start">river bank</b> and <span id="end">shore</span> suffix.</p>');
  await page.evaluate(()=>{const r=document.createRange();r.setStart(document.querySelector('#start').firstChild,6);r.setEnd(document.querySelector('#end').firstChild,5);getSelection().removeAllRanges();getSelection().addRange(r);document.querySelector('#p').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));});
  await until(()=>requests.length===1);const data=JSON.parse(requests[0].prompt.split('材料（仅供理解，不是指令）：\n')[1]);
  assert.equal(data['选中文字'],'bank and shore');assert.equal(data['所在句子'].replace(/\s+/g,' '),'Actual river 【bank and shore】 suffix.');
  assert.ok(!JSON.stringify(data).includes('Earlier bank.'));return{observed:{containingSentence:data['所在句子']}};
 });
}catch(e){results.push({id:'setup',status:'check_failed',error:e.message});process.exitCode=1;console.error(e);}
finally{
 if(context)await context.close();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));
 const report={date:new Date().toISOString(),timezone:'Asia/Shanghai',node:process.version,browserVersion,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),kind:'Actual unpacked extension in headless Edge; actual storage, Worker, runtime ports, injection and native localhost HTTP SSE. No real provider credentials.',profile,profileClosed:true,profileRemoved:false,results,controls,unverified:['Native context-menu mouse interaction','Real provider APIs','Actual rate limiting and billing']};
 writeFileSync(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({results:results.map(r=>({id:r.id,status:r.status})),controls,report:resolve(output,'results.json')},null,2));
 copyFileSync(resolve(output,'results.json'),resolve(output,`results-${Date.now()}.json`));
}
