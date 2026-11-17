const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src/storage.js'),'utf8')
  .replace(/^import .*?;\s*$/gm,'')
  .replace(/^export (?=(?:async )?function\s)/gm,'')
  +'\nmodule.exports={softDelete,undoOp,emptyTrash};';
const rootUri='content://provider/tree/screenshots';
const original=rootUri+'/a-15MB.mp4', bin=rootUri+'/document/.imagekeysort-trash-123456789';
const stored=bin+'/a-15MB.mp4';
let objects=new Map([[original,15*1024*1024]]),scans=0,copies=0,moves=0,nativeTrashCalls=0,emptyCalls=0;
let trashResultMode='ok',moveFails=false;
class Directory {
  constructor(...a){this.uri=a.map(x=>x.uri||x).join('/');}
  get exists(){return true;}
  create(){}
  list(){scans++;return [...objects.keys()].filter(p=>p.startsWith(this.uri+'/')&&!p.slice(this.uri.length+1).includes('/')).map(p=>new File(p));}
}
class File {
  constructor(...a){this.uri=a.map(x=>x.uri||x).join('/');}
  get name(){return this.uri.split('/').at(-1);}
  get exists(){return objects.has(this.uri);}
  get size(){return objects.get(this.uri)||0;}
  async copy(dest){copies++;const u=dest instanceof Directory?dest.uri+'/'+this.name:dest.uri;objects.set(u,objects.get(this.uri));}
  async move(dest){copies++;const u=dest.uri;objects.set(u,objects.get(this.uri));objects.delete(this.uri);}
  delete(){objects.delete(this.uri);}
}
async function moveAndroidDocumentToRecycle(uri,sourceTree,existingBin,folderName){
  nativeTrashCalls++;
  assert.equal(uri,original);assert.equal(sourceTree,rootUri);
  assert.equal(existingBin, nativeTrashCalls===1?null:bin);
  assert.match(folderName,/^\.imagekeysort-trash-[a-z0-9]{8,50}$/);
  if(trashResultMode==='unsupported')throw Error('IKS_NATIVE_TRASH_UNSUPPORTED: Provider declined before move');
  if(trashResultMode==='ambiguous')throw Error('Native recycle may have completed');
  assert(objects.has(uri));
  objects.set(stored,objects.get(uri));objects.delete(uri);
  return {movedUri:stored,trashUri:bin,recycleRootUri:bin};
}
async function moveAndroidDocument(uri,from,to){
  moves++;
  if(moveFails)throw Error('Provider failed after attempting restore');
  assert.equal(uri,stored);assert.equal(from,bin);assert.equal(to,rootUri);
  objects.set(original,objects.get(uri));objects.delete(uri);return original;
}
async function emptyAndroidRecycle(uri){emptyCalls++;assert.equal(uri,bin);let count=0;for(const k of [...objects.keys()])if(k.startsWith(bin+'/')){objects.delete(k);count++;}return count;}
const ctx={Directory,File,Paths:{document:'file://private'},isMedia:()=>true,
  renameAndroidDocument:()=>{},moveAndroidDocument,moveAndroidDocumentToRecycle,emptyAndroidRecycle,
  module:{exports:{}},Date,Math,console,Set};
vm.runInNewContext(code,ctx,{filename:'storage.js'});
const {softDelete,undoOp,emptyTrash}=ctx.module.exports;
(async()=>{
  const entry={uri:original,name:'a-15MB.mp4',size:15*1024*1024,video:true};
  let op=await softDelete(entry,rootUri);
  assert.equal(op.strategy,'native-trash');assert.equal(op.toUri,stored);assert.equal(op.toDirUri,bin);
  assert.equal(op.recycleRootUri,bin);assert.equal(op.size,entry.size);
  assert.equal(scans,0);assert.equal(copies,0);assert.equal(nativeTrashCalls,1);
  assert(objects.has(stored)&&!objects.has(original));
  const restored=await undoOp(op,rootUri);
  assert.equal(restored.strategy,'native-trash');assert.equal(restored.restoredUri,original);
  assert(objects.has(original)&&!objects.has(stored));assert.equal(scans,0);assert.equal(copies,0);
  // A second deletion reuses the per-source folder, even if the same file
  // was previously restored from it.
  op=await softDelete(entry,rootUri,bin);
  assert.equal(nativeTrashCalls,2);assert(objects.has(stored));
  assert.equal(await emptyTrash([bin,bin]),1);assert(!objects.has(stored));assert.equal(emptyCalls,1);
  // Explicitly unsupported providers retain the legacy private recycle bin.
  objects=new Map([[original,entry.size]]);copies=0;trashResultMode='unsupported';
  op=await softDelete(entry,rootUri,bin);
  assert.equal(op.strategy,'private-bin');assert.equal(copies,1);assert(!objects.has(original));
  // No blind copy if the native call might have moved a file already.
  objects=new Map([[original,entry.size]]);copies=0;trashResultMode='ambiguous';
  await assert.rejects(softDelete(entry,rootUri,bin),/may have completed/);
  assert.equal(copies,0);assert(objects.has(original));
  // If a restore is ambiguous, retain original Undo history and bin document.
  objects=new Map([[stored,entry.size]]);moveFails=true;
  await assert.rejects(undoOp({type:'delete',strategy:'native-trash',fromDirUri:rootUri,toDirUri:bin,toUri:stored},rootUri),/Provider failed/);
  assert(objects.has(stored));
  const app=fs.readFileSync(path.join(root,'App.js'),'utf8');
  assert.match(app,/setFiles\(items=>items\.filter\(f=>f\.uri!==current\.uri\)\)/);
  assert.match(app,/\(op\.type==='move' \|\| op\.type==='delete'\)/);
  assert.match(app,/emptyTrash\(Object\.values\(trashFolders\)\)/);
  assert.match(app,/setTrashFolders/);
  const kotlin=fs.readFileSync(path.join(root,'modules/iks-document-rename/android/src/main/java/expo/modules/iksdocumentrename/IksDocumentRenameModule.kt'),'utf8');
  assert.match(kotlin,/AsyncFunction\("moveToRecycle"\)/);
  assert.match(kotlin,/DocumentsContract\.moveDocument\(resolver, source, root, destination\)/);
  assert.match(kotlin,/AsyncFunction\("emptyRecycle"\)/);
  assert.match(kotlin,/getDocumentId\(fromTree\)/); // proper child parent on undo
  console.log('PASS v22: native no-copy reversible delete, direct UI update, fast Undo, legacy fallback, ambiguous errors, permanent trash and source isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
