# Image Keysort Mobile v17 — Android crop preview repair

- **Crop displays the original image**, using the same `expo-image` component and Android document URI that the normal gallery uses. Previous versions attempted to render a generated preview PNG, which appeared black on the tested device. No no-op PNG transcoding is performed just to open the editor.
- Falls back automatically to a byte-for-byte cached image if the document URI cannot be loaded. Both paths report decoding errors instead of silently disabling Apply.
- Keeps the working four-corner/edge dragging and movable crop box. The visible image is `contentFit="contain"`, and the overlay frame is computed from the displayed image's reported dimensions.
- Enables **Apply crop** only after `expo-image` has successfully loaded the image and reported its dimensions; forwards those dimensions to the actual crop operation.
- Only the temporary app-private image copy is deleted when Crop closes. **The original `content://` URI is never deleted by the editor's cleanup.**
- Changes crop replacement and Undo to use verified, SAF-compatible staged directory copies, rather than direct overwrites of `content://` files. A private backup of the original is retained.
- Adds **Setup → Recover original images from crops** for exporting private crop backups into a chosen directory, without deleting them.
- Leaves video cutting, radial sorting, tagging and presets unchanged.

## Upgrade

From v16, replace `App.js`, `src/CropPane.jsx`, and `src/storage.js`, then build/install a new APK over the existing one. Keep the existing package ID and signing key. **Do not uninstall or clear app data** if backups matter.

Run `npm install` before EAS build to generate a matching `package-lock.json` if needed.

## Testing

Source/JSX syntax checks and simulated regression tests passed, including gallery-backed crop preview, four-corner gestures, safe SAF crop replacement, Undo, recovery copies, and the previous video-cut/storage tests.

**Not tested on physical Android.** The root cause is inferred from the code path and phone symptoms. Please first open Crop on a disposable screenshot, verify the image appears and controls move, then Apply and Undo; inspect the resulting cropped image visually.
