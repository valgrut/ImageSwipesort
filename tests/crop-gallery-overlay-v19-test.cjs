const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const project=path.resolve(__dirname,'..');
for(const file of ['App.js','src/CropPane.jsx']) {
 const p=path.join(project,file), code=fs.readFileSync(p,'utf8');
 const sf=ts.createSourceFile(p,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
 assert.equal(sf.parseDiagnostics.length,0,`${file}: parse failures ${sf.parseDiagnostics.map(d=>d.messageText).join(', ')}`);
}
const app=fs.readFileSync(path.join(project,'App.js'),'utf8');
const pane=fs.readFileSync(path.join(project,'src/CropPane.jsx'),'utf8');
assert.match(app,/Keep the exact existing gallery image component mounted while Crop is active/);
assert.match(app,/source=\{\{uri:current\.uri\}\} contentFit="contain"/);
assert.match(app,/!cropMode \? imagePan\.panHandlers : \{\}/);
assert.match(app,/\{cropMode && current && !current\.video && cropPreview && <CropPane/);
assert.match(app,/cropMode \? <View style=\{styles\.cropControls\}>/);
assert.match(app,/cropControls:\{paddingHorizontal/);
assert.match(app,/ImageManipulator\.manipulateAsync\(input\.uri/);
assert.match(app,/replaceWithCrop\(current,processed\.uri,sourceUri\)/);
// The overlay must never instantiate an image: it reuses the gallery's native Image.
assert.doesNotMatch(pane,/\bexpo-image\b|\bNativeImage\b|\breturn <Image\b/);
assert.match(pane,/style=\{StyleSheet\.absoluteFillObject\}/);
assert.match(pane,/locationX:n\.locationX-f\.x,locationY:n\.locationY-f\.y/);
assert.match(pane,/onResponderMove=\{move\}/);
console.log('PASS crop gallery overlay v19 source integration and JSX parsing');
