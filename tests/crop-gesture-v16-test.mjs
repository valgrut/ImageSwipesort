import assert from 'node:assert/strict';
import {beginCropDrag,updateCropDrag} from '../src/cropGesture.js';
import {imageFrame,cropPixels} from '../src/cropMath.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.000001,`${actual} != ${expected}`);
for(const [label,sourceW,sourceH] of [['portrait',900,1600],['landscape',1600,900]]) {
  const frame=imageFrame(350,350,sourceW,sourceH);
  const rect={x:.2,y:.15,w:.6,h:.7};
  const screenX=100,screenY=200;
  const startFor=(handle)=>{
    const x=handle.includes('w')?rect.x:rect.x+rect.w;
    const y=handle.includes('n')?rect.y:rect.y+rect.h;
    const localX=x*frame.w, localY=y*frame.h;
    return {
      localX,localY,
      event:{locationX:localX,locationY:localY,pageX:screenX+frame.x+localX,pageY:screenY+frame.y+localY}
    };
  };
  for(const handle of ['nw','ne','sw','se']){
    const {event}=startFor(handle);
    const gesture=beginCropDrag(rect,frame,event);
    assert.equal(gesture?.handle,handle,`${label}: ${handle} touch hits the matching corner`);
    const next=updateCropDrag(gesture,{pageX:event.pageX+frame.w*.03,pageY:event.pageY+frame.h*.04});
    if(handle.includes('w'))near(next.x,.23);else near(next.x,.2);
    if(handle.includes('n'))near(next.y,.19);else near(next.y,.15);
    assert.ok(next.w>0&&next.h>0);
    const crop=cropPixels(next,sourceW,sourceH);
    assert.ok(crop.originX>=0&&crop.originY>=0&&crop.width>0&&crop.height>0);
  }
  const cx=(rect.x+rect.w/2)*frame.w,cy=(rect.y+rect.h/2)*frame.h;
  const move=beginCropDrag(rect,frame,{locationX:cx,locationY:cy,pageX:cx+screenX,pageY:cy+screenY});
  assert.equal(move.handle,'move');
  const moved=updateCropDrag(move,{pageX:cx+screenX+frame.w*.06,pageY:cy+screenY+frame.h*.06});
  near(moved.x,.26);near(moved.y,.21);near(moved.w,.6);near(moved.h,.7);
  const outside=beginCropDrag(rect,frame,{locationX:0,locationY:0,pageX:screenX,pageY:screenY});
  assert.equal(outside,null);
  assert.equal(updateCropDrag(null,{pageX:1,pageY:2}),null);
}
console.log('PASS v16 crop gestures: all corners, move, letterboxing, cancel, pixel bounds');
