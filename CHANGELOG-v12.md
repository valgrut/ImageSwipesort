# v12 — Android SAF video cutting: no `content://` rename

## Problem fixed

On Android, selecting a folder through the Storage Access Framework returns `content://` document URIs. Expo `File.rename()` cannot rename those documents. In v11 the trim was successfully created as a pending clip, but the final attempt to rename it failed; the automatic restoration then restored the original video. That is why the user saw:

`This method cannot be used with content URIs ... __iks_pending_...mp4`

## New cut transaction

1. Verify the original MP4 and trimmed output exist and are nonempty.
2. Copy the original MP4 to app-private `video-cut-backups/` and verify its size. Keep the backup for recovery / Undo.
3. Make a private staging copy of the cut with a unique `__iks_pending_...mp4` name, copy it into the user-selected source folder using `File.copy(Directory)`, and verify that copy.
4. Rename **only the private `file://` staged clip** to the original filename. This is supported; `File.rename()` is never called on an Android SAF document in the cut transaction.
5. Verify the original has not changed during trimming, then delete the original document. Copy the private, properly named cut into the selected directory with `File.copy(Directory)` and verify the result. This creates a NEW Android document with the original filename; it never tries to overwrite or reuse the deleted document URI.
6. Delete the pending cut only after verification. If that cleanup fails, report a warning and leave it for the user to inspect.

On any failure after deletion, the app attempts to restore the original from its private backup through another new `File.copy(Directory)` operation. If restoration fails, **do not delete/clear app data**: use `Setup → Recover original videos from failed cuts` to save the original backup elsewhere. The pending clip is preserved if required. A partially written document isn't silently overwritten or mistaken for the original.

**Known limitation:** Android SAF providers can still fail during deletion or file creation; this cannot be guaranteed completely safe until checked on real hardware. Keep the backup, test with disposable videos, and inspect the result and Undo before trimming irreplaceable media. The browser prototype does not exercise Android file operations.

## Files changed
- `src/storage.js`: fixed cut transaction, rollback, and warning text; other storage operations unchanged.
- `App.js`: shows a warning if the pending cut could not be cleaned after successfully replacing the video.
- `tests/video-recovery-v12-test.cjs`: rejects `rename()` on every `content://` URI while verifying success, Undo, spaces in filenames, staged-copy failure, private rename failure, failed final copy, recovery, incomplete output, and delete-then-throw behavior.
- `package.json`: patch version bump.

## Build
No new native dependency. If updating an existing v11 source folder, replacing `src/storage.js` and `App.js` is sufficient. For an installed APK, rebuild:

```powershell
npm install
npm ci --include=dev
eas build -p android --profile preview
```

Use the same Android application ID and signing credentials to preserve app-private backups and settings. This ZIP does not include a lockfile because the build environment could not retrieve npm dependencies; running `npm install` on your computer generates a synchronized `package-lock.json`.
