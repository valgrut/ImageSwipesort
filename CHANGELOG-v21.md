# Image Keysort Mobile v21 — Fast Undo for Move

## Fixed

Native Move was fast in v20, but Undo always called `refresh(sourceUri, index)` afterward. That synchronously enumerated all entries in the source folder and unnecessarily incremented `mediaRevision`, remounting the media preview. The storage operation itself was already native and fast.

## Changes

- The existing Android native `DocumentsContract.moveDocument()` remains the default for Undo of native moves. No Kotlin/module changes are required.
- `undoOp()` returns the **actual restored URI** from the Android document provider (or the verified copy URI in fallback mode).
- The UI inserts the restored media directly into its already-loaded gallery, in the same natural filename order as `listMedia()`; the restored item becomes selected.
- Saving the file size/type in new Move history entries avoids reopening the document just to get gallery metadata. History created in v20 remains compatible: a single-file size lookup is used when required.
- Undo of Copy no longer refreshes the source gallery, since that operation only deletes a destination copy.
- Delete, Cut, Crop, and manual Rename Undo keep their existing conservative refresh and recovery behavior.
- If the local gallery has a stale filename collision, the UI falls back to a full refresh rather than guessing.
- Undo history is removed only after the storage operation succeeds.
- Added `[IKS perf] undo ...` diagnostic timing in development mode.

## Verification

- Tests cover no-copy native Move Undo, returned SAF URI, no folder scan on the storage hot path, insertion with natural sort, old v20 history lacking size metadata, source collision detection, unsupported provider fallback, and ambiguous native failures.
- Existing project regression tests passed for SAF file operations, native rename, crop geometry, video cutting, saved presets, tags, and radial gestures.
- React JSX/JS syntax checks passed with the TypeScript parser.
- Not compiled or measured on an actual Android device in this environment. The display of the newly restored video still requires the phone to initialize its video player, so the total perceived latency may vary.

## Update from v20

Replace `App.js` and `src/storage.js`, and **add** `src/undoGallery.js` to your existing project. No new dependencies or native changes.

Rebuild your APK (preserve the existing package ID/signing key):

```powershell
npm install
eas build -p android --profile preview
```

Install the resulting APK over your existing app. Do not uninstall the old app if you want to retain saved presets and recoverable private files.
