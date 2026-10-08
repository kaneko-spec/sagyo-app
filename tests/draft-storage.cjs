const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=process.argv[2]||path.join(__dirname,'patched');
let passed=0,failed=0;
for(const name of ['aperta.html','byd.html']){
 const html=fs.readFileSync(path.join(dir,name),'utf8');
 const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 new vm.Script(script,{filename:name});
 function fn(name){const re=new RegExp('  function '+name+'\\([^]*?\\n  \\}');const m=script.match(re);assert(m,'missing '+name);return m[0];}
 function setup(){
  const timers=new Map(),events={window:{},document:{}},saved=[],warning={hidden:true},retry={};let id=0,blocked=false;
  const ctx=vm.createContext({STORAGE_KEY:script.match(/var STORAGE_KEY = '([^']+)'/)[1],storageAvailable:true,saveTimer:null,savePending:false,currentDraftId:'a',formData:{customerName:'latest A'},store:{currentId:'a',drafts:[{id:'a',createdAt:1,updatedAt:1,data:{customerName:'old A'}},{id:'b',createdAt:2,updatedAt:2,data:{customerName:'old B'}}],history:{carModels:['existing model'],workNotes:{}},staffNames:['existing staff']},localStorage:{setItem(k,v){if(blocked)throw new Error('quota');saved.push({key:k,value:JSON.parse(v)});}},document:{visibilityState:'visible',getElementById(n){if(n==='storageWarning')return warning;if(n==='btnRetrySave')return {addEventListener(e,f){retry[e]=f;}};return null;},addEventListener(n,f){events.document[n]=f;}},window:{addEventListener(n,f){events.window[n]=f;},scrollTo(){},confirm(){return true;}},setTimeout(f){timers.set(++id,f);return id;},clearTimeout(i){timers.delete(i);},mergeFormData(d){return JSON.parse(JSON.stringify(d));},createEmptyFormData(){return {customerName:''};},genId(){return 'new';},addDaysToTodayStr(){return '2026-10-01';},populateFormToUI(){},closeModal(){},showToast(t){ctx.toast=t;},openHistoryModal(){},onDocClick(){},onFieldInput(){},onFieldFocusOut(){},onSelectChange(){}});
  const names=['mergeFormData','safeSaveStore','scheduleSave','persistDraft','startNewDraft','handleNewDraftClick','handleLoadDraft','handleDeleteDraft','wireEvents'];
  vm.runInContext(names.map(fn).join('\n'),ctx);
  if(script.includes('  function flushPendingSave()')){const a=script.indexOf('  function flushPendingSave()');const b=script.indexOf('  function startNewDraft',a);vm.runInContext(script.slice(a,b),ctx);}
  ctx.formData=ctx.mergeFormData(ctx.store.drafts[0].data);
  ctx.formData.customerName='latest A';
  return {ctx,timers,events,saved,warning,retry,block(v){blocked=v;},run(){const jobs=[...timers.values()];timers.clear();jobs.forEach(f=>f());}};
 }
 function test(label,f){try{f();passed++;console.log('PASS '+name+' '+label);}catch(e){failed++;console.log('FAIL '+name+' '+label+': '+e.message);}}
 test('immediate history switch preserves restored draft latest edit',()=>{const s=setup();s.ctx.scheduleSave();s.ctx.handleLoadDraft('b');s.run();assert.equal(s.ctx.store.drafts.find(d=>d.id==='a').data.customerName,'latest A');assert.equal(s.ctx.currentDraftId,'b');});
 test('immediate New preserves restored draft latest edit',()=>{const s=setup();s.ctx.scheduleSave();s.ctx.handleNewDraftClick();s.run();assert.equal(s.ctx.store.drafts.find(d=>d.id==='a').data.customerName,'latest A');assert.equal(s.ctx.currentDraftId,'new');});
 test('pagehide flushes latest edit once',()=>{const s=setup();s.ctx.scheduleSave();s.events.window.pagehide();s.events.window.pagehide();assert.equal(s.saved.length,1);assert.equal(s.timers.size,0);assert.equal(s.saved[0].value.drafts[0].data.customerName,'latest A');});
 test('hidden tab flushes; visible tab does not',()=>{const s=setup();s.ctx.scheduleSave();s.events.document.visibilitychange();assert.equal(s.saved.length,0);s.ctx.document.visibilityState='hidden';s.events.document.visibilitychange();assert.equal(s.saved.length,1);});
 test('quota failure visible, in-memory data retained, retry succeeds',()=>{const s=setup();s.ctx.wireEvents();s.block(true);s.ctx.scheduleSave();s.run();assert.equal(s.warning.hidden,false);assert.equal(s.ctx.savePending,true);assert.equal(s.ctx.store.drafts[0].data.customerName,'latest A');s.block(false);s.retry.click();assert.equal(s.warning.hidden,true);assert.equal(s.ctx.savePending,false);assert.equal(s.ctx.toast,'保存済み ✓');assert.equal(s.saved[0].value.drafts[0].data.customerName,'latest A');});
 test('failed retry does not report success',()=>{const s=setup();s.ctx.wireEvents();s.block(true);s.retry.click();assert.match(s.ctx.toast,/保存できませんでした/);});
 test('confirmed delete does not resurrect draft after queued save',()=>{const s=setup();s.ctx.scheduleSave();s.ctx.handleDeleteDraft('a');s.run();assert(!s.ctx.store.drafts.some(d=>d.id==='a'));assert.equal(s.ctx.currentDraftId,'new');});
 test('cancelled delete leaves edit pending and untouched',()=>{const s=setup();s.ctx.window.confirm=()=>false;s.ctx.scheduleSave();s.ctx.handleDeleteDraft('a');s.run();assert.equal(s.ctx.currentDraftId,'a');assert.equal(s.ctx.store.drafts[0].data.customerName,'latest A');});
 test('unrelated history, staff and noncurrent draft data preserved',()=>{const s=setup();s.ctx.scheduleSave();s.run();const out=s.saved[0].value;assert.equal(s.saved[0].key,script.match(/var STORAGE_KEY = '([^']+)'/)[1]);assert.deepEqual(out.history,{carModels:['existing model'],workNotes:{}});assert.deepEqual(out.staffNames,['existing staff']);assert.equal(out.drafts[1].data.customerName,'old B');});
 test('debounced repeated edits save latest only',()=>{const s=setup();s.ctx.scheduleSave();s.ctx.formData.customerName='newest A';s.ctx.scheduleSave();assert.equal(s.timers.size,1);s.run();assert.equal(s.saved.length,1);assert.equal(s.saved[0].value.drafts[0].data.customerName,'newest A');});
}
console.log(JSON.stringify({dir,passed,failed}));process.exitCode=failed?1:0;
