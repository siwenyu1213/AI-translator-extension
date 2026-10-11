// Actual Edge extension, synthetic pages and localhost SSE. No production credentials.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
const require=createRequire(import.meta.url);
const {chromium}=require(process.argv.includes('--playwright')?arg('--playwright'):'playwright');
const output=resolve(root,'artifacts/qa/selection');mkdirSync(output,{recursive:true});
const profile=resolve(root,'.local/browser-profile/selection',`run-${Date.now()}`);
const checks=[],requests=[],timings=[];let html='',browser,worker,page,version;
async function check(name,fn){try{await fn();checks.push({name,status:'passed'});console.log('PASSED: '+name);}catch(e){checks.push({name,status:'failed',error:e.message});throw e;}}
const sandbox=vm.createContext({Intl});vm.runInContext(readFileSync(resolve(root,'selection.js'),'utf8'),sandbox);
const analyze=(text,info={})=>{sandbox.text=text;sandbox.info=info;return JSON.parse(JSON.stringify(vm.runInContext('AISelection.analyze(text,info)',sandbox)));};
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/sample')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><title>Synthetic selection QA</title></head><body>'+html+'</body></html>');return;}
 let raw='';for await(const c of req)raw+=c;
 if(req.url.endsWith('/chat/completions')){
  assert.equal(req.headers.authorization,'Bearer selection-test-only');requests.push(JSON.parse(raw));
  res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:'Synthetic QA result.'}}]})+'\n\ndata: [DONE]\n\n');return;
 }
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
async function isolated(operation,args=null){return worker.evaluate(async({tabId,operation,args})=>{
 const [result]=await chrome.scripting.executeScript({target:{tabId},func:(operation,args)=>{
  if(!globalThis.AISelection)throw Error('selection.js not injected');
  if(operation==='ready')return true;
  if(operation==='fallback'){getSelection().removeAllRanges();return AISelection.capture('saved word').context;}
  const begin=performance.now(),s=AISelection.capture(args);return {text:s.text,analysis:s.analysis,context:s.context,ms:performance.now()-begin};
 },args:[operation,args]});return result.result;
},{tabId:await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url()),operation,args});}
let seq=0;
async function sample(markup){if(page)await page.close();html=markup;page=await browser.newPage();await page.goto(`${base}/sample/${seq++}`);await isolated('ready');}
async function select(selector,text,occurrence=0,trigger=false){
 const actual=await page.evaluate(({selector,text,occurrence,trigger})=>{
  const el=document.querySelector(selector),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];let node,all='';
  while((node=walker.nextNode())){nodes.push({node,start:all.length});all+=node.data;}
  let start=-1;for(let i=0;i<=occurrence;i++)start=all.indexOf(text,start+1);if(start<0)throw Error('fixture selection missing');
  const finish=start+text.length;const a=nodes.find(n=>start>=n.start&&start<n.start+n.node.length);const b=nodes.find(n=>finish>n.start&&finish<=n.start+n.node.length);
  const range=document.createRange();range.setStart(a.node,start-a.start);range.setEnd(b.node,finish-b.start);getSelection().removeAllRanges();getSelection().addRange(range);
  if(trigger)el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));
  return getSelection().toString().trim();
 },{selector,text,occurrence,trigger});
 return isolated('capture',actual);
}
async function done(){await page.waitForFunction(()=>document.querySelector('#deepseek-explain-tooltip .ds-actions')?.style.display==='flex' && document.querySelector('#deepseek-explain-tooltip .ds-body')?.textContent.trim()==='Synthetic QA result.');}
try{
 const cases=[
  ['好的','response','C'],['好','response','C'],['bank','word','A'],['break the ice','phrase','A'],
  ['是的','response','C'],['不是','response','C'],['可以','response','C'],['好的！','response','C'],['yes','response','A'],
  ['I love you','sentence','B'],['I love you.','sentence','B'],['She went to the bank','sentence','B'],
  ["I'm ready",'sentence','B'],['Open the door','sentence','B'],['Open source','phrase','A'],['Please wait','sentence','B'],
  ['Je suis heureux','sentence','B'],['Ich bin bereit','sentence','B'],['Esto es importante','sentence','B'],['Eu estou pronto','sentence','B'],['Я хочу домой','sentence','B'],['أنا أريد الماء','sentence','B'],
  ['行政强制措施','phrase','C'],['中华人民共和国行政强制法','phrase','C'],['该行为不构成犯罪','sentence','D'],
  ['我喜欢你','sentence','D'],['E01','reference','C'],['式（3）','reference','C'],['git is useful','phrase','A'],['git status','code','C'],
  ['class action lawsuit','phrase','A'],['function of temperature','phrase','A'],['let us go','sentence','B'],
  ['SELECT name FROM users','code','C'],['def hello():','code','C'],['3.5 元','data','C'],['5 kg','data','C'],['2026年10月11日','data','C'],['3 + 2','formula','C'],
  ['这是一个好的开始。','sentence','D'],['This is one sentence. This is another.','passage','B'],
  ['これはテストです','sentence','B'],['안녕하세요','phrase','A'],['이것은 테스트입니다','sentence','B'],
  ['const result = await fetch(url);','code','C'],['TypeError: failed to fetch','code','C'],
  ['https://example.test/path','reference','C'],['C:\\example\\file.txt','reference','C'],['/v1/models','reference','C'],
  ['2026-10-11','data','C'],['12.8%','data','C'],['λ','formula','C'],['P(A|B)','formula','C'],
  ['This strange form without a reliable predicate and without ending punctuation','uncertain','C']
 ];
 for(const [text,category,mode] of cases)await check('local: '+text,()=>{const result=analyze(text);assert.equal(result.category,category);assert.equal(result.mode,mode);});
 await check('mixed text, Japanese Han declaration, and Segmenter fallback',()=>{
  assert.equal(analyze('Transformer 的 attention mechanism').language,'mixed');
  assert.equal(analyze('東京大学',{lang:'ja'}).language,'ja');
  const fallback=vm.createContext({Intl:{}});vm.runInContext(readFileSync(resolve(root,'selection.js'),'utf8'),fallback);
  assert.equal(vm.runInContext("AISelection.analyze('bank').mode",fallback),'A');
 });
 browser=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-first-run'],ignoreDefaultArgs:['--disable-extensions']});
 version=browser.browser()?.version();worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');
 await worker.evaluate(async base=>{
  const connection={apiBaseUrl:base+'/v1',apiKey:'selection-test-only',availableModels:['qa-explain','qa-translate'],modelEntries:[],modelsCheckedAt:new Date().toISOString()};
  await chrome.storage.local.clear();await chrome.storage.local.set(AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,providerConfigVersion:1,enabled:true,triggerMode:'auto',usePageContext:true,language:'zh',targetLanguage:'zh',modelList:['qa-explain','qa-translate'],explainModel:'qa-explain',translateModel:'qa-translate',explainManufacturer:'custom',translateManufacturer:'custom',providerConnections:{custom:connection}}));
 },base);
 await check('backend prompt caps extra materials and specifies uncertain target language',async()=>{
  const prompt=await worker.evaluate(()=>buildSelectionPrompt('SELECTED_MARKER', {title:'T'.repeat(500),details:'D'.repeat(500),before:'R'.repeat(6000),after:'Z'.repeat(6000)}, {category:'uncertain'},'C',{targetLanguage:'ja',language:'auto'}));
  assert.ok(prompt.includes('翻译为日本語'));assert.ok(prompt.includes('SELECTED_MARKER'));assert.equal(prompt.match(/参考上文：\n(R+)/)[1].length,2520);assert.ok(!prompt.includes('ZZZZ'));assert.ok(prompt.includes('其他语言'));
 });
 await check('好的: standalone response, modifier, and punctuation outside selection',async()=>{
  await sample('<article><p>明天九点见可以吗</p><p id="a">好的</p><p>明天见</p></article>');let s=await select('#a','好的');assert.equal(s.analysis.category,'response');assert.ok(s.context.before.includes('明天九点'));
  await sample('<p id="a">这是一个好的开始</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'fragment');assert.ok(s.context.before.includes('这是一个'));assert.ok(s.context.after.includes('开始'));
  await sample('<p id="a">好的，那我们按原计划执行</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'fragment');assert.ok(s.context.after.includes('原计划'));
 });
 await check('actual selection across inline tags and second identical word',async()=>{
  await sample('<article><p id="a">The bank issued a loan. They sat on the <strong>bank</strong> of the river.</p></article>');
  const s=await select('#a','bank',1);assert.ok(s.context.before.endsWith('the '));assert.ok(s.context.after.includes('river'));assert.ok(!s.context.after.includes('loan'));
  const cross=await select('#a','the bank of');assert.equal(cross.text,'the bank of');assert.ok(cross.context.after.includes('river'));
  assert.equal(cross.analysis.mode,'A');
  await sample('<p id="a">The reconstruction is complete.</p>');const part=await select('#a','construct');assert.equal(part.analysis.category,'fragment');assert.ok(part.analysis.reason.includes('单词内部'));
 });
 await check('rich paragraphs, heading metadata and no hidden/navigation pollution',async()=>{
  await sample('<article><h2>Financial terminology</h2><p>Previous context '+ 'A'.repeat(350)+'</p><p id="a">She went to the <span hidden>HIDDEN_SECRET</span><span style="display:none">CSS_SECRET</span>bank to withdraw money.</p><p>Next useful context.</p><nav>NAV_SECRET</nav></article>');
  const s=await select('#a','bank');assert.ok(s.context.before.includes('Previous context'));assert.ok(s.context.after.includes('Next useful'));assert.ok(s.context.details.includes('Financial terminology'));assert.ok(!JSON.stringify(s.context).includes('SECRET'));timings.push(s.ms);
 });
 await check('table column and row labels, heading body and code block',async()=>{
  await sample('<table><caption>Annual indicators</caption><tr><th>Region</th><th>Growth</th></tr><tr><th>East</th><td id="a">12.8%</td></tr></table>');let s=await select('#a','12.8%');assert.ok(s.context.details.includes('Growth'));assert.ok(s.context.details.includes('East'));
  await sample('<article><h2 id="a">Methods</h2><p>The experiment measures temperature under controlled conditions.</p></article>');s=await select('#a','Methods');assert.equal(s.analysis.category,'heading');assert.ok(s.context.after.includes('temperature'));
  await sample('<pre id="a">const x = 1;\nconsole.log(x);</pre>');s=await select('#a','x');assert.equal(s.analysis.category,'code');assert.ok(s.context.after.includes('console.log'));
 });
 await check('cross-paragraph edges, list/message boundaries and detached selection fallback',async()=>{
  await sample('<article id="a"><p>Before start SELECT</p><p>MIDDLE</p><p>END after finish</p></article>');let s=await select('#a','SELECTMIDDLEEND');assert.equal(s.context.before,'Before start ');assert.equal(s.context.after,' after finish');
  await sample('<ul><li id="a">selected word</li><li>OTHER_ITEM_SECRET</li></ul>');s=await select('#a','word');assert.ok(!JSON.stringify(s.context).includes('SECRET'));
  await sample('<div class="message"><p id="a">好的</p></div><div class="message">OTHER_MESSAGE_SECRET</div>');s=await select('#a','好的');assert.ok(!JSON.stringify(s.context).includes('SECRET'));
  const fallback=await isolated('fallback');assert.equal(fallback,null);
 });
 await check('bounded long DOM and context budgets, no selected text repeated',async()=>{
  await sample('<article><p>'+ 'previous '.repeat(1000)+'</p><p id="a">'+ 'left '.repeat(1000)+'UNIQUE_TARGET'+ ' right'.repeat(1000)+'</p><p>'+ 'next '.repeat(1000)+'</p></article>');
  const s=await select('#a','UNIQUE_TARGET');const c=s.context;assert.ok(c.before.length+c.after.length+c.title.length+c.details.length<=1500);assert.ok(!JSON.stringify(c).includes('UNIQUE_TARGET'));timings.push(s.ms);
 });
 await check('element Range boundaries, BR separators, rich dependency budget and emoji fallback',async()=>{
  await sample('<article><p id="a">Earlier line<br>prefix <b>它</b> suffix<br>Later line</p></article>');
  let s=await select('#a','它');assert.ok(s.context.before.includes('Earlier line\nprefix '));assert.ok(s.context.after.includes(' suffix\nLater line'));assert.equal(s.context.budget,2500);
  await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#a'));getSelection().removeAllRanges();getSelection().addRange(r);});
  s=await isolated('capture',await page.evaluate(()=>getSelection().toString().trim()));assert.equal(s.context.before,'');assert.equal(s.context.after,'');
  assert.equal(analyze('🙂').confidence,'low');
 });
 await check('single character triggers actual extension and one request with classified prompt',async()=>{
  await sample('<p id="a">行</p>');const count=requests.length;await select('#a','行',0,true);await done();assert.equal(requests.length,count+1);assert.equal(requests.at(-1).model,'qa-explain');assert.ok(requests.at(-1).messages[1].content.includes('选中文字：\n"""\n行\n"""'));
 });
 await check('foreign short sentence translates; explanation reuses frozen context after collapse',async()=>{
  await sample('<article><p>CONTEXT_ANCHOR: They discuss affection.</p><p id="a">I love you</p></article>');await select('#a','I love you',0,true);await done();assert.equal(requests.at(-1).model,'qa-translate');assert.ok(requests.at(-1).messages[1].content.includes('CONTEXT_ANCHOR'));
  await page.evaluate(()=>getSelection().removeAllRanges());await page.locator('.ds-btn-explain-this').click();await done();assert.equal(requests.at(-1).model,'qa-explain');assert.ok(requests.at(-1).messages[1].content.includes('CONTEXT_ANCHOR'));assert.ok(requests.at(-1).messages[1].content.includes('解释选区的核心含义'));
 });
 await check('identical word at a different position triggers new actual request',async()=>{
  await sample('<article><p id="a">The bank offers loans.</p><p id="b">The bank of the river is steep.</p></article>');await select('#a','bank',0,true);await done();const count=requests.length;await select('#b','bank',0,true);await page.waitForFunction(()=>document.querySelector('.ds-actions')?.style.display==='flex');await page.waitForTimeout(300);assert.equal(requests.length,count+1);assert.ok(requests.at(-1).messages[1].content.includes('river'));
 });
 await check('right-click message keeps context captured before selection collapse',async()=>{
  await sample('<p id="a">RIGHT_CLICK_ANCHOR bank RIGHT_CLICK_SUFFIX</p>');await select('#a','bank');
  await page.evaluate(()=>{document.querySelector('#a').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));getSelection().removeAllRanges();});
  await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===url);await chrome.tabs.sendMessage(tab.id,{type:'TRIGGER_EXPLAIN',text:'bank'});},page.url());
  await done();assert.ok(requests.at(-1).messages[1].content.includes('RIGHT_CLICK_ANCHOR'));
 });
 await check('context disabled remains disabled in actual request',async()=>{
  await worker.evaluate(async()=>chrome.storage.local.set({usePageContext:false}));
  await sample('<p id="a">PRIVATE_CONTEXT bank PRIVATE_AFTER</p>');await select('#a','bank',0,true);await done();assert.ok(!requests.at(-1).messages[1].content.includes('PRIVATE_'));assert.ok(!requests.at(-1).messages[1].content.includes('Synthetic selection QA'));
 });
 await page.screenshot({path:resolve(output,'selection-result.png')});
}catch(e){console.error(e.stack);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));
 writeFileSync(resolve(output,'report.json'),JSON.stringify({date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,browser:version,profile:relative(root,profile),checks,timings,requestCount:requests.length,requests,boundary:'Synthetic pages and synthetic localhost SSE. No real model quality, credentials or billing measured.'},null,2)+'\n');
}
