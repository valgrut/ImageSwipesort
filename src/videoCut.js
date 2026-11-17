/**
 * Native MP4 trimming adapter.
 * The source is always copied from Android SAF to a short-lived local file:
 * the native video editor cannot reliably read Android's document-tree URI.
 * This code requires a custom native build (EAS APK), not Expo Go.
 */
import { File, Paths } from 'expo-file-system';
import VideoTrim, { showEditor } from 'react-native-video-trim';

function asFileUri(path) {
  if (!path || typeof path !== 'string') throw new Error('The video trimmer did not return an output file.');
  if (/^file:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `file://${path}`;
  throw new Error(`Unsupported video output location: ${path}`);
}

export async function openVideoCutter(entry) {
  if (!/\.mp4$/i.test(entry.name)) {
    throw new Error('Cut currently supports MP4 videos. Other containers need a safe output-format conversion before replacing the original.');
  }
  const input = new File(Paths.cache, `iks-cut-input-${Date.now()}-${Math.random().toString(36).slice(2,9)}.mp4`);
  let created = false;
  try {
    // The original video is not edited in this step. The selected SAF file
    // stays untouched until the final rendered clip has been validated.
    await new File(entry.uri).copy(input);
    created = true;
    if (!input.exists || !(input.size > 0)) throw new Error('Unable to read a local copy of this video.');

    const outputPath = await new Promise((resolve, reject) => {
      let settled = false;
      const subs = [];
      const dispose = () => { for (const sub of subs) { try { sub.remove(); } catch {} } };
      const done = (error, value) => {
        if (settled) return;
        settled = true;
        dispose();
        error ? reject(error) : resolve(value);
      };
      try {
        subs.push(VideoTrim.onFinishTrimming(event => done(null, event?.outputPath)));
        subs.push(VideoTrim.onCancel(() => done(null, null)));
        // Canceling an in-progress export may return the user to the editor.
        // Only closing/canceling the editor finishes the session.
        subs.push(VideoTrim.onError(event => done(new Error(event?.message || 'Native video cutting failed.'))));
        // Native onHide fires on exit; onFinishTrimming fires before onHide
        // when saving, according to the library's lifecycle contract.
        subs.push(VideoTrim.onHide(() => done(null, null)));
        showEditor(input.uri, {
          headerText: 'Cut video',
          cancelButtonText: 'Cancel',
          saveButtonText: 'Apply cut',
          trimmingText: 'Cutting video…',
          enableEditTools: false,
          enablePreciseTrimming: true, // remove exact seconds, not nearest keyframe
          enableCancelTrimming: true,
          minDuration: 1000,
          saveToPhoto: false,
          openShareSheetOnFinish: false,
          openDocumentsOnFinish: false,
          trimmerColor: '#34d399',
          changeStatusBarColorOnOpen: true,
        });
      } catch (e) { done(e); }
    });

    if (!outputPath) return null; // user canceled; leave original untouched
    const output = new File(asFileUri(outputPath));
    if (!output.exists || !(output.size > 0)) throw new Error('The cut completed but its output is missing or empty. Original video was not modified.');
    return output.uri;
  } finally {
    if (created || input.exists) { try { input.delete(); } catch {} }
  }
}

export function deleteCutOutput(path) {
  if (!path) return;
  try { const f = new File(asFileUri(path)); if (f.exists) f.delete(); } catch {}
}
