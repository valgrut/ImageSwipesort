# Image Keysort Mobile v22 — Fast Delete and Delete Undo

## Root cause

In v21, `softDelete(entry)` moved a `content://` document into `Paths.document/recycle-bin`. Moving across Android's SAF provider and app-private storage can **copy the complete video**, even when the file is small. Afterward, `deleteCurrent()` called `refresh()` and re-enumerated all files in the source directory. Unlike the previous v21 Undo slowdown, this is **both file transfer and UI refresh** overhead.

## Implementation

- For an Android SAF source, native `moveToRecycle()` creates/reuses a randomly named hidden `.imagekeysort-trash-…` folder inside the selected source directory and calls `DocumentsContract.moveDocument()`, keeping the file in the same storage provider. Files are **not copied** on the native fast path.
- The app records the actual moved document URI and its recycle-parent URI for Undo. Undo performs native `DocumentsContract.moveDocument()` back to the source folder, and restores its original place in the gallery without a directory rescan.
- Delete immediately removes that item from the in-memory gallery list rather than rescanning everything, and logs `[IKS perf] delete <strategy> <ms> ms` in development mode.
- A repeated deletion of a filename already present in the recycle folder is protected by creating a nested directory, so neither deletion is overwritten.
- If the provider **explicitly rejects native same-provider moves before changing any files**, deletion falls back to the older app-private recycle bin. An ambiguous native failure **does not trigger a second operation**, to avoid losing or duplicating documents.
- Setup → Empty app recycle bin now removes recycled files from known hidden folders as well as the previous app-private bin. It validates that the directory is an app-owned hidden recycle folder before deleting anything; it never deletes the source directory itself. The folders themselves remain to be reused.
- Deletion operations created by v21 remain undoable with the old private-bin recovery path, provided their backups still exist.

## Behavioral differences / safety

The fast recycle directory now lives inside the selected source directory and can remain after uninstalling the app. It may be visible if your file manager shows hidden directories. Do not manually move/rename the hidden trash folder if you need Undo; the saved document URI would become stale.

The native path should be fast on the same local storage provider, but actual timing still depends on Android and its document provider. No physical device or APK build was available here. Test with a disposable 15 MB video first, then Undo, then permanent recycle-bin emptying. If you get a fallback notice, share it so the provider limitation can be investigated.

## Installation

A new APK build is required because `IksDocumentRenameModule.kt` changed. Install over your existing version, preserving package ID/signing key and existing app data.

```powershell
npm install
npm ci --include=dev
eas build -p android --profile preview
```

The source ZIP does not carry a generated npm lockfile; `npm install` must create/update it before `npm ci` or EAS Build.

## Verification

- JavaScript syntax and UI source parser checks passed.
- Existing v21 storage, native Move, Undo, crop, video-cut, tagging, and gesture regression tests passed.
- New v22 simulated tests passed for native no-copy delete, Undo, immediate gallery state, fallback, no unsafe retry after ambiguous errors, and recycle-bin clearing.
- Kotlin source inspected; native compilation and on-device behavior are **not verified**.
