// The crop rectangle is ALWAYS expressed in normalized coordinates of the
// visible image, not of the (often square/letterboxed) preview container.
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const MIN_CROP = 0.04;

export function imageFrame(viewW, viewH, imageW, imageH) {
  if (!(viewW > 0 && viewH > 0 && imageW > 0 && imageH > 0)) return {w:0,h:0,x:0,y:0};
  const scale = Math.min(viewW / imageW, viewH / imageH);
  const w = imageW * scale, h = imageH * scale;
  return {w, h, x: (viewW - w) / 2, y: (viewH - h) / 2};
}

export function clampRect(r) {
  const x = clamp(Number(r.x) || 0, 0, 1 - MIN_CROP);
  const y = clamp(Number(r.y) || 0, 0, 1 - MIN_CROP);
  const w = clamp(Number(r.w) || MIN_CROP, MIN_CROP, 1 - x);
  const h = clamp(Number(r.h) || MIN_CROP, MIN_CROP, 1 - y);
  return {x,y,w,h};
}

// Choose a corner/edge within a finger-friendly hit radius, otherwise drag
// the whole box. Coordinates are pixels relative to the displayed IMAGE.
export function hitCrop(r, px, py, frameW, frameH, radius = 29) {
  const x = r.x * frameW, y = r.y * frameH;
  const right = (r.x + r.w) * frameW, bottom = (r.y + r.h) * frameH;
  const corners = [['nw',x,y],['ne',right,y],['sw',x,bottom],['se',right,bottom]];
  for (const [handle, hx, hy] of corners) {
    if (Math.hypot(px-hx,py-hy) <= radius) return handle;
  }
  const betweenX = px >= x-radius/2 && px <= right+radius/2;
  const betweenY = py >= y-radius/2 && py <= bottom+radius/2;
  if (betweenX && Math.abs(py-y) <= radius/2) return 'n';
  if (betweenX && Math.abs(py-bottom) <= radius/2) return 's';
  if (betweenY && Math.abs(px-x) <= radius/2) return 'w';
  if (betweenY && Math.abs(px-right) <= radius/2) return 'e';
  if (px >= x && px <= right && py >= y && py <= bottom) return 'move';
  return null;
}

export function dragCrop(start, handle, dx, dy, min = MIN_CROP) {
  if (!handle) return start;
  if (handle === 'move') return {
    ...start,
    x:clamp(start.x + dx, 0, 1 - start.w),
    y:clamp(start.y + dy, 0, 1 - start.h)
  };
  let left = start.x, right = start.x + start.w;
  let top = start.y, bottom = start.y + start.h;
  if (handle.includes('w')) left = clamp(start.x + dx, 0, right - min);
  if (handle.includes('e')) right = clamp(start.x + start.w + dx, left + min, 1);
  if (handle.includes('n')) top = clamp(start.y + dy, 0, bottom - min);
  if (handle.includes('s')) bottom = clamp(start.y + start.h + dy, top + min, 1);
  return {x:left, y:top, w:right-left, h:bottom-top};
}

export function cropPixels(rect, imageWidth, imageHeight) {
  if (!(imageWidth > 0 && imageHeight > 0)) throw new Error('Image dimensions are unavailable.');
  const r = clampRect(rect);
  // Use the SAME rounded boundaries for origin and size. This avoids rounding
  // beyond the bitmap's bounds and preserves the selected top-left position.
  const x0 = clamp(Math.round(r.x * imageWidth), 0, imageWidth - 1);
  const y0 = clamp(Math.round(r.y * imageHeight), 0, imageHeight - 1);
  const x1 = clamp(Math.round((r.x + r.w) * imageWidth), x0 + 1, imageWidth);
  const y1 = clamp(Math.round((r.y + r.h) * imageHeight), y0 + 1, imageHeight);
  return {originX:x0, originY:y0, width:x1-x0, height:y1-y0};
}
