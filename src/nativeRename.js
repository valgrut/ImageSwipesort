import {Platform} from 'react-native';
import {requireNativeModule} from 'expo';

// The module is included inside the v14 APK by Expo autolinking.
// Expo Go does not include custom native modules.
let moduleInstance=null;
export async function renameAndroidDocument(uri,newName) {
  if(Platform.OS!=='android') throw new Error('Native document renaming is Android-only.');
  if(!uri.startsWith('content://'))throw new Error('Expected an Android document URI.');
  if(!moduleInstance)moduleInstance=requireNativeModule('IksDocumentRename');
  return moduleInstance.renameDocument(uri,newName);
}

// Both folder URIs come from Android's directory picker. Returns the *new*
// document URI, which might differ from the old one after a native move.
export async function moveAndroidDocument(uri,fromTreeUri,toTreeUri) {
  if(Platform.OS!=='android')throw new Error('IKS_NATIVE_MOVE_UNSUPPORTED: Android only');
  if(!uri?.startsWith('content://') || !fromTreeUri?.startsWith('content://') || !toTreeUri?.startsWith('content://'))
    throw new Error('IKS_NATIVE_MOVE_UNSUPPORTED: Expected Android SAF document and folder URIs');
  if(!moduleInstance)moduleInstance=requireNativeModule('IksDocumentRename');
  return await moduleInstance.moveDocument(uri,fromTreeUri,toTreeUri);
}

// Fast, reversible delete: SAF metadata move into an app-owned hidden folder
// inside the selected source tree. Neither native call copies video bytes.
export async function moveAndroidDocumentToRecycle(uri,sourceTreeUri,existingTrashUri,folderName) {
  if(Platform.OS!=='android' || !uri?.startsWith('content://') || !sourceTreeUri?.startsWith('content://'))
    throw new Error('IKS_NATIVE_TRASH_UNSUPPORTED: Android SAF documents only');
  if(!moduleInstance)moduleInstance=requireNativeModule('IksDocumentRename');
  return moduleInstance.moveToRecycle(uri,sourceTreeUri,existingTrashUri||'',folderName);
}
export async function emptyAndroidRecycle(trashUri) {
  if(Platform.OS!=='android' || !trashUri?.startsWith('content://'))
    throw new Error('Fast recycle bin requires Android SAF access');
  if(!moduleInstance)moduleInstance=requireNativeModule('IksDocumentRename');
  return moduleInstance.emptyRecycle(trashUri);
}
