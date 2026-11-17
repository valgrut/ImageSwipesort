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
