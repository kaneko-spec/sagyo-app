const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = process.argv[2] || path.join(__dirname, 'patched/gorucha-uriage.html');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(script, { filename: file });
const start = script.indexOf('  var saveTimer = null;');
const end = script.indexOf('  function freshDay()', start);
assert(start >= 0 && end > start);
const manual = script.match(/document\.getElementById\('btnSaveNow'\)\.addEventListener\('click', function \(\) \{([\s\S]*?)\n    \}\);/)[1];
function setup() {
  const warning = {hidden:true};
  const events = {window:{}, document:{}};
  const timers = new Map();
  const data = new Map();
  let count = 0, blocked = false, writes = 0;
  const original = { settings:{comma:false,links:[{name:'test',url:'https://example.com/'}],months:{'2026-10':{target:100000}},integration:{gasUrl:'',appToken:''}}, days:{'2026-10-01':{tenpo:12000,good:'synthetic test note'}}};
  const ctx = vm.createContext({
    STORAGE_KEY:'gcc_uriage_v1', store:original,
    localStorage:{setItem(k,v){if(blocked)throw new Error('QuotaExceededError'); writes++; data.set(k,v);}},
    setTimeout(f){timers.set(++count,f);return count;},
    clearTimeout(id){timers.delete(id);},
    document:{visibilityState:'visible',getElementById(id){return id==='storageWarning'?warning:null;},addEventListener(n,f){events.document[n]=f;}},
    window:{addEventListener(n,f){events.window[n]=f;}},
    showToast(msg){ctx.lastToast=msg;}
  });
  vm.runInContext(script.slice(start,end),ctx);
  return {ctx,warning,data,timers,events,original,block(v){blocked=v;},writes(){return writes;},run(){const work=[...timers.values()];timers.clear();work.forEach(f=>f());},manual(){vm.runInContext(manual,ctx);}};
}
let passed=0,failed=0;
function test(name, fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
test('successful manual save uses original key and retains complete data',()=>{const s=setup();s.manual();assert.deepEqual(JSON.parse(s.data.get('gcc_uriage_v1')),s.original);assert.equal(s.ctx.lastToast,'保存済み ✓');});
test('failed manual save never reports success',()=>{const s=setup();s.block(true);s.manual();assert.match(s.ctx.lastToast,/保存できませんでした/);assert.equal(s.data.size,0);});
test('failed automatic save exposes persistent accessible warning',()=>{const s=setup();s.block(true);s.ctx.scheduleSave();s.run();assert.equal(s.warning.hidden,false);assert.match(html,/<p id="storageWarning" role="alert" hidden/);});
test('recovery hides warning and retains unchanged entered data',()=>{const s=setup();s.block(true);s.manual();s.block(false);s.manual();assert.equal(s.warning.hidden,true);assert.deepEqual(JSON.parse(s.data.get('gcc_uriage_v1')),s.original);assert.equal(s.ctx.lastToast,'保存済み ✓');});
test('repeated edits debounce to one write with latest data',()=>{const s=setup();s.ctx.scheduleSave();s.original.days['2026-10-01'].tenpo=14500;s.ctx.scheduleSave();assert.equal(s.timers.size,1);s.run();assert.equal(s.writes(),1);assert.equal(JSON.parse(s.data.get('gcc_uriage_v1')).days['2026-10-01'].tenpo,14500);});
test('manual save cancels obsolete pending timer',()=>{const s=setup();s.ctx.scheduleSave();s.manual();assert.equal(s.timers.size,0);assert.equal(s.writes(),1);});
test('pagehide flushes edits before debounce expires',()=>{const s=setup();s.ctx.scheduleSave();s.events.window.pagehide();assert.equal(s.writes(),1);assert.equal(s.timers.size,0);});
test('hidden tab flushes edits, visible tab does not',()=>{const s=setup();s.ctx.scheduleSave();s.events.document.visibilitychange();assert.equal(s.writes(),0);s.ctx.document.visibilityState='hidden';s.events.document.visibilitychange();assert.equal(s.writes(),1);});
test('repeated lifecycle events without pending changes do not overwrite storage',()=>{const s=setup();s.events.window.pagehide();assert.equal(s.writes(),0);s.ctx.scheduleSave();s.events.window.pagehide();s.events.window.pagehide();assert.equal(s.writes(),1);});
test('failed flush keeps pending changes for later retry',()=>{const s=setup();s.block(true);s.ctx.scheduleSave();s.events.window.pagehide();assert.equal(s.ctx.savePending,true);s.block(false);s.events.window.pagehide();assert.equal(s.writes(),1);assert.equal(s.ctx.savePending,false);});
console.log(JSON.stringify({file,passed,failed}));
process.exitCode=failed?1:0;
