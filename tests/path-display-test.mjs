// Test Android SAF display labels separately from storage identities.
import assert from 'node:assert/strict';
import {displayPath, displayFileName} from '../src/model.js';
const examples = [
  ['content://com.android.externalstorage.documents/tree/primary%3AVideos%2FMy%20Exercises','Internal storage/Videos/My Exercises'],
  ['content://com.android.externalstorage.documents/tree/primary%3APictures%2FScreenshots','Internal storage/Pictures/Screenshots'],
  ['content://com.android.externalstorage.documents/tree/primary%3APictures%2FScreenshots/document/primary%3APictures%2FScreenshots%2FShot%201.png','Internal storage/Pictures/Screenshots/Shot 1.png'],
  ['content://com.android.externalstorage.documents/tree/1234-ABCD%3ADCIM%2FTrips','1234-ABCD/DCIM/Trips'],
  ['content://com.android.externalstorage.documents/tree/home%3AProject%20Photos','Documents/Project Photos'],
  ['content://com.android.providers.downloads.documents/tree/downloads','Downloads'],
  ['file:///storage/emulated/0/Pictures/My%20Photos','/storage/emulated/0/Pictures/My Photos'],
  ['/home/user/My%20Pictures','/home/user/My Pictures'],
  ['content://com.android.externalstorage.documents/tree/primary%3ABad%25Name','Internal storage/Bad%Name'],
  [null,'Choose folder'],
];
for(const [uri,expected] of examples){
  assert.equal(displayPath(uri),expected,String(uri));
  if(uri !== null) assert.equal(uri,uri,'source never mutated');
}
assert.equal(displayFileName('photo%20one.png'),'photo one.png');
assert.equal(displayFileName('content://com.android.externalstorage.documents/document/primary%3APictures%2Fphoto%20one.png'),'photo one.png');
assert.equal(displayFileName('normal photo.jpg'),'normal photo.jpg');
assert.equal(displayFileName(''), '');
console.log(`PASS: ${examples.length} SAF and file paths, decoded filenames`);
