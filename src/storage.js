import { Directory, File, Paths } from 'expo-file-system';
import { isMedia } from './model';
import {renameAndroidDocument,moveAndroidDocument,moveAndroidDocumentToRecycle,emptyAndroidRecycle} from './nativeRename';

// Android SAF's chosen tree URIs are backed by native ContentResolver.
// Always use the actual File URIs returned by Directory.list(), not a
// constructed child URI: `new File(safDirectory, name)` is not reliable for
// a picked content:// tree in Android's document providers.
export async function pickFolder() {
  const selected = await Directory.pickDirectoryAsync();
  return selected?.uri || null;
}
export function listMedia(folderUri) {
  const dir = new Directory(folderUri);
  const entries = dir.list().filter(f => f instanceof File && isMedia(f.name));
  return entries.sort((a,b) => a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}))
    .map(f => ({uri:f.uri,name:f.name,size:f.size, video:/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name)}));
}
function privateFolder(name) {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({intermediates:true});
  return dir;
}
function uniquePrivateName(name) { return `${Date.now()}-${Math.random().toString(36).slice(2,9)}-${name}`; }
export function readFile(entry) { return new File(entry.uri); }
export function fileSize(entry) { try { return new File(entry.uri).size; } catch { return entry.size || 0; } }
export function fileExt(name) { return name.includes('.') ? '.'+name.split('.').pop().toLowerCase() : ''; }

function findItem(dir, name) {
  return dir.list().find(item => item.name.toLowerCase() === name.toLowerCase()) || null;
}

// Expo supports File.copy(Directory), including Android SAF -> SAF transfers.
// This avoids interpreting a constructed content:// child path as a directory.
// An existing destination is ALWAYS rejected; we never overwrite it.
// On copy failure the original is left intact. We deliberately do not delete
// any possible partial destination on an error: it could belong to the user.
async function copyVerifiedToDirectory(source, directory, name) {
  if (!source.exists) throw new Error('Source file is no longer available. Refresh the source directory.');
  if (!directory.exists) throw new Error('Destination folder is no longer accessible. Select it again in Edit mode.');
  if (source.name !== name) throw new Error('Source filename differs from requested filename.');
  if (findItem(directory, name)) throw new Error(`Destination already contains an item named “${name}”. No files were changed.`);

  try {
    await source.copy(directory); // NB: Directory, not `new File(directory, name)`
  } catch (e) {
    throw new Error(`Could not copy “${name}” into the selected directory. The original was kept. ${e?.message || String(e)}`);
  }

  // SAF document URIs returned from list() are the authoritative identifiers.
  const copied = findItem(directory, name);
  if (!(copied instanceof File) || !copied.exists) {
    throw new Error(`Copy did not produce a readable “${name}” in the destination. The original was kept; inspect the destination for partial files.`);
  }
  const sourceSize = source.size;
  const copiedSize = copied.size;
  if (typeof sourceSize === 'number' && sourceSize > 0 && copiedSize !== sourceSize) {
    throw new Error(`Copy size mismatch for “${name}” (${copiedSize} versus ${sourceSize} bytes). The original was kept; inspect the destination for a partial file.`);
  }
  return copied;
}

