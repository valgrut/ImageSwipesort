# Image Keysort Mobile v18 — revert the broken crop editor

## What is restored

- Crop view framing and four-corner/edge selection geometry from the working v5 iteration.
- `expo-image` renders **the original image URI already used by the gallery**, not a newly generated preview PNG that appeared black in the affected builds.
- The draggable overlay retains the **v16 direct responder** implementation, which you confirmed responds correctly on Android. This avoids reintroducing v15's unresponsive overlay.
- The crop image dimensions are known before the editor first draws (derived from a locally decoded copy), fixing v17's missing handles caused by starting the image frame with no dimensions.
- Uses Expo SDK 58's documented `ImageManipulator.manipulateAsync` API for orientation normalization and crop export. The exported crop is taken from the normalized temporary image that supplied the crop geometry.
- If the gallery URI fails to load in the crop editor, it attempts a byte-for-byte local copy and shows the loader error if neither loads.
- Keeps v17 SAF-safe crop file replacement, original backup, Undo, and recovery. No extra changes to tags, swipe sorting, cutting, or presets.

## Why this is a rollback, not another redesign

The broken changes were introduced across v15–v17 (different preview preparation, different image view, and dropped image dimensions). V18 restores the stable parts of the early editor and combines them with the proven movable handles, while leaving media replacement safety in place.

## Testing and installation

Source parsing and simulated crop geometry, drag, and SAF storage tests pass. Android image decoding and rendering were **not tested on physical hardware** in this environment. Please first test that the image appears, handles move, Apply works and Undo restores a disposable screenshot. Avoid using valuable media until verified.

Build from the project folder:

```powershell
npm install
eas build -p android --profile preview
```

Install over the existing app using the same Android package ID and signing key. Do not uninstall or clear app data if private recoverable backups might still be present.
