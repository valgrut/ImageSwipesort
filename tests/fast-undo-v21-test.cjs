const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..');
const gallery=fs.readFileSync(path.join(base,'src/undoGallery.js'),'utf8')
  .replace(/^export /gm,'')+'\nmodule.exports={restoreMovedMedia};';
const gCtx={module:{exports:{}},Number};
vm.runInNewContext(gallery,gCtx);
const {restoreMovedMedia}=gCtx.module.exports;
const from='content://provider/tree/from', to='content://provider/tree/to';
const original=from+'/VID_2.mp4', restored=from+'/VID_2-restored.mp4';
const media=[{uri:from+'/VID_1.mp4',name:'VID_1.mp4',video:true,size:100},
  {uri:from+'/VID_10.mp4',name:'VID_10.mp4',video:true,size:600}];
const op={type:'move',strategy:'native',name:'VID_2.mp4',size:15*1024*1024,video:true,
  fromUri:original,fromDirUri:from,toUri:to+'/VID_2.mp4',toDirUri:to};
const added=restoreMovedMedia(media,op,restored);
assert.equal(added.index,1);
assert.deepEqual(Array.from(added.files,x=>x.name),['VID_1.mp4','VID_2.mp4','VID_10.mp4']);
assert.equal(added.files[1].uri,restored);assert.equal(added.files[1].video,true);
assert.equal(added.files[1].size,15*1024*1024);
assert.equal(media.length,2,'input must not mutate');
assert.equal(restoreMovedMedia([...media,{name:'vid_2.mp4',uri:'stale://id'}],op,restored),null,
  'stale colliding gallery triggers a refresh');
const old=restoreMovedMedia(media,{type:'move',name:'PIC_2.jpg'},from+'/PIC_2.jpg',12000);
assert.equal(old.files.find(f=>f.name==='PIC_2.jpg').size,12000);
assert.equal(old.files.find(f=>f.name==='PIC_2.jpg').video,false);
assert.equal(restoreMovedMedia(media,op,null),null);

const storageText=fs.readFileSync(path.join(base,'src/storage.js'),'utf8')
  .replace(/^import .*?;\s*$/gm,'')
  .replace(/^export (?=(?:async )?function\s)/gm,'')+'\nmodule.exports={transfer,undoOp};';
const objects=new Map([[original,15*1024*1024]]);
const existsFolders=new Set([from,to]);
let moveCalls=0,folderScans=0,copyCalls=0,unsupported=false,fail=false;
class Directory {
  constructor(...parts){this.uri=parts.map(x=>x.uri||x).join('/');}
  get exists(){return existsFolders.has(this.uri);}
  list(){folderScans++;return Array.from(objects.keys()).filter(k=>k.startsWith(this.uri+'/')&&
    !k.slice(this.uri.length+1).includes('/')).map(u=>new File(u));}
}
class File {
  constructor(...parts){this.uri=parts.map(x=>x.uri||x).join('/');}
  get name(){return this.uri.split('/').at(-1);}
  get size(){return objects.get(this.uri)||0;}
  get exists(){return objects.has(this.uri);}
  async copy(directory){copyCalls++;objects.set(directory.uri+'/'+this.name,this.size);}
  delete(){objects.delete(this.uri);}
}
async function moveAndroidDocument(uri,fromDir,toDir){
  moveCalls++;
  if(unsupported)throw Error('IKS_NATIVE_MOVE_UNSUPPORTED: provider');
  if(fail)throw Error('I/O failure after native move attempt');
  const target=toDir+'/'+uri.split('/').at(-1);
  assert(objects.has(uri));
  objects.set(target,objects.get(uri));objects.delete(uri);
  return target;
}
const sCtx={Directory,File,Paths:{document:'file://private'},isMedia:()=>true,
  renameAndroidDocument:()=>{},moveAndroidDocument,module:{exports:{}},Date,Math,console};
vm.runInNewContext(storageText,sCtx,{filename:'storage.js'});
const {transfer,undoOp}=sCtx.module.exports;
(async()=>{
  const sent=await transfer({uri:original,name:'VID_2.mp4',size:15*1024*1024,video:true},to,false,from);
  assert.equal(sent.size,15*1024*1024);assert.equal(sent.video,true);
  assert.equal(sent.strategy,'native');assert.equal(folderScans,0);assert.equal(copyCalls,0);
  let undone=await undoOp(sent,from);
  assert.equal(undone.strategy,'native');assert.equal(undone.restoredUri,original);
  assert.equal(folderScans,0,'native Undo should not scan folders in storage.js');
  assert.equal(copyCalls,0,'native Undo should not copy video bytes');
  assert.equal(moveCalls,2);
  // A fallback (unsupported provider) should still return the real copied URI.
  unsupported=true;
  objects.delete(original);objects.set(to+'/VID_2.mp4',1000);
  const slow={...sent,strategy:'copy-delete',toUri:to+'/VID_2.mp4'};
  const fallback=await undoOp(slow,from);
  assert.equal(fallback.strategy,'copy-delete');assert.equal(fallback.restoredUri,original);
  assert.equal(objects.has(original),true);assert.equal(objects.has(slow.toUri),false);
  // Native ambiguous error must never silently trigger a copy.
  unsupported=false;fail=true;
  objects.delete(original);objects.set(to+'/VID_2.mp4',1000);
  const beforeCopies=copyCalls;
  await assert.rejects(undoOp(sent,from),/I\/O failure/);
  assert.equal(copyCalls,beforeCopies);
  assert.equal(objects.has(slow.toUri),true);
  const app=fs.readFileSync(path.join(base,'App.js'),'utf8');
  assert.match(app,/result\?\.restoredUri/);
  assert.match(app,/restoreMovedMedia\(files,op,result\.restoredUri,size\)/);
  assert.match(app,/else if\(op\.type==='copy'\)/);
  assert.match(app,/\[IKS perf\] undo/);
  // No unconditional full-folder scan following a native Undo.
  const block=app.slice(app.indexOf('async function undo(){'),app.indexOf('function renameFile(){'));
  assert(!/setHistory\(h=>h\.slice\(0,-1\)\);if\(!demo\)\{refresh\(/.test(block));
  console.log('PASS v21: native Undo URI, no copy/rescan, gallery insertion/natural sort, legacy metadata, provider fallback, failure safety');
})().catch(e=>{console.error(e);process.exitCode=1});
