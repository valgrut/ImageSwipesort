import {DIRS, cloneTree} from './model';

export const PRESET_FORMAT = 'image-swipesort-presets';
export const PRESET_SCHEMA = 1;
const DIR_SET = new Set(DIRS);

export function backupFilename(date=new Date()) {
  const f=v=>String(v).padStart(2,'0');
  return `image_swipesort_preset_${date.getFullYear()}-${f(date.getMonth()+1)}-${f(date.getDate())}.json`;
}
function cleanNode(value, depth, counter) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Preset contains an invalid swipe.');
  if(depth>24 || ++counter.count>1500)throw new Error('Preset tree is too large.');
  const children={};
  const rawChildren=value.children==null?{}:value.children;
  if(typeof rawChildren!=='object'||Array.isArray(rawChildren))throw new Error('Preset swipe children are invalid.');
  for(const direction of Object.keys(rawChildren)) {
    if(!DIR_SET.has(direction))throw new Error(`Preset contains an invalid direction: ${direction}`);
    children[direction]=cleanNode(rawChildren[direction], depth+1,counter);
  }
  const destination=value.destination;
  if(destination!=null && (typeof destination!=='string'||destination.length>4000))throw new Error('Preset has an invalid destination URI.');
  const name=typeof value.name==='string'?value.name:'';
  if(name.length>300)throw new Error('Preset contains an overly long name.');
  return {
    id:typeof value.id==='string'&&value.id.length<160?value.id:`imported-${counter.count}`,
    name:name||'Unnamed swipe',
    icon:typeof value.icon==='string'&&value.icon.length<32?value.icon:'📁',
    color:typeof value.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(value.color)?value.color:'#34d399',
    destination:destination||null, locked:!!value.locked, children
  };
}
export function parsePresetBackup(text) {
  let data;
  try {data=JSON.parse(text);}catch{throw new Error('File is not valid JSON.');}
  if(!data||typeof data!=='object'||data.format!==PRESET_FORMAT||data.version!==PRESET_SCHEMA) {
    throw new Error('Not an Image Swipesort preset backup, or unsupported format version.');
  }
  const counter={count:0};
  const tree=cleanNode(data.tree,0,counter);
  const originalPresets=data.presets||{};
  if(!originalPresets||typeof originalPresets!=='object'||Array.isArray(originalPresets))throw new Error('Saved presets are invalid.');
  const presets={};
  const presetNames=Object.keys(originalPresets);
  if(presetNames.length>100)throw new Error('Too many saved presets.');
  for(const name of presetNames) {
    if(name.length>200)throw new Error('Preset name too long.');
    Object.defineProperty(presets,name,{value:cleanNode(originalPresets[name],0,counter),enumerable:true,writable:true,configurable:true});
  }
  const tags=Array.isArray(data.tags)?data.tags.filter(t=>typeof t==='string'&&t.length<200).slice(0,300):[];
  const rect=data.cropRect;
  const cropRect=rect&&['x','y','w','h'].every(k=>typeof rect[k]==='number'&&Number.isFinite(rect[k])&&rect[k]>=0&&rect[k]<=1)
    ?{x:rect.x,y:rect.y,w:rect.w,h:rect.h}:null;
  if(cropRect && (cropRect.w===0||cropRect.h===0||cropRect.x+cropRect.w>1.001||cropRect.y+cropRect.h>1.001))throw new Error('Invalid crop rectangle in preset.');
  return {tree,presets,tags,cropRect};
}
export function makePresetBackup({tree,presets,tags,cropRect},date=new Date()) {
  return JSON.stringify({format:PRESET_FORMAT,version:PRESET_SCHEMA,exportedAt:date.toISOString(),
    // Source folder and undo history are deliberately excluded: both are
    // device-specific, and importing old undo URIs would be unsafe.
    tree:cloneTree(tree),presets:cloneTree(presets),tags:[...tags],cropRect},null,2);
}
export function scanDestinationIssues(root,canAccess) {
  const issues=[];
  function walk(node,route) {
    if(!node||typeof node!=='object')return;
    if(node.destination) {
      let reason=null;
      try {if(!canAccess(node.destination))reason='folder missing or permission unavailable';}
      catch(e) {reason=e?.message || 'folder unavailable';}
      if(reason)issues.push({id:node.id,name:node.name||'Unnamed swipe',path:route.join(' / ')||'Home',uri:node.destination,reason});
    }
    for(const d of DIRS)if(node.children?.[d])walk(node.children[d],[...route,`${d}: ${node.children[d].name||'Unnamed'}`]);
  }
  walk(root,[]);
  return issues;
}
export function missingDestinationsMessage(issues) {
  if(!issues.length)return '';
  const names=issues.slice(0,12).map(i=>`• ${i.path}`);
  if(issues.length>12)names.push(`… and ${issues.length-12} more`);
  return `${issues.length} swipe destination${issues.length===1?' is':'s are'} missing or inaccessible:\n\n${names.join('\n')}\n\nThese swipes are marked ⚠ and cannot be used as destinations. In Edit mode, select each swipe → Modify → Choose destination folder to reassign it.`;
}
