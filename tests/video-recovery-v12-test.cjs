// Simulated Android provider: File.rename() FAILS on content://; only file://
// private staging files support it. Tests that no deleted original is lost.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../src/storage.js'),'utf8')
  .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function harness(name='movie.mp4'){
  const data=new Map(),dirs=new Set(['content://src','content://restore','file:///doc','file:///cache']);
  const flags={failPending:false,failPrivateRename:false,failFinalCopy:false,failRestore:false,partialFinal:false,failDeleteAfterDeletion:false};
  let originalCopyCount=0,privateRenameCount=0,safRenameCount=0;
  const join=(parent,n)=>parent.replace(/\/$/,'')+'/'+n;
  class Directory{
    constructor(p,n){this.uri=n?join(p.uri||p,n):p.uri||p}
    get exists(){return dirs.has(this.uri)}
    create(){dirs.add(this.uri)}
    list(){return [...data.keys()].filter(k=>k.startsWith(this.uri+'/')&&!k.slice(this.uri.length+1).includes('/')).map(k=>new File(k))}
    delete(){for(const k of [...data.keys()])if(k.startsWith(this.uri+'/'))data.delete(k);dirs.delete(this.uri)}
  }
  class File{
    constructor(p,n){this.uri=n?join(p.uri||p,n):p.uri||p}
    get name(){return decodeURIComponent(this.uri.split('/').pop())}
    get exists(){return data.has(this.uri)}
    get size(){return data.get(this.uri)?.length??0}
    async copy(target){
      const out=target instanceof Directory?join(target.uri,this.name):target.uri;
      if(!this.exists)throw new Error('Missing source '+this.uri);
      if(data.has(out))throw new Error('Refusing overwrite');
      if(flags.failPending&&/__iks_pending_/.test(out))throw new Error('pending copy failure');
      if(out==='content://src/'+name){
        originalCopyCount++;
        if(originalCopyCount===1 && flags.failFinalCopy){
          if(flags.partialFinal)data.set(out,Buffer.from('X'));
          throw new Error('final copy rejected');
        }
        if(originalCopyCount>1 && flags.failRestore)throw new Error('restore copy rejected');
      }
      data.set(out,Buffer.from(data.get(this.uri)));
    }
    rename(filename){
      if(this.uri.startsWith('content://')) {safRenameCount++;throw new Error('This method cannot be used with content URIs');}
      privateRenameCount++;
      if(flags.failPrivateRename)throw new Error('local file rename failed');
      const out=this.uri.replace(/[^/]+$/,filename);
      if(data.has(out))throw new Error('collision');
      if(!data.has(this.uri))throw new Error('file missing');
      data.set(out,data.get(this.uri));data.delete(this.uri);this.uri=out;
    }
    delete(){
      if(!data.has(this.uri))throw new Error('already deleted');
      data.delete(this.uri);
      if(flags.failDeleteAfterDeletion&&this.uri.startsWith('content://src')&&this.name===name)throw new Error('provider delete failed after deletion');
    }
  }
  const context={Directory,File,Paths:{document:'file:///doc',cache:'file:///cache'},isMedia:()=>true,Date,Math,Error,console};
  vm.createContext(context);
  vm.runInContext(source+'\nthis.API={replaceWithCut,recoverVideoBackup,listVideoCutBackups,undoOp};',context);
  const uri='content://src/'+name;
  const seed=()=>{data.set(uri,Buffer.from('ORIGINAL_VIDEO'));data.set('file:///cache/output.mp4',Buffer.from('CLIP'))};
  return {data,api:context.API,seed,name,uri,flags,getCalls:()=>({originalCopyCount,privateRenameCount,safRenameCount})};
}
(async()=>{
  {const h=harness();h.seed();
    const op=await h.api.replaceWithCut({name:h.name,uri:h.uri},'file:///cache/output.mp4','content://src');
    assert.equal(h.data.get(h.uri).toString(),'CLIP');
    assert.equal(h.api.listVideoCutBackups().length,1);
    assert.equal(h.data.get(h.api.listVideoCutBackups()[0].uri).toString(),'ORIGINAL_VIDEO');
    assert(![...h.data.keys()].some(k=>k.includes('__iks_pending_')));
    assert.equal(h.getCalls().safRenameCount,0);
    assert.equal(h.getCalls().privateRenameCount,1);
    await h.api.undoOp(op,'content://src');
    assert.equal(h.data.get(h.uri).toString(),'ORIGINAL_VIDEO');
    assert.equal(h.getCalls().safRenameCount,0);
  }
  {const h=harness('trip with spaces.mp4');h.seed();
    await h.api.replaceWithCut({name:h.name,uri:h.uri},'file:///cache/output.mp4','content://src');
    assert.equal(h.data.get(h.uri).toString(),'CLIP');
    assert.equal(h.getCalls().safRenameCount,0);
  }
  {const h=harness();h.seed();h.flags.failPending=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/original video remains/);
    assert.equal(h.data.get(h.uri).toString(),'ORIGINAL_VIDEO');
  }
  {const h=harness();h.seed();h.flags.failPrivateRename=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/original video remains/);
    assert.equal(h.data.get(h.uri).toString(),'ORIGINAL_VIDEO');
    assert.equal(h.api.listVideoCutBackups().length,1);
  }
  {const h=harness();h.seed();h.flags.failFinalCopy=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/Original restored from backup/);
    assert.equal(h.data.get(h.uri).toString(),'ORIGINAL_VIDEO');
    assert.equal(h.api.listVideoCutBackups().length,1);
    assert(![...h.data.keys()].some(k=>k.includes('__iks_pending_')));
  }
  {const h=harness();h.seed();h.flags.failFinalCopy=true;h.flags.failRestore=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/Recover original videos/);
    assert(!h.data.has(h.uri));
    assert.equal(h.api.listVideoCutBackups().length,1);
    assert([...h.data.keys()].some(k=>k.includes('__iks_pending_')));
    const original=h.api.listVideoCutBackups()[0];
    const recovered=await h.api.recoverVideoBackup(original.uri,'content://restore');
    assert.equal(recovered.name,h.name);
    assert.equal(h.data.get(recovered.uri).toString(),'ORIGINAL_VIDEO');
    assert.equal(h.api.listVideoCutBackups().length,1);
  }
  {const h=harness();h.seed();h.flags.failFinalCopy=true;h.flags.partialFinal=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/Cut could not be fully verified/);
    assert.equal(h.data.get(h.uri).toString(),'X'); // Never overwrites a possibly partial file.
    assert.equal(h.api.listVideoCutBackups().length,1);
    assert([...h.data.keys()].some(k=>k.includes('__iks_pending_')));
  }
  {const h=harness();h.seed();h.flags.failDeleteAfterDeletion=true;
    await assert.rejects(()=>h.api.replaceWithCut({name:h.name},'file:///cache/output.mp4','content://src'),/Original restored from backup/);
    assert.equal(h.data.get(h.uri).toString(),'ORIGINAL_VIDEO');
  }
  console.log('PASS v12: SAF rename rejected, cut success, names with spaces, undo, pre-delete failures, restored failure, failed recovery, partial output and delete throw');
})().catch(e=>{console.error(e);process.exitCode=1});