// Prefer Android's native SAF document move: it avoids copying all media
// bytes, repeated destination scans, and extra storage writes. Use the
// verified copy/delete path ONLY when the provider explicitly says native
// move is unsupported (before any actual move was attempted).
export async function transfer(entry, destinationUri, copyOnly, sourceDirectoryUri=null) {
  const started=Date.now();
  if (!copyOnly && sourceDirectoryUri && entry.uri?.startsWith('content://') && destinationUri?.startsWith('content://')) {
    try {
      const movedUri=await moveAndroidDocument(entry.uri,sourceDirectoryUri,destinationUri);
      return {type:'move',strategy:'native',name:entry.name,size:entry.size,video:entry.video,fromUri:entry.uri,
        fromDirUri:sourceDirectoryUri,toUri:movedUri,toDirUri:destinationUri,
        durationMs:Date.now()-started};
    }catch(e){
      // Do not retry with copy/delete if the native call might already have
      // moved the document. Only a definitive preflight unsupported result
      // may safely use the slower method.
      if(!String(e?.message||e).includes('IKS_NATIVE_MOVE_UNSUPPORTED'))throw e;
    }
  }
  const source = new File(entry.uri);
  const destDir = new Directory(destinationUri);
  const copied = await copyVerifiedToDirectory(source, destDir, entry.name);
  let warning = null;
  let moved = !copyOnly;
  if (!copyOnly) {
    try { source.delete(); }
    catch(e) { warning=`Copy succeeded, but original could not be removed: ${e.message}`; moved=false; }
  }
  const method=copyOnly?'copy':moved?'copy-delete':'copy-with-original-kept';
  if(!copyOnly && moved && sourceDirectoryUri)
    warning='This folder provider does not support fast native Move; used slower verified copy/delete.';
  return {type:moved?'move':'copy',strategy:method,warning,name:entry.name,size:entry.size,video:entry.video,
    fromUri:entry.uri,fromDirUri:sourceDirectoryUri,toUri:copied.uri,toDirUri:destinationUri,
    durationMs:Date.now()-started};
}
// Reversible delete on Android: move within the same SAF provider instead of
// copying the whole video into app-private storage. The hidden directory is
// owned by this app (random suffix) and tracked in saved app state.
// Older app-private backups remain supported for existing Undo history.
export async function softDelete(entry, sourceDirectoryUri=null, existingTrashUri=null) {
  const started=Date.now();
  if(sourceDirectoryUri && entry.uri?.startsWith('content://') && sourceDirectoryUri.startsWith('content://')) {
    const folderName='.imagekeysort-trash-'+Math.random().toString(36).slice(2,14)+Date.now().toString(36);
    try {
      const result=await moveAndroidDocumentToRecycle(entry.uri,sourceDirectoryUri,existingTrashUri,folderName);
      return {type:'delete',strategy:'native-trash',name:entry.name,size:entry.size,video:entry.video,
        fromUri:entry.uri,fromDirUri:sourceDirectoryUri,toUri:result.movedUri,toDirUri:result.trashUri,recycleRootUri:result.recycleRootUri,
        durationMs:Date.now()-started};
    } catch(e) {
      // Only definitive preflight unsupported conditions can fall back to a
      // full copy. Anything after a possible move must be surfaced verbatim.
      if(!String(e?.message||e).includes('IKS_NATIVE_TRASH_UNSUPPORTED'))throw e;
    }
  }
  const source = new File(entry.uri);
  const backup = new File(privateFolder('recycle-bin'), uniquePrivateName(entry.name));
  await source.move(backup);
  return {type:'delete',strategy:'private-bin',name:entry.name,size:entry.size,video:entry.video,
    fromUri:entry.uri,fromDirUri:sourceDirectoryUri,toUri:backup.uri,durationMs:Date.now()-started,
    warning:'This storage provider cannot move documents into a same-provider recycle folder, so deletion required copying a backup.'};
}
export async function emptyTrash(fastTrashUris=[]) {
  // Clear only app-owned hidden folders. Preserve these folders themselves so
  // source-to-recycle moves can reuse them after Empty.
  let count=0;
  for(const uri of new Set(fastTrashUris.filter(Boolean)))count+=await emptyAndroidRecycle(uri);
  const dir=privateFolder('recycle-bin');
  const files=dir.list(); files.forEach(f=>f.delete());
  return count+files.length;
}
// Rename the existing Android document through DocumentsContract rather than
// copying its bytes or calling Expo File.rename(content://).
// The provider can change the document URI. Always return the new URI and
// update the UI / Undo history after a successful native rename.
export async function renameMedia(entry, newName, sourceDirectoryUri) {
  if (!sourceDirectoryUri) throw new Error('Choose the source folder again before renaming.');
  if (!newName || /[\/\\\u0000-\u001f]/.test(newName) || newName === '.' || newName === '..')
    throw new Error('Invalid destination filename.');
  const dir=new Directory(sourceDirectoryUri);
  if(!dir.exists)throw new Error('Source folder is no longer accessible. Choose it again.');
  const source=findItem(dir, entry.name);
  if(!(source instanceof File)||!source.exists||(entry.uri&&source.uri!==entry.uri))
    throw new Error('File changed or is inaccessible. Refresh the source folder.');
  if(source.name===newName)return null;
  if(findItem(dir,newName))throw new Error(`A file named “${newName}” already exists.`);
  const sourceSize=source.size;
  // No fallback copy/delete; native SAF rename either succeeds or leaves
  // the original alone (subject to provider behavior).
  const newUri=await renameAndroidDocument(source.uri,newName);
  const renamed=findItem(dir,newName);
  if(!(renamed instanceof File)||!renamed.exists){
    throw new Error('Android returned a rename result but the requested filename was not found. Refresh the source folder before retrying.');
  }
  if(sourceSize>0 && renamed.size!==sourceSize){
    throw new Error('Renamed file size differs. Refresh and inspect the folder; no additional changes were made.');
  }
  return {type:'rename',beforeUri:source.uri,afterUri:renamed.uri||newUri,
    oldName:entry.name,newName,sourceDirUri:sourceDirectoryUri};
}
// Android SAF documents are NOT ordinary paths. Cropping uses the same
// non-overwriting, verified directory-copy transaction as video cutting;
// never copy the rendered bytes over an existing content:// document URI.
export async function replaceWithCrop(entry, outputUri, sourceDirectoryUri) {
  const dir=new Directory(sourceDirectoryUri);
  if(!dir.exists)throw new Error('Source folder is no longer accessible. Select it again before cropping.');
  const source=findItem(dir,entry.name);
  if(!(source instanceof File)||!source.exists||(entry.uri&&source.uri!==entry.uri))
    throw new Error('Original image has changed. Refresh the folder before cropping.');
  const rendered=new File(outputUri);
  if(!rendered.exists||!(rendered.size>0))throw new Error('Rendered crop is missing or empty. Original unchanged.');
  const backup=new File(privateFolder('crop-backups'),uniquePrivateName(entry.name));
  await source.copy(backup);
  if(!backup.exists||backup.size!==source.size)
    throw new Error('Image backup could not be verified. Original unchanged.');

  const pendingName=cutPendingName(entry.name);
  const imageSize=rendered.size;
  let stage=null,pending=null,deletionAttempted=false;
  try {
    stage=await stageNamedFile(rendered,pendingName);
    pending=await copyVerifiedToDirectory(stage.staged,dir,pendingName);
    if(!backup.exists||!pending.exists||pending.size!==imageSize)
      throw new Error('Crop staging failed verification. Original unchanged.');
    // Only the app-private file:// staged copy is renamed.
    stage.staged.rename(entry.name);
    if(!stage.staged.exists||stage.staged.name!==entry.name||stage.staged.size!==imageSize)
      throw new Error('Could not prepare cropped image. Original unchanged.');
    const old=findItem(dir,entry.name);
    if(!(old instanceof File)||old.uri!==source.uri||old.size!==backup.size)
      throw new Error('Source image changed while cropping. Original unchanged.');
    deletionAttempted=true;
    old.delete();
    if(findItem(dir,entry.name))throw new Error('Original image still exists after removal; replacement cancelled.');
    const finalFile=await copyVerifiedToDirectory(stage.staged,dir,entry.name);
    if(!finalFile.exists||finalFile.size!==imageSize)
      throw new Error('Cropped image did not pass final verification.');
    let warning=null;
    try{
      const p=findItem(dir,pendingName);
      if(p instanceof File&&p.uri===pending.uri&&p.size===imageSize)p.delete();
    }catch{warning='Crop saved, but an extra __iks_pending image may remain in the folder.';}
    return {type:'crop',sourceUri:finalFile.uri,sourceDirUri:sourceDirectoryUri,backupUri:backup.uri,name:entry.name,warning};
  }catch(err){
    const reason=err?.message||String(err);
    let old=null;
    try{old=findItem(dir,entry.name);}catch{
      throw new Error('Crop failed and the source folder cannot be checked. An original backup is retained in app storage. '+reason);
    }
    if(old instanceof File){
      if(!deletionAttempted){
        // Source still exists untouched. Any pending copy can be left in place
        // for manual inspection if its cleanup fails.
        try{const p=findItem(dir,pendingName);if(p instanceof File&&pending&&p.uri===pending.uri&&p.size===imageSize)p.delete();}catch{}
        throw new Error('Crop failed before replacing the original. Original image remains unchanged. '+reason);
      }
      throw new Error('Crop failed after replacement began. A file with the original name exists; inspect it before deleting anything. The original is retained in app-private crop backups. '+reason);
    }
    let restoration=null;
    try {
      restoration=await stageNamedFile(backup,entry.name);
      await copyVerifiedToDirectory(restoration.staged,dir,entry.name);
      try{const p=findItem(dir,pendingName);if(p instanceof File&&pending&&p.uri===pending.uri&&p.size===imageSize)p.delete();}catch{}
      throw new Error('Crop failed. Original image restored from backup. '+reason);
    }catch(restoreError){
      if(String(restoreError.message).startsWith('Crop failed. Original image restored'))throw restoreError;
      throw new Error('Crop failed AND automatic restoration failed. The original image is still in app-private crop backups; do not uninstall the app or clear crop backups. '+(restoreError?.message||restoreError));
    }finally{cleanStage(restoration);}
  }finally{cleanStage(stage);}
}
// SAF content:// documents cannot be renamed with Expo File.rename().
// Cut transaction: backup original privately; verify a pending trimmed video
// in the user folder; rename only the *private file:// staging copy* back to
// the original basename; then, after deleting the original SAF document, use
// File.copy(Directory) to create the replacement by its original filename.
// Never rename or overwrite a content:// file and never discard the backup.
function cutPendingName(name) {
  const dot=name.lastIndexOf('.');
  const base=dot>=0?name.slice(0,dot):name;
  const ext=dot>=0?name.slice(dot):'';
  return `${base}.__iks_pending_${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`;
}
async function stageNamedFile(source, filename) {
  const dir=new Directory(privateFolder('restore-staging'), uniquePrivateName('stage'));
  dir.create();
  const staged=new File(dir,filename);
  try {
    await source.copy(staged);
    if(!staged.exists || staged.size !== source.size) {
      throw new Error('Could not verify private staging copy. Nothing was changed in the source folder.');
    }
    return {staged,dir};
  } catch(e) {try{dir.delete();}catch{} throw e;}
}
function cleanStage(stage) { if(stage)try{stage.dir.delete();}catch{} }
function originalBackupName(name) { return name.replace(/^\d+-[a-z0-9]+-/, ''); }

