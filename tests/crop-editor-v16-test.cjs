const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root = path.join(__dirname,'..');
for(const f of ['App.js','src/CropPane.jsx','src/cropGesture.js']) {
  const content=fs.readFileSync(path.join(root,f),'utf8');
  const result=ts.transpileModule(content,{
    fileName:f,
    reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.React,allowJs:true,target:ts.ScriptTarget.ES2020}
  });
  assert.equal(result.diagnostics.length,0,`${f}: ${result.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
}
const pane=fs.readFileSync(path.join(root,'src/CropPane.jsx'),'utf8');
assert(pane.includes('onStartShouldSetResponderCapture'), 'native image surface captures touch');
assert(pane.includes('collapsable={false}'),'Android cannot flatten the interactive image surface');
assert(pane.includes('beginCropDrag(')&&pane.includes('updateCropDrag('),'drag lifecycle connected');
assert(pane.includes('NativeImage')&&pane.includes('resizeMode="stretch"'),'cropping shows its exact normalized bitmap');
assert(pane.includes('onImageError')&&pane.includes('previewError'),'broken image preview reports an error');
assert(pane.includes('!previewLoaded')&&pane.includes('disabled='),'cannot apply invisible image');
const app=fs.readFileSync(path.join(root,'App.js'),'utf8');
assert(app.includes('ImageManipulator.manipulateAsync('),'uses documented normalization method');
assert(app.includes('await new File(normalized.uri).copy(preview)'),'stages a verified stable preview');
assert(app.includes('preview.exists')&&app.includes('preview.size'),'verifies preview before edit');
assert(app.includes('inputUri:input.uri'),'keeps temporary input alive until editor closes');
console.log('PASS v16 editor: JSX syntax, responsive touch, visible-image safeguards, stable cached preview');
