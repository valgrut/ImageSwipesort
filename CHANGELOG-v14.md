# Image Keysort Mobile v14 — continuous radial gestures + native Android rename

## Sort mode

- Fixed the regression where the selected destination was only tracked in Edit mode. Sort now updates the highlighted sector on **every** touch movement.
- The `PanResponder` instance persists across re-renders; displaying/highlighting a sector no longer recreates gesture handlers mid-swipe.
- The gesture is calculated from the finger's **current screen position** relative to the center button, rather than blindly using total swipe displacement.
- The currently selected sector stays highlighted until the finger moves into a different sector, the center cancellation zone, an undefined sector, or outside the preview square. Lifting selects only the active sector.
- The center touch remains invisible in idle root Sort mode. In Edit mode, all eight directions remain available.
- Sort-mode radial icons/captions are now non-interactive hit-test overlays, avoiding gesture interruption by individual buttons. Users sort only by starting on the central button.
- Active sectors have stronger color and a white edge; the hint line below the image shows the selected swipe's full label while held.
- All existing nested-swipe navigation, video preview, and non-radial image browsing behavior is retained.

## Filename tagging and manual renaming

- Removed v13's copy-then-delete workaround for renaming SAF (`content://`) documents, and the unsupported `File.rename()` call used in older versions.
- Added a tiny Android Expo local Kotlin module at `modules/iks-document-rename/`, using Android `DocumentsContract.renameDocument()` directly. This updates document metadata without copying its contents when the selected Android provider supports renaming.
- The returned document URI is used to refresh file lists and track Undo (Android may change the document URI during rename).
- Both pencil rename and add/remove tag shortcuts use this same native operation.
- Checks for name collisions and confirms that the new name is visible in the source folder.
- A provider refusing rename reports an error; **there is no silent large-file copy/delete fallback.**

## Install/update

This version adds **a native Android module**, requiring a freshly built APK. It cannot be tested using ordinary Expo Go, which lacks the custom module.

On Windows, extract the entire v14 ZIP and open PowerShell in the folder containing `package.json`:

```powershell
npm install
npm ci --include=dev
eas build -p android --profile preview
```

`npm install` creates/synchronizes `package-lock.json` (not bundled due to no registry access in the packaging environment). `npm ci` verifies EAS's dependency-install step before submitting a build.

Install the APK **over the existing app**; use the same package `dev.imagekeysort.mobile` and the same signing credentials, and do not uninstall, since private backup files and saved app state would be erased.

## Verification

- JavaScript syntax/JSX parse checks passed (TypeScript transpile parser).
- Simulated tests passed for all eight gesture directions, continuous highlights, cancel/no-target, stable touch responder, native rename/tagging/Undo, collisions, and failed rename.
- Previously existing SAF move/copy, video cutting/recovery, preset import/export, and crop geometry unit tests passed.
- **The custom Kotlin module and touch behavior haven't been compiled or tested on a physical phone.** Verify with disposable files first. Cloud Gradle compilation may reveal integration issues that simulated tests cannot catch.
