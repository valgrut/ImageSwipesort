// Rebuild the gallery state for a successful Move Undo without rescanning the
// source folder. Keep the natural filename ordering used by listMedia().
// This function is pure and does not access SAF documents.
export function restoreMovedMedia(items, op, restoredUri, resolvedSize) {
  if (!restoredUri || !op?.name) return null;
  // A stale gallery listing can contain a conflicting item. When it does,
  // force the caller onto a real directory refresh instead of guessing.
  if (items.some(f => f.uri !== restoredUri &&
       f.name.toLowerCase() === op.name.toLowerCase())) return null;
  const size=Number.isFinite(op.size) && op.size >= 0 ? op.size :
    Number.isFinite(resolvedSize) && resolvedSize >= 0 ? resolvedSize : 0;
  const entry={
    uri:restoredUri,
    name:op.name,
    size,
    video:typeof op.video==='boolean' ? op.video : /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(op.name),
  };
  const next=[...items.filter(f=>f.uri!==restoredUri),entry]
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  return {files:next,index:next.findIndex(f=>f.uri===restoredUri)};
}
