const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cases=[['read-protection.cjs',root],['cafe-storage.cjs',path.join(root,'gorucha-uriage.html')],['draft-storage.cjs',root],['cafe-import.cjs',path.join(root,'gorucha-uriage.html')]];
for(const [name,target] of cases){const r=spawnSync(process.execPath,[path.join(__dirname,name),target],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
console.log('All 60 storage and import regression cases passed.');
