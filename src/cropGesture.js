import {hitCrop,dragCrop} from './cropMath.js';

// Hit testing and movement happen in the same image-sized coordinate system.
// The local position selects a handle, while global page coordinates provide
// a stable drag delta even if React Native re-renders the selection rectangle.
export function beginCropDrag(rect,frame,{locationX,locationY,pageX,pageY}) {
  if(!(frame.w>0&&frame.h>0))return null;
  const handle=hitCrop(rect,locationX,locationY,frame.w,frame.h);
  if(!handle)return null;
  return {
    handle,
    start:{...rect},
    startPageX:pageX,
    startPageY:pageY,
    width:frame.w,
    height:frame.h
  };
}
export function updateCropDrag(drag,{pageX,pageY}) {
  if(!drag)return null;
  return dragCrop(drag.start,drag.handle,
    (pageX-drag.startPageX)/drag.width,
    (pageY-drag.startPageY)/drag.height);
}
