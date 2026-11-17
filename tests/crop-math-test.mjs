import assert from 'node:assert/strict';
import {imageFrame,hitCrop,dragCrop,cropPixels} from '../src/cropMath.js';

// Pixel-accurate contained image geometry: tall and wide photos.
assert.deepEqual(imageFrame(320,320,200,400),{w:160,h:320,x:80,y:0});
assert.deepEqual(imageFrame(320,320,400,200),{w:320,h:160,x:0,y:80});
const r={x:.1,y:.2,w:.7,h:.6};
const px={w:320,h:160};
for(const h of ['nw','ne','sw','se']) {
  const x=(h.includes('w')?r.x:r.x+r.w)*px.w;
  const y=(h.includes('n')?r.y:r.y+r.h)*px.h;
  assert.equal(hitCrop(r,x,y,px.w,px.h),h);
}
const topLeft=dragCrop(r,'nw',.1,.15);
assert.ok(Math.abs(topLeft.x-.2)<1e-6);
assert.ok(Math.abs(topLeft.y-.35)<1e-6);
assert.ok(Math.abs(topLeft.w-.6)<1e-6);
assert.ok(Math.abs(topLeft.h-.45)<1e-6);
const bottomRight=dragCrop(r,'se',-.15,-.1);
assert.ok(Math.abs(bottomRight.x-r.x)<1e-6);
assert.ok(Math.abs(bottomRight.y-r.y)<1e-6);
assert.ok(Math.abs(bottomRight.w-.55)<1e-6);
assert.ok(Math.abs(bottomRight.h-.5)<1e-6);
const moved=dragCrop(r,'move',.08,.05);
assert.equal(moved.w,r.w);assert.equal(moved.h,r.h);
assert.ok(Math.abs(moved.x-.18)<1e-6);
assert.ok(Math.abs(moved.y-.25)<1e-6);
// The crop starts EXACTLY at the normalized source-image offset.
assert.deepEqual(cropPixels({x:.25,y:.20,w:.40,h:.60},1200,2000),
  {originX:300,originY:400,width:480,height:1200});
assert.deepEqual(cropPixels({x:.25,y:.20,w:.40,h:.60},2000,1200),
  {originX:500,originY:240,width:800,height:720});
console.log('Crop geometry and pixel coordinate regression tests passed');
