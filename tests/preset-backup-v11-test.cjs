const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..');
const ctx={Date,JSON,Set,Object,Error,console};vm.createContext(ctx);
for(const file of ['src/model.js','src/presetBackup.js']){
  let code=fs.readFileSync(path.join(root,file),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
  vm.runInContext(code,ctx);
}
vm.runInContext('this.P={backupFilename,makePresetBackup,parsePresetBackup,scanDestinationIssues,missingDestinationsMessage};',ctx);
const p=ctx.P;
const tree={id:'root',name:'Home',children:{N:{id:'n',name:'My images',destination:'content://gone',children:{}},E:{id:'e',name:'Videos',destination:null,children:{SW:{id:'sw',name:'Tricks',destination:'content://ok',children:{}}}}}};
const data={tree,presets:{'General':tree},tags:['[Pole]','X and Y'],cropRect:{x:.1,y:.1,w:.8,h:.8}};
const date=new Date('2026-11-16T12:00:00');
assert.strictEqual(p.backupFilename(date),'image_swipesort_preset_2026-11-16.json');
const imported=p.parsePresetBackup(p.makePresetBackup(data,date));
assert.strictEqual(imported.tree.children.N.destination,'content://gone');
assert.deepStrictEqual([...imported.tags],['[Pole]','X and Y']);
assert.strictEqual(imported.presets.General.children.E.children.SW.name,'Tricks');
const issues=p.scanDestinationIssues(imported.tree,uri=>uri==='content://ok');
assert.strictEqual(issues.length,1);
assert.strictEqual(issues[0].name,'My images');
assert(p.missingDestinationsMessage(issues).includes('Edit mode'));
assert.throws(()=>p.parsePresetBackup('{broken'),/valid JSON/);
assert.throws(()=>p.parsePresetBackup('{}'),/Not an Image/);
const malicious=JSON.parse(p.makePresetBackup(data)); malicious.tree.children.MISSING={id:'o',name:'x'};
assert.throws(()=>p.parsePresetBackup(JSON.stringify(malicious)),/invalid direction/);
console.log('PASS preset JSON roundtrip, filename date, nested children, invalid destinations, malformed imports');
