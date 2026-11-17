# Image Keysort Mobile v20 — Faster Moves

## Problem
v19 moved every video using `File.copy(Directory)` followed by deletion, and scanned destination folders multiple times as well as rescanning the source folder after each move. This incurred significant fixed overhead even for small videos (e.g. 15 MB), in addition to copying all bytes.

## Changes

- Added `moveDocument` to `IksDocumentRenameModule.kt` using Android `DocumentsContract.moveDocument`.
- The new native path is used for Move when Android SAF folders and their document provider support it; Copy mode remains a verified copy.
- Native Move detects filename collisions and verifies the resulting destination document URI. It does not intentionally overwrite existing files.
- If the provider explicitly reports no native Move support *before executing a move*, the app falls back to its previous verified copy/delete method. A warning is shown only once per session. Other errors do NOT trigger copy/delete because the provider may already have moved the file.
- Undo of a native move uses the native move in reverse, including updated document URIs; an explicitly unsupported provider can fall back to verified copy/delete.
- Removed unnecessary listing-based destination checks from the hot sorting path; directory validation still runs for preset import/editing.
- On successful Move, the currently sorted item is removed from the gallery list immediately rather than rescanning the whole source folder. Manual Refresh remains available.
- Added development-console timing output (`[IKS perf] ...`) to help distinguish storage time from video preview startup time.

## Limitations and safety

- The Kotlin source is not compiled or exercised on a physical Android device in this environment. Test with disposable videos and verify Move and Undo before sorting important files.
- Fast metadata moves are provider dependent. Cross-provider moves can still use slow copy/delete.
- Cloud-backed folders and external SD cards may behave differently.
- If the native provider reports an ambiguous failure after an attempted move, the app stops rather than risking a second destructive operation. Check source and destination and refresh the folders before retrying.
- Rebuilding a standalone APK is REQUIRED because the Kotlin native module changed. Preserve application package/signing credentials and install over the existing APK; do not uninstall if you need saved settings and recovery backups.

## Build

```powershell
npm install
npm ci --include=dev
eas build -p android --profile preview
```
