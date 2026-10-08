const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let pass=0,fail=0;
for(const name of ['aperta','byd','gorucha-uriage']){
 const src=fs.readFileSync(`${process.argv[2]||'sagyo-followup/candidate'}/${name}.html`,'utf8');
 const cafe=name==='gorucha-uriage';
 const fn=n=>{const m=src.match(new RegExp('  function '+n+'\\([^]*?\\n  \\}')); if(!m)throw Error(n);return m[0];};
 for(const [label,raw,readThrows,blocked] of [['broken JSON','{"drafts":',false,true],['null root','null',false,true],['array root','[]',false,true],['read denied','existing value',true,true],['empty store',null,false,false],['valid round trip',JSON.stringify(cafe?{settings:{comma:false,links:[],months:{},integration:{gasUrl:'',appToken:''}},days:{'2026-10-02':{tenpo:123}}}:{currentId:'x',drafts:[{id:'x',data:{customerName:'金子😀'}}],history:{carModels:[],workNotes:{}},staffNames:[]}),false,false]]){
 let saved=raw,writes=0;const warning={hidden:true};const ctx={storageReadFailed:false,storageAvailable:true,STORAGE_KEY:'test',saveTimer:null,savePending:true,document:{getElementById:()=>warning},clearTimeout(){},localStorage:{getItem(){if(readThrows)throw Error('denied');return raw},setItem(k,v){writes++;saved=v}},defaultStore:()=>({settings:{},days:{}}),defaultLinks:()=>[],defaultIntegration:()=>({gasUrl:'',appToken:''})};
 vm.createContext(ctx);vm.runInContext(fn(cafe?'loadStore':'safeLoadStore')+'\n'+fn(cafe?'saveStoreNow':'safeSaveStore'),ctx);
 try{vm.runInContext('store='+(cafe?'loadStore()':'safeLoadStore()'),ctx);for(let i=0;i<10;i++)vm.runInContext(cafe?'saveStoreNow()':'safeSaveStore(store)',ctx);if(blocked){assert.equal(writes,0);assert.equal(saved,raw);assert.equal(warning.hidden,false);}else{assert.equal(writes,10);assert.deepEqual(JSON.parse(saved),JSON.parse(JSON.stringify(ctx.store)));}console.log('PASS',name,label);pass++}catch(e){console.log('FAIL',name,label,e.message);fail++}
 }
}
console.log({pass,fail});process.exitCode=fail?1:0;