// Return all app-private original-video backups, including those left behind by
// older v9/v10 failed replacements. The UI allows exporting them safely.
export function listVideoCutBackups() {
  return privateFolder('video-cut-backups').list()
    .filter(f=>f instanceof File && f.exists)
    .map(f=>({uri:f.uri,name:originalBackupName(f.name),size:f.size,storedName:f.name}));
}
function nextAvailableName(directory, name) {
  if(!findItem(directory,name))return name;
  const dot=name.lastIndexOf('.');const base=dot>=0?name.slice(0,dot):name;
  const ext=dot>=0?name.slice(dot):'';
  for(let n=1;n<=999;n++){
    const candidate=`${base} (recovered ${n})${ext}`;
    if(!findItem(directory,candidate))return candidate;
  }
  throw new Error('Unable to choose a conflict-free recovery filename.');
}
export async function recoverVideoBackup(backupUri, targetDirectoryUri) {
  const backup=new File(backupUri);
  if(!backup.exists || !(backup.size>0))throw new Error('Original-video backup not found or empty.');
  const dest=new Directory(targetDirectoryUri);
  if(!dest.exists)throw new Error('Recovery folder is inaccessible. Choose another directory.');
  const filename=nextAvailableName(dest,originalBackupName(backup.name));
  let stage=null;
  try {
    stage=await stageNamedFile(backup,filename);
    const recovered=await copyVerifiedToDirectory(stage.staged,dest,filename);
    // Never delete the backup, even after success: safety first.
    return {name:recovered.name,uri:recovered.uri};
  } finally {cleanStage(stage)}
}

