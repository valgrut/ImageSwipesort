// Tags are literal, reusable filename strings (not EXIF metadata).
// Only the filename's stem is changed; the final file extension stays intact.
export function splitFileName(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? {stem: filename.slice(0, dot), ext: filename.slice(dot)} : {stem: filename, ext: ''};
}

export function normalizeTag(input) {
  const tag = String(input ?? '').trim();
  if (!tag) throw new Error('Enter a tag.');
  if (/[\\/\u0000-\u001f]/.test(tag)) throw new Error('Tags cannot contain slashes or control characters.');
  if (tag.length > 100) throw new Error('Keep tags to 100 characters or fewer.');
  return tag;
}

export function hasTag(filename, tag) {
  return !!tag && splitFileName(filename).stem.includes(tag);
}

function removeOneTag(stem, tag) {
  const i = stem.indexOf(tag);
  if (i < 0) return stem;
  let left = stem.slice(0, i);
  let right = stem.slice(i + tag.length);
  // Remove one joining separator, never normalize unrelated whitespace.
  if (left.endsWith(' ') && right.startsWith(' ')) right = right.slice(1);
  else if (left.endsWith(' ') && !right) left = left.slice(0, -1);
  else if (!left && right.startsWith(' ')) right = right.slice(1);
  return left + right;
}

export function toggleTag(filename, tag) {
  const {stem, ext} = splitFileName(filename);
  if (!tag) return filename;
  if (stem.includes(tag)) {
    let result = stem;
    // Existing filenames can contain the same literal tag more than once.
    while (result.includes(tag)) result = removeOneTag(result, tag);
    return result + ext;
  }
  return `${stem}${stem && !/\s$/.test(stem) ? ' ' : ''}${tag}${ext}`;
}
