const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8')
  .replace(/^import .*?;\s*$/gm,'')
  .replace(/^export (?=(?:async )?function\s)/gm,'') + '\nmodule.exports={transfer,undoOp};';
const from='content://provider/tree/from',to='content://provider/tree/to';
const name='short_clip.mp4';
const orig=from+'/'+name, dest=to+'/'+name;
const backing=new Map();const folders=new Set([from,to]);
let nativeCalls=[],copyCalls=0,listCalls=0;
let nativeMode='ok';
class Directory {
  constructor(...items){this.uri=items.map(x=>x.uri||x).join('/');}
  get exists(){return folders.has(this.uri);}
  create(){folders.add(this.uri);}
  list(){listCalls++;const prefix=this.uri+'/';return [...backing.keys()].filter(u=>u.startsWith(prefix)&&!u.slice(prefix.length).includes('/')).map(u=>new File(u));}
}
class File {
  constructor(...items){this.uri=items.map(x=>x.uri||x).join('/');}
  get exists(){return backing.has(this.uri);}
  get size(){return backing.get(this.uri)?.size||0;}
  get name(){return this.uri.split('/').pop();}
  async copy(toFileOrDirectory){copyCalls++;const target=toFileOrDirectory instanceof Directory?toFileOrDirectory.uri+'/'+this.name:toFileOrDirectory.uri;if(backing.has(target))throw Error('Collision');backing.set(target,{...backing.get(this.uri)});}
  delete(){backing.delete(this.uri);}
}
async function moveAndroidDocument(uri,fromDir,toDir){
  nativeCalls.push([uri,fromDir,toDir]);
  if(nativeMode==='unsupported')throw Error('IKS_NATIVE_MOVE_UNSUPPORTED: provider');
  if(nativeMode==='error')throw Error('Ambiguous provider failure');
  const target=toDir+'/'+name;
  if(backing.has(target))throw Error('Destination already contains an item named short_clip.mp4');
  if(!backing.has(uri))throw Error('Source missing');
  backing.set(target,backing.get(uri));backing.delete(uri);return target;
}
const ctx={Directory,File,Paths:{document:'file://private'},isMedia:()=>true,renameAndroidDocument:()=>{},moveAndroidDocument,module:{exports:{}},Date,Math,console};
vm.runInNewContext(source,ctx,{filename:'storage.js'});
const {transfer,undoOp}=ctx.module.exports;
const entry={uri:orig,name,size:15*1024*1024};
const reset=()=>{backing.clear();backing.set(orig,{size:entry.size});nativeCalls=[];copyCalls=0;listCalls=0;nativeMode='ok';};
(async()=>{
  reset();
  let op=await transfer(entry,to,false,from);
  assert.equal(op.strategy,'native');assert.equal(op.type,'move');assert.equal(op.toUri,dest);assert.equal(copyCalls,0);assert.equal(listCalls,0);
  assert(!backing.has(orig) && backing.has(dest));
  await undoOp(op,from);
  assert(backing.has(orig) && !backing.has(dest));assert.equal(copyCalls,0);assert.equal(nativeCalls.length,2);
  reset();
  op=await transfer(entry,to,true,from);
  assert.equal(op.type,'copy');assert.equal(nativeCalls.length,0);assert.equal(copyCalls,1);assert(backing.has(orig)&&backing.has(dest));
  reset();nativeMode='unsupported';
  op=await transfer(entry,to,false,from);
  assert.equal(op.type,'move');assert.equal(op.strategy,'copy-delete');assert.equal(copyCalls,1);assert.match(op.warning,/slower/);assert(!backing.has(orig)&&backing.has(dest));
  reset();nativeMode='error';
  await assert.rejects(transfer(entry,to,false,from),/Ambiguous provider failure/);
  assert.equal(copyCalls,0);assert(backing.has(orig));
  reset();backing.set(dest,{size:20});
  await assert.rejects(transfer(entry,to,false,from),/already contains/);
  assert.equal(copyCalls,0);assert.equal(backing.get(dest).size,20);assert(backing.has(orig));
  reset();
  // Old three-argument callers remain supported via the conservative path.
  op=await transfer(entry,to,false);
  assert.equal(op.strategy,'copy-delete');assert.equal(copyCalls,1);assert(!backing.has(orig));
  const k=fs.readFileSync(path.join(__dirname,'../modules/iks-document-rename/android/src/main/java/expo/modules/iksdocumentrename/IksDocumentRenameModule.kt'),'utf8');
  assert.match(k,/DocumentsContract\.moveDocument/);assert.match(k,/Document\.FLAG_SUPPORTS_MOVE/);assert.match(k,/IKS_NATIVE_MOVE_UNSUPPORTED/);
  const app=fs.readFileSync(path.join(__dirname,'../App.js'),'utf8');
  assert.match(app,/transfer\(current,target,copyOnly,sourceUri\)/);assert.match(app,/setFiles\(items=>items\.filter\(f=>f\.uri!==current\.uri\)\)/);
  console.log('PASS: native no-copy move & undo; copy-only; provider fallback; collision; ambiguous failure; legacy fallback; immediate UI removal');
})().catch(e=>{console.error(e);process.exitCode=1});