export async function replaceWithCut(entry, outputUri, sourceDirectoryUri) {
  if (!/\.mp4$/i.test(entry.name)) throw new Error('Only MP4 may be cut in place.');
  const dir=new Directory(sourceDirectoryUri);
  if(!dir.exists)throw new Error('Source directory permission expired. Select it again before cutting.');
  const source=findItem(dir,entry.name);
  if(!(source instanceof File)||!source.exists) throw new Error('Original video is no longer available in source folder.');
  const rendered=new File(outputUri);
  if(!rendered.exists || !(rendered.size>0))throw new Error('Rendered cut is missing or empty.');

  const backup=new File(privateFolder('video-cut-backups'),uniquePrivateName(entry.name));
  await source.copy(backup);
  if(!backup.exists||backup.size!==source.size)throw new Error('Original-video backup failed verification. Original was not changed.');

  const pendingName=cutPendingName(entry.name);
  let stage=null, pending=null;
  let deletionAttempted=false;
  const cutSize=rendered.size;
  try {
    // First keep a verified, separate cut in the user's directory. If the
    // final copy fails, both it and the private ORIGINAL backup remain.
    stage=await stageNamedFile(rendered,pendingName);
    pending=await copyVerifiedToDirectory(stage.staged,dir,pendingName);
    if(!(backup.exists && backup.size>0 && pending.exists && pending.size===cutSize)) {
      throw new Error('Video staging verification failed; original was left untouched.');
    }

    // This is an app-private file:// path. NEVER call rename() on SAF content://.
    stage.staged.rename(entry.name);
    if(!stage.staged.exists || stage.staged.name!==entry.name || stage.staged.size!==cutSize) {
      throw new Error('Could not prepare the trimmed video in app storage. Original was not changed.');
    }

    // Guard against a concurrent change to the source while trimming.
    const old=findItem(dir,entry.name);
    if(!(old instanceof File) || old.uri!==source.uri || old.size!==backup.size) {
      throw new Error('Source video changed during trimming. Original was not modified.');
    }
    deletionAttempted=true;
    old.delete();
    if(findItem(dir,entry.name))throw new Error('Original still exists after delete. Refusing to replace it.');

    // File.copy(Directory) works with picked Android SAF folders and creates
    // a *new document*, instead of writing to an invalidated old content URI.
    // The private staging file already has the desired original filename.
    const finalFile=await copyVerifiedToDirectory(stage.staged,dir,entry.name);
    if(!(finalFile instanceof File) || finalFile.size!==cutSize) {
      throw new Error('Replacement cut failed final verification.');
    }

    let warning=null;
    // Delete only our known temporary cut, after verifying the replacement.
    try {
      const p=findItem(dir,pendingName);
      if(p instanceof File && p.uri===pending.uri && p.size===cutSize)p.delete();
    } catch(e) { warning='Cut saved successfully, but an extra __iks_pending video may remain in your folder. Remove it only after checking the result.'; }
    return {type:'cut',sourceUri:finalFile.uri,sourceDirUri:sourceDirectoryUri,backupUri:backup.uri,name:entry.name,warning};
  } catch(error) {
    const reason=error?.message || String(error);
    let old=null;
    try {old=findItem(dir,entry.name);} catch(e) {
      throw new Error('Cut failed, and the source folder could not be checked. The original-video backup is available in Setup → Recover original videos. '+reason);
    }
    if(old instanceof File) {
      // Prior to deletion this is the untouched original. After deletion it
      // may be a partial/new file: never claim it is the original or delete it.
      if(!deletionAttempted) {
        // Safe to discard our temporary cut only when the original still exists.
        try {const p=findItem(dir,pendingName);if(p instanceof File && pending && p.uri===pending.uri && p.size===cutSize)p.delete();}catch{}
        throw new Error('Cut failed before replacing the original; original video remains in the source folder. '+reason);
      }
      throw new Error('Cut could not be fully verified, and a file with the original name exists. Do not delete that file until checking it. The original-video backup is in Setup → Recover original videos. '+reason);
    }

    // The document is gone (including the case where delete() threw after
    // deleting it). Restore via a fresh, verified SAF Directory copy.
    let restoreStage=null;
    try {
      restoreStage=await stageNamedFile(backup,entry.name);
      await copyVerifiedToDirectory(restoreStage.staged,dir,entry.name);
      try {const p=findItem(dir,pendingName);if(p instanceof File && pending && p.uri===pending.uri && p.size===cutSize)p.delete();}catch{}
      throw new Error('Cut failed. Original restored from backup. '+reason);
    } catch(restoreError) {
      if(String(restoreError.message).startsWith('Cut failed. Original restored'))throw restoreError;
      // Never remove the backup or pending video when restoration fails.
      throw new Error('Cut failed AND automatic restoration failed. The original is still backed up in Setup → Recover original videos. A __iks_pending cut may remain in the source folder. '+(restoreError?.message||restoreError));
    } finally {cleanStage(restoreStage)}
  } finally {cleanStage(stage)}
}
export function clearVideoCutBackups() {
  const dir = privateFolder('video-cut-backups');
  const files = dir.list();
  files.forEach(f=>f.delete());
  return files.length;
}

