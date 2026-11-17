// Simulated native trimmer events and Expo's temporary file access.
// Ensures no source mutation and that cancellation cleans the temporary cache.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'../src/videoCut.js'),'utf8')
 .replace(/^import .*?;\s*$/gm,'')
 .replace(/^export (?=(?:async )?function\s)/gm,'')+
 '\nmodule.exports={openVideoCutter,deleteCutOutput};';
const files=new Map();
const callbacks={};
let event='finish', inputUri=null, config=null;
class File {
 constructor(...parts){this.uri=parts.map(p=>typeof p==='string'?p:p.uri).join('/');}
 get exists(){return files.has(this.uri);}
 get size(){return files.get(this.uri)||0;}
 async copy(target){files.set(target.uri,this.size);}
 delete(){files.delete(this.uri);}
}
const VideoTrim={};
for (const type of ['onFinishTrimming','onCancel','onError','onHide']) {
 VideoTrim[type]=fn=>{callbacks[type]=fn;return {remove:()=>{if(callbacks[type]===fn)delete callbacks[type];}};};
}
function showEditor(uri, options){
 inputUri=uri;config=options;
 Promise.resolve().then(()=>{
  if(event==='finish') {files.set('file:///output.mp4',50);callbacks.onFinishTrimming({outputPath:'/output.mp4'});}
  else if(event==='cancel')callbacks.onCancel();
  else if(event==='error')callbacks.onError({message:'native encoder failure'});
 });
}
const sandbox={File,Paths:{cache:'file://cache'},VideoTrim,showEditor,module:{exports:{}},Math,Date};
vm.runInNewContext(src,sandbox,{filename:'videoCut.js'});
const {openVideoCutter,deleteCutOutput}=sandbox.module.exports;
const entry={uri:'content://source/video.mp4',name:'video.mp4'};
(async()=>{
 files.set(entry.uri,100);
 let output=await openVideoCutter(entry);
 assert.equal(output,'file:///output.mp4');
 assert.equal(files.get(entry.uri),100);
 assert.equal([...files.keys()].filter(x=>x.includes('iks-cut-input-')).length,0);
 assert.equal(config.enablePreciseTrimming,true);
 assert.equal(config.enableEditTools,false);
 deleteCutOutput(output);
 assert.equal(files.has(output),false);

 event='cancel';output=await openVideoCutter(entry);
 assert.equal(output,null);
 assert.equal(files.get(entry.uri),100);
 assert.equal([...files.keys()].filter(x=>x.includes('iks-cut-input-')).length,0);

 event='error';await assert.rejects(openVideoCutter(entry),/native encoder failure/);
 assert.equal(files.get(entry.uri),100);
 assert.equal([...files.keys()].filter(x=>x.includes('iks-cut-input-')).length,0);
 console.log('PASS: native adapter completion, cancellation, error cleanup, precise trim enabled');
})().catch(e=>{console.error(e);process.exitCode=1;});
