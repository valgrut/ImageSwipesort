import {displayFileName,displayPath,isImage,isVideo} from './model';
import {toggleTag} from './tags';

// Keep this descriptive model independent of the UI so it is testable and
// works for operations created before and after app upgrades.
export function describeUndo(op,sourceFolder) {
  if (!op) return null;
  const name = displayFileName(op.name || op.newName || op.file?.name || 'File');
  const originalFolder = displayPath(op.sourceDirUri || (op.type==='crop' ? (sourceFolder||op.sourceUri) : op.sourceUri) || sourceFolder);
  const destination = op.toDirUri ? displayPath(op.toDirUri) : null;
  let title='',description='',thumbnailUri=null;
  switch(op.type) {
    case 'move':
      title='Undo move';
      description=`Move back from ${destination || 'the destination folder'} to ${originalFolder}`;
      thumbnailUri=op.toUri; break;
    case 'copy':
      title='Undo copy';
      description=`Remove the copied file from ${destination || 'the destination folder'}. The source file in ${originalFolder} stays untouched.`;
      thumbnailUri=op.toUri; break;
    case 'delete':
      title='Undo deletion';
      description=`Restore from the app recycle bin to ${originalFolder}`;
      thumbnailUri=op.toUri; break;
    case 'crop':
      title='Undo crop';
      description=`Restore the original uncropped image in ${originalFolder}`;
      thumbnailUri=op.backupUri; break;
    case 'cut':
      title='Undo video cut';
      description=`Restore the original video in ${originalFolder}`;
      thumbnailUri=op.backupUri; break;
    case 'rename':
      title='Undo rename';
      description=`Rename “${displayFileName(op.newName)}” back to “${displayFileName(op.oldName)}” in ${originalFolder}`;
      thumbnailUri=op.afterUri; break;
    case 'demo':
      title=op.copy?'Undo demo copy':'Undo demo move';
      description=op.copy?'Remove the simulated copy.':`Return the sample to the source list${destination?' from '+destination:''}.`;
      thumbnailUri=op.file?.uri; break;
    case 'demoRename':
      title='Undo demo rename';
      description=`Restore filename “${displayFileName(op.oldName)}”`;
      break;
    default: return null;
  }
  const thumbnailName=op.type==='rename'?op.newName:op.file?.name||op.name||'';
  return {title,description,name,thumbnailUri,isImage:isImage(thumbnailName),isVideo:isVideo(thumbnailName)};
}

// A tag toggle is *not* a new Undo step, but existing operations may point
// at the renamed document. Update their references to preserve real Undo.
// Particularly: Rename A→B, tag B→B [tag], Undo should rename B [tag]→A [tag].
export function historyAfterTagRename(history,before,after,tag,sourceFolder) {
  return history.map(op=>{
    const changed = {...op};
    if(op.type==='demoRename' && op.at===before.at) {
      changed.oldName=toggleTag(op.oldName,tag);
    }
    if(op.type==='rename' && op.afterUri===before.uri) {
      changed.afterUri=after.uri;
      changed.newName=after.name;
      changed.oldName=toggleTag(op.oldName,tag);
    }
    if(op.type==='crop' && (op.sourceUri===before.uri ||
        (op.name===before.name && op.sourceUri===sourceFolder))) {
      changed.sourceUri=after.uri;
      changed.sourceDirUri=op.sourceDirUri || sourceFolder;
      changed.name=after.name;
    }
    if(op.type==='cut' && op.sourceUri===before.uri) {
      changed.sourceUri=after.uri;
      changed.name=after.name;
    }
    return changed;
  });
}