export async function undoOp(op, sourceUri) {
  if (op.type === 'copy') {
    const copy = new File(op.toUri); if (copy.exists) copy.delete(); return;
  }
  if (op.type === 'move') {
    const originalFolder=op.fromDirUri || sourceUri;
    if(op.strategy==='native' && originalFolder && op.toDirUri){
      try {
        const restoredUri=await moveAndroidDocument(op.toUri,op.toDirUri,originalFolder);
        // This URI is authoritative: Android is allowed to change the
        // document identity when moving it. The caller can update its gallery
        // directly without scanning the entire source folder.
        return {restoredUri,strategy:'native'};
      }catch(e){
        // Same rule as forward move: do not copy after an ambiguous failure.
        if(!String(e?.message||e).includes('IKS_NATIVE_MOVE_UNSUPPORTED'))throw e;
      }
    }
    const current = new File(op.toUri);
    const originalDir = new Directory(originalFolder);
    const restored=await copyVerifiedToDirectory(current, originalDir, op.name);
    current.delete(); // only after the restored copy was verified
    return {restoredUri:restored.uri,strategy:'copy-delete'};
  }
  if (op.type === 'delete') {
    if(op.strategy==='native-trash' && op.toDirUri && (op.fromDirUri||sourceUri)) {
      try {
        const restoredUri=await moveAndroidDocument(op.toUri,op.toDirUri,op.fromDirUri||sourceUri);
        return {restoredUri,strategy:'native-trash'};
      } catch(e) {
        // After an ambiguous native error, never try a second move/copy.
        // A provider without move support is unexpected after a successful
        // fast deletion; leave the document in its bin, never risk loss.
        throw e;
      }
    }
    const backup = new File(op.toUri);
    if (!backup.exists) throw new Error('Deleted file backup is no longer available.');
    const originalDir = new Directory(sourceUri);
    if (findItem(originalDir, op.name)) throw new Error('Original name already exists; will not overwrite.');
    // The recycle-bin filename has a unique prefix. Stage a copy under its
    // ORIGINAL filename, so File.copy(Directory) restores the correct name.
    const stagingDir = new Directory(privateFolder('restore-staging'), uniquePrivateName('undo'));
    stagingDir.create();
    try {
      const stagedFile = new File(stagingDir, op.name);
      await backup.copy(stagedFile);
      await copyVerifiedToDirectory(stagedFile, originalDir, op.name);
      backup.delete();
    } finally {
      try { stagingDir.delete(); } catch {}
    }
    return;
  }
  if (op.type === 'rename') {
    const directoryUri = op.sourceDirUri || sourceUri;
    if (!directoryUri) throw new Error('Original folder is unavailable for undo.');
    const directory = new Directory(directoryUri);
    const current = findItem(directory, op.newName);
    if (!(current instanceof File) || !current.exists) {
      throw new Error('Renamed file is missing; cannot undo safely.');
    }
    if (current.uri !== op.afterUri) {
      throw new Error('The renamed file changed since the operation; undo was cancelled.');
    }
    await renameMedia({name:op.newName,uri:current.uri}, op.oldName, directoryUri);
    return;
  }
  if (op.type === 'cut') {
    const backup=new File(op.backupUri);
    if(!backup.exists)throw new Error('Original video backup is no longer available. Go to Setup → Recover original videos.');
    const directory=op.sourceDirUri || sourceUri;
    const dir=new Directory(directory);
    const current=findItem(dir,op.name);
    if(!(current instanceof File))throw new Error('Current cut video is missing; original backup remains available under Setup → Recover original videos.');
    // Undo is another verified replacement, never an overwrite of a SAF URI.
    await replaceWithCut({name:op.name,uri:current.uri},backup.uri,directory);
    // Retain both backups until user explicitly clears them.
    return;
  }
  if (op.type === 'crop') {
    const backup=new File(op.backupUri);
    if(!backup.exists)throw new Error('Crop backup is missing; cannot undo.');
    const directoryUri=op.sourceDirUri || sourceUri;
    const dir=new Directory(directoryUri);
    const current=findItem(dir,op.name);
    if(!(current instanceof File)||!current.exists)
      throw new Error('Cropped image is missing. Original backup is retained in app storage.');
    // Restore through a new verified SAF document, not overwrite:true.
    await replaceWithCrop({name:op.name,uri:current.uri},backup.uri,directoryUri);
    // Keep the original backup until the user explicitly clears backups.
    return;
  }
  throw new Error('Unsupported undo action.');
}
// Manual recovery for an image whose SAF replacement failed after deletion.
// This copies the original backup out without touching the app-private copy.
export function listCropBackups() {
  return privateFolder('crop-backups').list()
    .filter(f=>f instanceof File&&f.exists)
    .map(f=>({uri:f.uri,name:originalBackupName(f.name),size:f.size}));
}
export async function recoverCropBackup(backupUri, targetDirectoryUri) {
  const backup=new File(backupUri);
  if(!backup.exists||!(backup.size>0))throw new Error('Original image backup is missing or empty.');
  const dest=new Directory(targetDirectoryUri);
  if(!dest.exists)throw new Error('Recovery destination is inaccessible. Choose another folder.');
  const filename=nextAvailableName(dest,originalBackupName(backup.name));
  let stage=null;
  try {
    stage=await stageNamedFile(backup,filename);
    const recovered=await copyVerifiedToDirectory(stage.staged,dest,filename);
    return {name:recovered.name,uri:recovered.uri};
  }finally{cleanStage(stage);}
}
export function backupCount() { return privateFolder('crop-backups').list().length; }
export function clearCropBackups() {
  const dir=privateFolder('crop-backups');
  const files=dir.list(); files.forEach(f=>f.delete());
  return files.length;
}
