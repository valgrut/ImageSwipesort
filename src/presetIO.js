import {Directory, File, Paths} from 'expo-file-system';
import {backupFilename,makePresetBackup,parsePresetBackup} from './presetBackup';

function findFile(directory,name) {
  return directory.list().find(f=>f instanceof File && f.name.toLowerCase()===name.toLowerCase());
}
export async function exportSetup(data) {
  const chosen=await Directory.pickDirectoryAsync();
  if(!chosen)return null;
  const destination=new Directory(chosen.uri);
  const base=backupFilename();
  let filename=base;
  for(let i=2;findFile(destination,filename);i++) {
    if(i>100)throw new Error('Too many exports with this date in the chosen directory.');
    filename=base.replace(/\.json$/,`-${i}.json`);
  }
  const temp=new File(Paths.cache,filename);
  if(temp.exists)temp.delete();
  try {
    temp.create();
    await temp.write(makePresetBackup(data));
    if(!temp.exists||!(temp.size>0))throw new Error('Could not prepare preset backup.');
    await temp.copy(destination);
    const exported=findFile(destination,filename);
    if(!exported||exported.size!==temp.size)throw new Error('Export could not be verified. Check selected folder.');
    return {name:filename,uri:exported.uri};
  } finally {if(temp.exists)try{temp.delete();}catch{}}
}
export async function pickImportedSetup() {
  const result=await File.pickFileAsync({mimeTypes:['application/json','text/plain']});
  if(result.canceled)return null;
  const chosen=result.result;
  if(!chosen)throw new Error('Document picker did not return a file.');
  const file=chosen instanceof File?chosen:new File(chosen.uri);
  if(file.size>3*1024*1024)throw new Error('Preset file is too large (>3 MB).');
  return parsePresetBackup(await file.text());
}
