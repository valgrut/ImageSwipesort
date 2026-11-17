import {chooseDirection} from './model';

// Continuous, POSITION-BASED radial hit testing. The current finger position
// determines the selection; there is no sticky or net-swipe direction.
export function selectedDirectionAt(x, y, centerX, centerY, deadZone=42, halfWidth=Infinity) {
  if(![x,y,centerX,centerY,deadZone].every(Number.isFinite))return null;
  const dx=x-centerX,dy=y-centerY;
  if(Math.abs(dx)>halfWidth || Math.abs(dy)>halfWidth)return null;
  if(Math.hypot(dx,dy)<deadZone)return null;
  return chooseDirection(dx,dy);
}

// Unconfigured regions cancel in Sort mode. All eight regions are editable.
export function availableDirectionAt(x,y,centerX,centerY,children,mode='sort',deadZone=42,halfWidth=Infinity) {
  const dir=selectedDirectionAt(x,y,centerX,centerY,deadZone,halfWidth);
  if(!dir)return null;
  return mode==='sort'&&!children?.[dir]?null:dir;
}
