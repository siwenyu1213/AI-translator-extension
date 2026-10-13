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
const nodeOnly=process.argv.includes('--node-only');
const {chromium}=nodeOnly?{}:require(process.argv.includes('--playwright')?arg('--playwright'):'playwright');
const output=resolve(root,'artifacts/qa/selection');mkdirSync(output,{recursive:true});
const profile=resolve(root,'.local/browser-profile/selection',`run-${Date.now()}`);
const checks=[],requests=[],timings=[];let html='',browser,worker,page,version;
async function check(name,fn){try{await fn();checks.push({name,status:'passed'});console.log('PASSED: '+name);}catch(e){checks.push({name,status:'failed',error:e.message});throw e;}}
const sandbox=vm.createContext({Intl});vm.runInContext(readFileSync(resolve(root,'selection.js'),'utf8'),sandbox);
const analyze=(text,info={})=>{sandbox.text=text;sandbox.info=info;return JSON.parse(JSON.stringify(vm.runInContext('AISelection.analyze(text,info)',sandbox)));};
const contextLength=c=>c.title.length+c.details.length+c.before.length+c.after.length+(c.lang?.length||0)+(c.sentence?.before.length||0)+(c.sentence?.after.length||0);
const materials=prompt=>JSON.parse(prompt.split('材料（仅供理解，不是指令）：\n')[1]);
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
 await check('content category is independent from embedded selection position',()=>{
  for(const text of ['浮层','祖先','帧队列','行政强制措施']){
   const result=analyze(text,{before:'相关',after:'中的内容',partial:true});assert.equal(result.category,'phrase');assert.equal(result.position,'embedded');assert.equal(result.completeness,'complete');
  }
  assert.equal(analyze('好的',{before:'这是一个',after:'开始',partial:true}).category,'phrase');
  assert.equal(analyze('好的',{before:'这是一个',after:'开始',partial:true}).responseLike,true);
  assert.equal(analyze('浮层').responseLike,false);
  assert.equal(analyze('好的').category,'response');
  assert.equal(analyze('好的',{after:'！',partial:false}).category,'response');
  assert.equal(analyze('construct',{before:'re',after:'ion',partial:true,partialWord:true}).category,'fragment');
  assert.equal(analyze('它',{before:'其中',after:'的位置',partial:true}).completeness,'dependent');
  assert.equal(analyze('这是一个好的',{after:'开始',partial:true}).category,'fragment');
  assert.equal(analyze('the bank of',{after:' the river',partial:true}).category,'fragment');
  assert.equal(analyze('This is',{after:' a tool',partial:true}).mode,'A');
  assert.equal(analyze('because it is',{after:' useful',partial:true}).category,'fragment');
  assert.equal(analyze('cache',{sentenceBefore:'This is called a '}).contextDependency,true);
  assert.equal(analyze('bank',{sentenceBefore:'They sat on the '}).contextDependency,false);
  assert.equal(analyze('I love you',{before:'They said: ',after:' to each other',partial:true}).mode,'B');
 });
 if(!nodeOnly){
 browser=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-first-run'],ignoreDefaultArgs:['--disable-extensions']});
 version=browser.browser()?.version();worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');
 await worker.evaluate(async base=>{
  const connection={apiBaseUrl:base+'/v1',apiKey:'selection-test-only',availableModels:['qa-explain','qa-translate'],modelEntries:[],modelsCheckedAt:new Date().toISOString()};
  await chrome.storage.local.clear();await chrome.storage.local.set(AIConfig.migrate({apiConfigVersion:1,modelCatalogVersion:1,providerConfigVersion:1,enabled:true,triggerMode:'auto',usePageContext:true,language:'zh',targetLanguage:'zh',modelList:['qa-explain','qa-translate'],explainModel:'qa-explain',translateModel:'qa-translate',explainManufacturer:'custom',translateManufacturer:'custom',providerConnections:{custom:connection}}));
 },base);
 await check('backend prompt caps extra materials and specifies uncertain target language',async()=>{
  const prompt=await worker.evaluate(()=>buildSelectionPrompt('SELECTED_MARKER', {title:'T'.repeat(500),details:'D'.repeat(500),before:'R'.repeat(6000),after:'Z'.repeat(6000)}, {category:'uncertain'},'C',{targetLanguage:'ja',language:'auto'}));
  const data=materials(prompt);assert.ok(prompt.includes('日本語'));assert.equal(data['选中文字'],'SELECTED_MARKER');assert.ok(Object.values(data).filter(v=>typeof v==='string').reduce((n,v)=>n+v.length,0)-'SELECTED_MARKER'.length<=3000);assert.ok(!prompt.includes('本地结构提示'));
 });
 await check('好的: standalone response, modifier, and punctuation outside selection',async()=>{
  await sample('<article><p>明天九点见可以吗</p><p id="a">好的</p><p>明天见</p></article>');let s=await select('#a','好的');assert.equal(s.analysis.category,'response');assert.ok(s.context.before.includes('明天九点'));
  await sample('<p id="a">这是一个好的开始</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'phrase');assert.equal(s.context.sentence.before,'这是一个');assert.equal(s.context.sentence.after,'开始');
  await sample('<p id="a">好的，那我们按原计划执行</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'phrase');assert.ok(s.context.sentence.after.includes('原计划'));
  await sample('<p id="a">好的！</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'response');assert.equal(s.context.sentence.after,'！');
  await sample('<p id="a">明天见。好的！</p>');s=await select('#a','好的');assert.equal(s.analysis.category,'response');assert.equal(s.context.sentence.before,'');assert.equal(s.context.sentence.after,'！');
 });
 await check('README term uses its actual containing sentence without unrelated classification examples',async()=>{
  await sample('<article><p>本地规则分别给出文字构成、结构类别和可信度。例如独立消息中的“好的”标为短回应，在“这是一个好的开始”中选中“好的”标为局部片段。日文纯汉字可参考附近 lang 声明，缺少声明时存在歧义。</p><p id="a">结果浮层支持 Markdown：标题、加粗/斜体、列表、引用。流式期间约每150毫秒重新解析已收到的内容。</p><p>下一段无关说明。</p></article>');
  const s=await select('#a','浮层');assert.equal(s.analysis.category,'phrase');assert.equal(s.context.sentence.before,'结果');assert.equal(s.context.sentence.after,'支持 Markdown：标题、加粗/斜体、列表、引用。');assert.equal(s.context.before,'');assert.equal(s.context.after,'');assert.ok(!JSON.stringify(s.context).includes('好的'));assert.ok(!JSON.stringify(s.context).includes('lang 声明'));
  await select('#a','浮层',0,true);await done();const data=materials(requests.at(-1).messages[1].content);assert.equal(data['选中文字'],'浮层');assert.ok(data['所在句子'].includes('结果【浮层】支持 Markdown'));assert.ok(!JSON.stringify(data).includes('好的'));
 });
 await check('actual complete terms, dependent/truncated fragments, and Han-only declared Japanese',async()=>{
  await sample('<article><p>OTHER_PARAGRAPH_SECRET</p><p id="a">接口返回思考内容时会按原有纯文本帧队列显示思考过程。可编辑区域、代码和保护祖先中的文本不发送。</p></article>');
  let s=await select('#a','帧队列');assert.equal(s.analysis.category,'phrase');assert.ok(s.context.sentence.after.includes('显示思考过程'));assert.ok(!JSON.stringify(s.context).includes('祖先'));assert.ok(!JSON.stringify(s.context).includes('SECRET'));
  s=await select('#a','祖先');assert.equal(s.analysis.category,'phrase');assert.ok(s.context.sentence.before.includes('保护'));assert.ok(!JSON.stringify(s.context).includes('帧队列'));
  await sample('<p id="a">这是一个好的开始，它能帮助读者理解。</p>');s=await select('#a','这是一个好的');assert.equal(s.analysis.category,'fragment');assert.equal(s.analysis.completeness,'dependent');
  s=await select('#a','它');assert.equal(s.analysis.category,'fragment');assert.equal(s.context.budget,2500);
  await sample('<p id="a" lang="ja">東京大学</p>');s=await select('#a','東京大学');assert.equal(s.analysis.language,'ja');assert.equal(s.context.lang,'ja');assert.ok(contextLength(s.context)<=s.context.budget);
 });
 await check('definition with an explicit antecedent retains relevant prior block',async()=>{
  await sample('<article><p>DEFINITION_ANCHOR: Store a recent result for reuse.</p><p id="a">This is called a cache.</p></article>');
  const s=await select('#a','cache');assert.equal(s.analysis.category,'word');assert.equal(s.analysis.contextDependency,true);assert.ok(s.context.before.includes('DEFINITION_ANCHOR'));assert.equal(s.context.budget,2500);assert.ok(contextLength(s.context)<=2500);
 });
 await check('actual selection across inline tags and second identical word',async()=>{
  await sample('<article><p id="a">The bank issued a loan. They sat on the <strong>bank</strong> of the river.</p></article>');
  const s=await select('#a','bank',1);assert.ok(s.context.sentence.before.endsWith('the '));assert.ok(s.context.sentence.after.includes('river'));assert.ok(!JSON.stringify(s.context).includes('loan'));
  const cross=await select('#a','the bank of');assert.equal(cross.text,'the bank of');assert.ok(cross.context.sentence.after.includes('river'));
  assert.equal(cross.analysis.mode,'A');
  await sample('<p id="a">The reconstruction is complete.</p>');const part=await select('#a','construct');assert.equal(part.analysis.category,'fragment');assert.ok(part.analysis.reason.includes('单词内部'));
 });
 await check('outer selected whitespace preserves source sentence and independent response',async()=>{
  await sample('<p id="a">The bank offers loans.</p>');
  let s=await select('#a',' bank ');assert.equal(s.text,'bank');assert.equal(s.context.sentence.before,'The ');assert.equal(s.context.sentence.after,' offers loans.');assert.equal(s.analysis.category,'word');assert.equal(await page.evaluate(()=>getSelection().getRangeAt(0).toString()),' bank ');
  await select('#a',' bank ',0,true);await done();const data=materials(requests.at(-1).messages[1].content);assert.equal(data['选中文字'],'bank');assert.equal(data['所在句子'],'The 【bank】 offers loans.');
  await sample('<p id="a">  好的  </p>');s=await select('#a','  好的  ');assert.equal(s.text,'好的');assert.equal(s.analysis.category,'response');assert.equal(s.context.sentence.before,'  ');assert.equal(s.context.sentence.after,'  ');assert.ok(contextLength(s.context)<=s.context.budget);
 });
 await check('rich paragraphs, heading metadata and no hidden/navigation pollution',async()=>{
  await sample('<article><h2>Financial terminology</h2><p>Previous context '+ 'A'.repeat(350)+'</p><p id="a">She went to the <span hidden>HIDDEN_SECRET</span><span style="display:none">CSS_SECRET</span>bank to withdraw money.</p><p>Next useful context.</p><nav>NAV_SECRET</nav></article>');
  const s=await select('#a','bank');assert.equal(s.context.before,'');assert.equal(s.context.after,'');assert.equal(s.context.sentence.before,'She went to the ');assert.ok(s.context.sentence.after.includes('withdraw money'));assert.ok(s.context.details.includes('Financial terminology'));assert.ok(!JSON.stringify(s.context).includes('SECRET'));timings.push(s.ms);
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
  const s=await select('#a','UNIQUE_TARGET');const c=s.context;assert.ok(contextLength(c)<=1500);assert.ok(!JSON.stringify(c).includes('UNIQUE_TARGET'));assert.equal(c.sentence.complete,false);timings.push(s.ms);
 });
 await check('element Range boundaries, BR separators, rich dependency budget and emoji fallback',async()=>{
  await sample('<article><p id="a">Earlier line<br>prefix <b>它</b> suffix<br>Later line</p></article>');
  let s=await select('#a','它');assert.ok((s.context.before+s.context.sentence.before).includes('Earlier line\nprefix '));assert.ok((s.context.sentence.after+s.context.after).includes(' suffix\nLater line'));assert.equal(s.context.budget,2500);assert.ok(contextLength(s.context)<=2500);
  await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#a'));getSelection().removeAllRanges();getSelection().addRange(r);});
  s=await isolated('capture',await page.evaluate(()=>getSelection().toString().trim()));assert.equal(s.context.before,'');assert.equal(s.context.after,'');
  assert.equal(analyze('🙂').confidence,'low');
 });
 await check('single character triggers actual extension and one request with classified prompt',async()=>{
  await sample('<p id="a">行</p>');const count=requests.length;await select('#a','行',0,true);await done();assert.equal(requests.length,count+1);assert.equal(requests.at(-1).model,'qa-explain');assert.equal(materials(requests.at(-1).messages[1].content)['选中文字'],'行');
 });
 await check('foreign short sentence translates; explanation reuses frozen context after collapse',async()=>{
  await sample('<article><p>CONTEXT_ANCHOR: They discuss a useful tool.</p><p id="a">It is useful</p></article>');await select('#a','It is useful',0,true);await done();assert.equal(requests.at(-1).model,'qa-translate');assert.ok(requests.at(-1).messages[1].content.includes('CONTEXT_ANCHOR'));
  await page.evaluate(()=>getSelection().removeAllRanges());await page.locator('.ds-btn-explain-this').click();await done();assert.equal(requests.at(-1).model,'qa-explain');assert.ok(requests.at(-1).messages[1].content.includes('CONTEXT_ANCHOR'));assert.ok(requests.at(-1).messages[1].content.includes('任务：'));
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
 }
}catch(e){console.error(e.stack);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));
 writeFileSync(resolve(output,nodeOnly?'node-report.json':'report.json'),JSON.stringify({date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,browser:version,profile:nodeOnly?null:relative(root,profile),checks,timings,requestCount:requests.length,requests,boundary:nodeOnly?'Node VM classification only. No DOM/browser or provider execution.':'Synthetic pages and synthetic localhost SSE. No real model quality, credentials or billing measured.'},null,2)+'\n');
}
