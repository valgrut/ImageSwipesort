const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const tags=fs.readFileSync(path.join(__dirname,'../src/tags.js'),'utf8').replace(/export /g,'');
const dir='content://phone/Pictures';
function env(){
 const files=new Map();let calls=0,copies=0,fail=false;
 const join=(p,n)=>p+'/'+n;
 class Directory{
  constructor(a,b){this.uri=b?join(a.uri||a,b):a.uri||a}
  get exists(){return this.uri===dir}
  list(){return [...files].filter(([uri])=>uri.startsWith(this.uri+'/')).map(([uri])=>new File(uri))}
 }
 class File{
  constructor(a,b){this.uri=b?join(a.uri||a,b):a.uri||a}
  get exists(){return files.has(this.uri)}
  get name(){return this.uri.slice(this.uri.lastIndexOf('/')+1)}
  get size(){return files.get(this.uri)?.length||0}
  async copy(){copies++;throw new Error('No copying needed to rename')}
  delete(){throw new Error('No deletion needed to rename')}
  rename(){throw new Error('File.rename unsupported for content URIs')}
 }
 async function renameAndroidDocument(uri,newName){
   calls++;
   if(fail)throw new Error('Provider denied rename');
   const next=join(dir,newName);
   files.set(next,files.get(uri));files.delete(uri);
   return next;
 }
 const context={Directory,File,Paths:{document:'file://private'},renameAndroidDocument,isMedia:()=>true,Date,Math,Error,console};
 vm.createContext(context);vm.runInContext(source+'\n'+tags+'\nthis.api={renameMedia,toggleTag,hasTag,undoOp};',context);
 return {files,api:context.api,put:(name,data)=>files.set(join(dir,name),Buffer.from(data)),stats:()=>({calls,copies}),fail:()=>{fail=true}};
}
(async()=>{
 {const h=env();h.put('photo.jpg','RAW');
  const tagName=h.api.toggleTag('photo.jpg','[Pole]');
  assert.equal(tagName,'photo [Pole].jpg');
  const op=await h.api.renameMedia({name:'photo.jpg',uri:dir+'/photo.jpg'},tagName,dir);
  assert.equal(h.files.get(op.afterUri).toString(),'RAW');
  assert(!h.files.has(dir+'/photo.jpg'));
  assert.equal(h.stats().copies,0);assert.equal(h.stats().calls,1);
  await h.api.undoOp(op,dir);assert(h.files.has(dir+'/photo.jpg'));
  assert.equal(h.stats().copies,0);assert.equal(h.stats().calls,2);
 }
 {const h=env();h.put('VID_2026.mp4','FAKE_1GB_VIDEO');
  await h.api.renameMedia({name:'VID_2026.mp4',uri:dir+'/VID_2026.mp4'},'VID_2026 [Screen].mp4',dir);
  assert.equal(h.stats().copies,0);assert(h.files.has(dir+'/VID_2026 [Screen].mp4'));
 }
 {const h=env();h.put('photo.jpg','A');h.put('renamed.jpg','B');
  await assert.rejects(()=>h.api.renameMedia({name:'photo.jpg',uri:dir+'/photo.jpg'},'renamed.jpg',dir),/already exists/);
  assert.equal(h.stats().calls,0);assert.equal(h.files.size,2);
 }
 {const h=env();h.put('photo.jpg','ORIGINAL');h.fail();
  await assert.rejects(()=>h.api.renameMedia({name:'photo.jpg',uri:dir+'/photo.jpg'},'new.jpg',dir),/Provider denied rename/);
  assert(h.files.has(dir+'/photo.jpg'));assert.equal(h.files.size,1);
 }
 const k=fs.readFileSync(path.join(__dirname,'../modules/iks-document-rename/android/src/main/java/expo/modules/iksdocumentrename/IksDocumentRenameModule.kt'),'utf8');
 assert.match(k,/DocumentsContract\.renameDocument/);
 assert.match(k,/AsyncFunction\("renameDocument"\)/);
 assert(!k.includes('deleteDocument('),'native rename must not delete documents');
 const app=fs.readFileSync(path.join(__dirname,'../App.js'),'utf8');
 assert.match(app,/await renameMedia\(current,newName,sourceUri\)/);
 assert.match(app,/await renameMedia\(current,s,sourceUri\)/);
 assert.match(app,/\(mode==='edit'\|\|copyOnly\)&&\{borderWidth:2,borderColor:'#34d399'\}/);
 console.log('PASS: Native rename, tag add/remove path, undo, video rename no-copy, provider error, collision, preview mode border');
})().catch(e=>{console.error(e);process.exitCode=1});
