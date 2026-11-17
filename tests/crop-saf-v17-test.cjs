const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const storage=fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8')
  .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function makeHarness(){
 const dirs=new Set(['content://images','content://recovery','file:///doc','file:///cache']);
 const data=new Map([['content://images/photo.jpg',Buffer.from('ORIGINAL')],['file:///cache/output.jpg',Buffer.from('CROPPED')]]);
 const flags={failPending:false,failFinalCopy:false,failRestore:false};
 let originalWrite=0,contentRenames=0;
 class Directory{
  constructor(p,n){const base=p.uri||p;this.uri=n?base+'/'+n:base}
  get exists(){return dirs.has(this.uri)}
  create(){dirs.add(this.uri)}
  list(){return [...data.keys()].filter(k=>k.startsWith(this.uri+'/')&&!k.slice(this.uri.length+1).includes('/')).map(k=>new File(k))}
  delete(){for(const k of [...data.keys()])if(k.startsWith(this.uri+'/'))data.delete(k);dirs.delete(this.uri)}
 }
 class File{
  constructor(p,n){const base=p.uri||p;this.uri=n?base+'/'+n:base}
  get exists(){return data.has(this.uri)}
  get size(){return data.get(this.uri)?.length||0}
  get name(){return decodeURIComponent(this.uri.split('/').pop())}
  async copy(dest){
   if(!this.exists)throw Error('missing source');
   const to=dest instanceof Directory?dest.uri+'/'+this.name:dest.uri;
   if(data.has(to))throw Error('Refused overwrite');
   if(flags.failPending&&to.includes('__iks_pending'))throw Error('fail pending');
   if(to==='content://images/photo.jpg'){
    originalWrite++;
    if(flags.failFinalCopy&&originalWrite===1)throw Error('fail final copy');
    if(flags.failRestore&&originalWrite>1)throw Error('fail restore');
   }
   if(dest instanceof File && to.startsWith('content://'))throw Error('Cannot write content URI');
   data.set(to,Buffer.from(data.get(this.uri)));
  }
  rename(newName){if(this.uri.startsWith('content://')){contentRenames++;throw Error('SAF rename rejected')}
   const next=this.uri.replace(/[^/]+$/,newName);
   if(data.has(next))throw Error('collision');
   data.set(next,data.get(this.uri));data.delete(this.uri);this.uri=next;
  }
  delete(){if(!this.exists)throw Error('missing');data.delete(this.uri)}
 }
 const ctx={Directory,File,Paths:{document:'file:///doc',cache:'file:///cache'},Math,Date,Error,console,isMedia:()=>true};
 vm.createContext(ctx);vm.runInContext(storage+'\nthis.api={replaceWithCrop,undoOp,backupCount,listCropBackups,recoverCropBackup};',ctx);
 return {api:ctx.api,data,flags,getRenameCount:()=>contentRenames};
}
(async()=>{
 {const h=makeHarness();const op=await h.api.replaceWithCrop({name:'photo.jpg',uri:'content://images/photo.jpg'},'file:///cache/output.jpg','content://images');
  assert.equal(h.data.get('content://images/photo.jpg').toString(),'CROPPED');
  assert.equal(op.type,'crop');assert(op.backupUri.startsWith('file://'));
  assert.equal(h.data.get(op.backupUri).toString(),'ORIGINAL');
  assert.equal(h.getRenameCount(),0);
  const backups=h.api.listCropBackups();assert.equal(backups.length,1);
  const recovered=await h.api.recoverCropBackup(backups[0].uri,'content://recovery');
  assert.equal(h.data.get(recovered.uri).toString(),'ORIGINAL');
  assert.equal(h.api.listCropBackups().length,1,'backup preserved after recovery');
  await h.api.undoOp(op,'content://images');
  assert.equal(h.data.get('content://images/photo.jpg').toString(),'ORIGINAL');
  assert.equal(h.getRenameCount(),0);
 }
 {const h=makeHarness();h.flags.failPending=true;
  await assert.rejects(h.api.replaceWithCrop({name:'photo.jpg',uri:'content://images/photo.jpg'},'file:///cache/output.jpg','content://images'),/Original image remains unchanged/);
  assert.equal(h.data.get('content://images/photo.jpg').toString(),'ORIGINAL');
 }
 {const h=makeHarness();h.flags.failFinalCopy=true;
  await assert.rejects(h.api.replaceWithCrop({name:'photo.jpg',uri:'content://images/photo.jpg'},'file:///cache/output.jpg','content://images'),/Original image restored/);
  assert.equal(h.data.get('content://images/photo.jpg').toString(),'ORIGINAL');
 }
 {const h=makeHarness();h.flags.failFinalCopy=true;h.flags.failRestore=true;
  await assert.rejects(h.api.replaceWithCrop({name:'photo.jpg',uri:'content://images/photo.jpg'},'file:///cache/output.jpg','content://images'),/original image is still in app-private crop backups/i);
  assert(!h.data.has('content://images/photo.jpg'));
  assert([...h.data.keys()].some(k=>k.includes('/crop-backups/')));
 }
 console.log('PASS v17: SAF crop stage, replacement, undo, rejected stage, failed final copy, restoration, retained backup');
})().catch(e=>{console.error(e);process.exitCode=1});
