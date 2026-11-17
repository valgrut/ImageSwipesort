// JS-only regression harness. Emulates Android SAF's refusal to accept
// constructed File(destinationDirectory, filename) as a write destination.
// This does NOT replace an on-device provider test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/storage.js'), 'utf8');
const code = source
  .replace(/^import .*?;\s*$/gm, '')
  .replace(/^export (?=(?:async )?function\s)/gm, '')
  + '\nmodule.exports={transfer,undoOp,softDelete};';
const backing = new Map();
const folders = new Set(['file://private','file://private/recycle-bin','content://provider/tree/Screenshots','content://provider/tree/Pictures']);
let copyToFolderCalls = 0;
let failCopy = false;
let failRemove = false;
let incorrectCopiedSize = false;
const join = (...p) => p.map((x) => typeof x === 'string' ? x : x.uri).join('/');
class Directory {
  constructor(...bits) {this.uri=join(...bits);}
  get exists(){return folders.has(this.uri);}
  create(){folders.add(this.uri);}
  list(){
    if (!this.exists) throw new Error('directory missing');
    const prefix = this.uri + '/';
    const found = [];
    for (const [uri, value] of backing) if (uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) found.push(new File(uri));
    return found;
  }
  delete(){for(const uri of [...backing.keys()])if(uri.startsWith(this.uri+'/'))backing.delete(uri);folders.delete(this.uri);}
}
class File {
  constructor(...bits) {this.uri=join(...bits);}
  get name(){return decodeURIComponent(this.uri.split('/').pop());}
  get exists(){return backing.has(this.uri);}
  get size(){return backing.get(this.uri)?.size ?? null;}
  async copy(dest) {
    if(failCopy)throw new Error('simulated SAF failure');
    if(dest instanceof File && dest.uri.startsWith('content://')){
      throw new Error('A folder with the same name already exists in the file location');
    }
    const target=dest instanceof Directory?dest.uri+'/'+this.name:dest.uri;
    if(dest instanceof Directory)copyToFolderCalls++;
    if(backing.has(target))throw new Error('file already exists');
    backing.set(target,{size:incorrectCopiedSize?1:this.size});
  }
  async move(dest) {await this.copy(dest);this.delete();}
  delete(){if(failRemove)throw new Error('Cannot delete source');backing.delete(this.uri);}
}
const context={Directory,File,Paths:{document:new Directory('file://private')},isMedia:()=>true,module:{exports:{}},Math,Date};
vm.runInNewContext(code,context,{filename:'storage.js'});
const {transfer,undoOp,softDelete}=context.module.exports;
const sourceDir='content://provider/tree/Screenshots';
const destDir='content://provider/tree/Pictures';
const name='shot_123.png';
const entry={uri:sourceDir+'/'+name,name,size:100};
function reset(){backing.clear();backing.set(entry.uri,{size:100});failCopy=false;failRemove=false;incorrectCopiedSize=false;copyToFolderCalls=0;}
(async()=>{
 reset();
 let op=await transfer(entry,destDir,false);
 assert.equal(op.type,'move');
 assert.equal(op.toUri,destDir+'/'+name);
 assert.equal(backing.has(entry.uri),false);
 assert.equal(backing.has(op.toUri),true);
 assert.equal(copyToFolderCalls,1,'copy should target Directory, never constructed SAF child File');
 await undoOp(op,sourceDir);
 assert.equal(backing.has(entry.uri),true);
 assert.equal(backing.has(op.toUri),false);

 reset();
 op=await transfer(entry,destDir,true);
 assert.equal(op.type,'copy');
 assert.equal(backing.has(entry.uri),true);
 await undoOp(op,sourceDir);
 assert.equal(backing.has(op.toUri),false);

 reset();backing.set(destDir+'/'+name,{size:66});
 await assert.rejects(transfer(entry,destDir,false),/already contains/);
 assert.equal(backing.get(destDir+'/'+name).size,66);
 assert.equal(backing.has(entry.uri),true);

 reset();failCopy=true;
 await assert.rejects(transfer(entry,destDir,false),/The original was kept/);
 assert.equal(backing.has(entry.uri),true);

 reset();incorrectCopiedSize=true;
 await assert.rejects(transfer(entry,destDir,false),/size mismatch/);
 assert.equal(backing.has(entry.uri),true);

 reset();failRemove=true;
 op=await transfer(entry,destDir,false);
 assert.equal(op.type,'copy','failed source deletion should be recorded as copy');
 assert.match(op.warning,/original could not be removed/);
 assert.equal(backing.has(entry.uri),true);
 failRemove=false;

 // Deletion/recovery uses a staging file with the original name.
 reset();op=await softDelete(entry);
 assert.equal(backing.has(entry.uri),false);
 assert.equal(backing.has(op.toUri),true);
 await undoOp(op,sourceDir);
 assert.equal(backing.has(entry.uri),true);
 assert.equal(backing.has(op.toUri),false);
 console.log('PASS: SAF folder transfer, undo move, undo copy, conflict, failed copy, failed verification, partial move, undo delete');
})().catch(e=>{console.error(e);process.exitCode=1;});
