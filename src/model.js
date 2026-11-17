export const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
export const COLOR_PALETTE = ['#34d399','#60a5fa','#fbbf24','#fb7185','#c084fc','#2dd4bf','#f97316','#94a3b8'];
export const ICON_PALETTE = ['📁','🖼️','🎬','⭐','🧠','🗂️','🏃','❤️','📌','🔖','🎵','🎮','📷','🧹','🧪','🪄'];
export const ROOT = { id: 'root', name: 'Home', icon: '🫆', color: '#34d399', destination: null, locked: true, children: {} };
export function cloneTree(root) { return JSON.parse(JSON.stringify(root)); }
export function nodeAt(tree, path) { return path.reduce((n, d) => n?.children?.[d], tree); }
export function nextId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export function countNodes(n) { return Object.values(n.children || {}).reduce((sum, v) => sum + 1 + countNodes(v), 0); }
export function chooseDirection(dx, dy) {
  // 0 degrees is north, clockwise in 45 degree steps
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return DIRS[Math.round(angle / 45) % 8];
}
export function mimeOf(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',bmp:'image/bmp',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',mkv:'video/x-matroska',m4v:'video/x-m4v',avi:'video/x-msvideo'})[ext] || 'application/octet-stream';
}
export function isVideo(name) { return /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(name); }
export function isImage(name) { return /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(name); }
export function isMedia(name) { return isVideo(name) || isImage(name); }
export function safeName(name) { return name.replace(/[\\/\u0000-\u001f]/g,'_').trim(); }
// SAF paths are identifiers, not human-readable filenames. Keep the untouched
// `content://` URI in application state and storage operations; format only UI.
function decodeForDisplay(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function displayPath(uri) {
  if (!uri) return 'Choose folder';
  const input = String(uri);

  if (/^content:\/\//i.test(input)) {
    // A SAF URI can contain both /tree/<id> and /document/<id>. If present,
    // document is the more specific path. IDs encode '/' as %2F and ':' as %3A.
    const documentId = input.match(/\/document\/([^/?#]+)/i)?.[1];
    const treeId = input.match(/\/tree\/([^/?#]+)/i)?.[1];
    const id = decodeForDisplay(documentId || treeId || '');
    if (id) {
      const colon = id.indexOf(':');
      if (colon !== -1) {
        const volume = id.slice(0, colon);
        const relative = id.slice(colon + 1).replace(/^\/+/, '');
        const root = volume.toLowerCase() === 'primary'
          ? 'Internal storage'
          : volume.toLowerCase() === 'home' ? 'Documents' : volume;
        return relative ? `${root}/${relative}` : root;
      }
      if (id.toLowerCase() === 'downloads') return 'Downloads';
      return id;
    }
    // Other content providers might not use SAF IDs. Show a decoded path,
    // without exposing their authority and opaque query parameters.
    return decodeForDisplay(input.replace(/^content:\/\/[^/]+\/?/i, '').split(/[?#]/)[0]);
  }

  if (/^file:\/\//i.test(input)) {
    return decodeForDisplay(input.replace(/^file:\/\//i, ''));
  }
  return decodeForDisplay(input);
}

export function displayFileName(name) {
  if (!name) return '';
  const visible = /^(content|file):\/\//i.test(String(name))
    ? displayPath(name)
    : decodeForDisplay(String(name));
  // A provider can occasionally return a URI/relative path as its file name.
  // Only the final component belongs in the filename header.
  return visible.split('/').filter(Boolean).pop() || visible;
}
