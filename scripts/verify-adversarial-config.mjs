// Actual Edge extension popup/storage/Worker with localhost HTTP and synthetic models.
// node scripts/verify-adversarial-config.mjs --playwright <existing package> [--edge <exe>]
// Findings are confirmed/not_reproduced; failed controls/infrastructure are check_failed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv.includes('--playwright')?arg('--playwright'):'playwright');
const evidence=resolve(root,'artifacts/qa/adversarial-validation-2026-10-11/config');
mkdirSync(evidence,{recursive:true});
const profileRoot=resolve(root,'.local/browser-profile/adversarial-config');
const profile=resolve(profileRoot,`run-${Date.now()}-${process.pid}`);
assert.equal(dirname(profile),profileRoot);assert.equal(existsSync(profile),false);
const checks=[],httpRequests=[],pageErrors=[];
let context,worker,popup,browserVersion,extensionId;
const cleanup={browserClosed:false,serverClosed:false,profileRetained:true,profile:relative(root,profile)};
const server=createServer(async(req,res)=>{
  try {
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=raw?JSON.parse(raw):null;
    const authenticated=req.headers.authorization==='Bearer adversarial-local-only';
    httpRequests.push({path:req.url,method:req.method,authenticated,model:body?.model});
    res.setHeader('Access-Control-Allow-Origin','*');
    if(!authenticated){res.writeHead(401,{'Content-Type':'application/json'});res.end('{}');return;}
    if(req.url==='/old/models'){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'old-chat'}]}));return;
    }
    if(req.url==='/new/models'){
      res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;
    }
    if(req.url.endsWith('/chat/completions')){
      res.writeHead(200,{'Content-Type':'text/event-stream'});
      res.end('data:'+JSON.stringify({choices:[{delta:{content:'这是本机合成流式返回内容。'}}]})+'\n\ndata: [DONE]\n\n');return;
    }
    res.writeHead(404);res.end('{}');
  }catch{res.writeHead(500);res.end('{}');}
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const base=`http://127.0.0.1:${server.address().port}`;
async function check(id,name,fn){
  try {
    const {reproduced,...details}=await fn();
    const status=reproduced?'confirmed':'not_reproduced';checks.push({id,name,status,...details});
    console.log(`${id} ${status}: ${name}`);
  }catch(error){checks.push({id,name,status:'check_failed',error:error.message});console.log(`${id} check_failed: ${error.message}`);}
}
async function seed({enabled=true,manufacturer='custom'}={}){
  await worker.evaluate(async({base,enabled,manufacturer})=>{
    const custom=manufacturer==='custom';
    const model=custom?'old-chat':'mistral-small-latest';
    const entry=custom?{apiBaseUrl:base+'/old',apiKey:'adversarial-local-only',availableModels:['old-chat'],modelEntries:[{id:'old-chat',name:'Old chat'}],modelsCheckedAt:'2026-10-10T00:00:00Z'}:
      {apiKey:'adversarial-mistral-only',availableModels:[],modelEntries:[],modelsCheckedAt:''};
    await chrome.storage.local.clear();
    await chrome.storage.local.set(AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,providerConfigVersion:1,
      apiBaseUrl:base+'/old',apiKey:'adversarial-local-only',enabled,usePageContext:false,triggerMode:'auto',
      explainManufacturer:manufacturer,translateManufacturer:manufacturer,explainModel:model,translateModel:model,
      modelList:[model],providerConnections:{[manufacturer]:entry}}));
  },{base,enabled,manufacturer});
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForFunction(()=>document.getElementById('explain-manufacturer').options.length>0);
}
async function stream(text){
  return popup.evaluate(text=>new Promise((resolveResult,reject)=>{
    const messages=[];const port=chrome.runtime.connect({name:'stream-adversarial-'+Date.now()});
    const timer=setTimeout(()=>{port.disconnect();reject(new Error('Stream test timed out'));},10000);
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);resolveResult(messages);};
    port.onMessage.addListener(msg=>{messages.push(msg);if(msg.type==='done'||msg.type==='error'){finish();port.disconnect();}});
    port.onDisconnect.addListener(finish);
    port.postMessage({type:'STREAM_REQUEST',mode:'C',text,context:null});
  }),text);
}
async function settings(){
  return worker.evaluate(async()=>{
    const value=await chrome.storage.local.get(['enabled','explainModel','translateModel','providerConnections']);
    // Only a fixed allowlist of non-secret fields enters evidence.
    return {enabled:value.enabled,explainModel:value.explainModel,translateModel:value.translateModel,
      connections:Object.fromEntries(Object.entries(value.providerConnections||{}).map(([id,c])=>[id,{apiBaseUrl:c.apiBaseUrl,
        availableModels:c.availableModels,modelEntries:c.modelEntries,modelsCheckedAt:c.modelsCheckedAt}]))};
  });
}
try {
  context=await chromium.launchPersistentContext(profile,{
    ...(process.argv.includes('--edge')?{executablePath:arg('--edge')}:{channel:'msedge'}),
    headless:true,viewport:{width:380,height:1000},
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-first-run'],
    ignoreDefaultArgs:['--disable-extensions']});
  browserVersion=context.browser()?.version();
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:20000});
  extensionId=new URL(worker.url()).host;
  await worker.evaluate(()=>{
    const nativeFetch=globalThis.fetch;
    globalThis.adversarialFetchLog=[];
    globalThis.fetch=async(url,options={})=>{
      const value=String(url);
      if(new URL(value).hostname==='127.0.0.1')return nativeFetch(url,options);
      if(value===AIModelCatalog.SOURCE){
        adversarialFetchLog.push({kind:'synthetic-public-catalog',networkSent:false});
        return Response.json({data:AIModelCatalog.BUILTIN.providers.flatMap(p=>p.models.map(m=>({...m,architecture:{input_modalities:['text'],output_modalities:['text']}})))});
      }
      if(value==='https://api.mistral.ai/v1/models'){
        adversarialFetchLog.push({kind:'synthetic-mistral-models',networkSent:false,authenticated:options.headers?.Authorization==='Bearer adversarial-mistral-only'});
        return Response.json({data:[{id:'mixtral-8x22b-instruct',input_modalities:['text'],output_modalities:['text']},
          {id:'mistral-small-latest',input_modalities:['text'],output_modalities:['text']}]});
      }
      adversarialFetchLog.push({kind:'blocked-non-local-request',networkSent:false,hostname:new URL(value).hostname});
      throw new Error('Non-local network request forbidden by adversarial QA harness');
    };
  });
  // Also block unexpected popup fallback traffic; only the real Worker and local HTTP are exercised.
  await context.route('https://**/*',route=>route.abort('blockedbyclient'));
  popup=await context.newPage();popup.on('pageerror',error=>pageErrors.push(error.message));
  await check('R13','旧 enabled:false 保存后无恢复入口',async()=>{
    await seed({enabled:false});
    await popup.waitForFunction(()=>document.getElementById('explain-model').value==='old-chat');
    await popup.locator('#save-btn').click();await popup.locator('#status').filter({hasText:'设置已保存'}).waitFor();
    const afterSave=await settings();
    const enablingControls=await popup.locator('#enabled').count();
    const requestStart=httpRequests.length;
    const disabledMessages=await stream('R13禁用旧偏好复现');
    const disabledPosts=httpRequests.slice(requestStart).filter(r=>r.path.endsWith('/chat/completions'));
    await popup.screenshot({path:resolve(evidence,'R13-disabled.png'),fullPage:true});
    await worker.evaluate(()=>chrome.storage.local.set({enabled:true}));
    const positiveMessages=await stream('R13正向对照恢复启用');
    assert.ok(positiveMessages.some(m=>m.type==='done'),'Positive control enabled:true must generate successfully');
    const reproduced=afterSave.enabled===false&&enablingControls===0&&disabledMessages.some(m=>m.error==='扩展已禁用')&&disabledPosts.length===0;
    return {reproduced,afterSave,enablingControls,disabledMessages,disabledGenerationRequests:disabledPosts.length,
      positiveControl:{description:'Only enabled changes to true; same real Worker/storage/local connection generates',messages:positiveMessages},screenshot:'R13-disabled.png'};
  });
  await check('R14','custom 换址且 models 404 后仍向新接口调用旧型号',async()=>{
    await seed();await popup.waitForFunction(()=>document.getElementById('explain-model').value==='old-chat');
    const positiveMessages=await stream('R14正向对照原连接');
    assert.ok(positiveMessages.some(m=>m.type==='done'),'Old connection positive control must generate');
    await popup.locator('#custom-connection-button').click();
    await popup.locator('#api-base-url').fill(base+'/new');
    const requestStart=httpRequests.length;
    await popup.locator('#custom-save').click();
    await popup.waitForFunction(()=>document.getElementById('catalog-status').textContent.includes('不支持获取模型列表'));
    const afterAddressSave=await settings();
    const displayedModel=await popup.locator('#explain-model').inputValue();
    await popup.screenshot({path:resolve(evidence,'R14-new-address.png'),fullPage:true});
    const newMessages=await stream('R14新连接旧型号复现');
    const requests=httpRequests.slice(requestStart);
    const reproduced=requests.some(r=>r.path==='/new/models')&&requests.some(r=>r.path==='/new/chat/completions'&&r.model==='old-chat')&&
      afterAddressSave.explainModel==='old-chat'&&afterAddressSave.connections.custom.availableModels.length===0&&displayedModel==='';
    return {reproduced,afterAddressSave,displayedModel,requests,newMessages,
      positiveControl:{description:'Original localhost connection uses selected old-chat and succeeds',messages:positiveMessages},screenshot:'R14-new-address.png'};
  });
  await check('R15','Mistral 接口 native Mixtral ID 被过滤',async()=>{
    await seed({manufacturer:'mistral'});
    await popup.waitForFunction(()=>[...document.getElementById('explain-model').options].some(o=>o.value==='mistral-small-latest'));
    const actualOptions=await popup.locator('#explain-model option').evaluateAll(options=>options.map(o=>({id:o.value,label:o.textContent})));
    const algorithm=await worker.evaluate(()=>({native:AIModelCatalog.interfaceModels([{id:'mixtral-8x22b-instruct',input_modalities:['text'],output_modalities:['text']}],'mistral'),
      namespaced:AIModelCatalog.interfaceModels([{id:'mistralai/mixtral-8x22b-instruct',input_modalities:['text'],output_modalities:['text']}],'mistral'),
      ordinary:AIModelCatalog.interfaceModels([{id:'mistral-small-latest',input_modalities:['text'],output_modalities:['text']}],'mistral'),
      inferredProvider:AIModelCatalog.providerFor('mixtral-8x22b-instruct')}));
    assert.equal(algorithm.namespaced.length,1,'Namespaced Mixtral positive control must be retained');
    assert.equal(algorithm.ordinary.length,1,'Ordinary Mistral positive control must be retained');
    assert.ok(actualOptions.some(m=>m.id==='mistral-small-latest'),'Popup positive control must contain another text model');
    const afterRefresh=await settings();
    await popup.screenshot({path:resolve(evidence,'R15-mistral-options.png'),fullPage:true});
    return {reproduced:algorithm.native.length===0&&!actualOptions.some(m=>m.id==='mixtral-8x22b-instruct'),actualOptions,algorithm,afterRefresh,
      positiveControl:{namespacedMixtralAccepted:true,ordinaryMistralAccepted:true,popupOtherTextModelPresent:true},
      suppliedModels:['mixtral-8x22b-instruct','mistral-small-latest'],screenshot:'R15-mistral-options.png'};
  });
}catch(error){checks.push({id:'infrastructure',status:'check_failed',error:error.message});}
finally {
  let workerFetchLog=[];
  try{if(worker)workerFetchLog=await worker.evaluate(()=>globalThis.adversarialFetchLog||[]);}catch{}
  try{if(context){await context.close();cleanup.browserClosed=true;}}catch(error){checks.push({id:'cleanup_browser',status:'check_failed',error:error.message});}
  try{server.closeAllConnections();await new Promise((resolveClose,reject)=>server.close(error=>error?reject(error):resolveClose()));cleanup.serverClosed=true;}
  catch(error){checks.push({id:'cleanup_server',status:'check_failed',error:error.message});}
  if(pageErrors.length)checks.push({id:'popup_page_errors',status:'check_failed',errors:pageErrors});
  const report={date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    workingTree:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,browserVersion,
    kind:'Actual headless Edge extension popup/storage/Worker; localhost HTTP/SSE; synthetic Mistral and public catalog Worker responses; no real provider calls',
    reproductionCommand:'node scripts/verify-adversarial-config.mjs --playwright <existing package> [--edge <exe>]',
    checks,httpRequests,workerFetchLog,pageErrors,cleanup};
  writeFileSync(resolve(evidence,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.map(({id,status})=>({id,status})),cleanup,evidence:relative(root,evidence)},null,2));
  process.exitCode=checks.some(c=>c.status!=='confirmed')?1:0;
}
