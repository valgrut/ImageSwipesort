# Image Keysort Mobile v13 — tagging, manual rename and Copy-mode border

## Fix: Tag changes and pencil rename on Android folder-picker files

- Fixed `FileSystemFile.rename` / `This method cannot be used with content URIs` when adding or removing tags and when renaming manually.
- The Android Storage Access Framework returns a `content://` document URI. Expo's `File.rename()` cannot rename those documents.
- `renameMedia` is now asynchronous and requires the selected source folder URI. It stages the original in app-private storage under the requested new name, copies and verifies the new file in the original folder, then deletes the old document only after verification.
- No `rename()` call is made on a `content://` document in the rename/tagging path.
- Updated Undo to reverse the same verified copy/delete transaction instead of calling `File.rename()` on a SAF URI.
- Both the tag interface and pencil editor await the operation, update the source file list and select the newly named file.
- Duplicate names are refused; copy failures preserve the original. Because SAF copy/delete is non-atomic, rare partial failures can leave duplicates. Inspect the source directory after errors.

**Performance note:** Renaming may copy the complete media file; on a large video this can take longer than a native filesystem rename.

## Fix: Green border in Copy mode

- The preview container now has a 2 px green (`#34d399`) border when **either Edit mode or Copy mode** is enabled.
- Works for both image and video previews. Sort mode with Copy off retains its normal thin border.

## Testing

- Added `tests/rename-tags-saf-v13-test.cjs`: simulates Android refusing all SAF renames and checks tag add/remove, regular rename, Undo, collision handling, copy failures, file size mismatch, delete failure and the Copy/Edit border condition.
- Existing tests for SAF transfers, v12 video cut/recovery/undo, tag strings and presets still pass.
- **Not tested on a physical Android device.** First test renaming a disposable picture, then check Undo.
- No new native modules/dependencies. For an existing project, replace `App.js` and `src/storage.js` and rebuild the APK if using a standalone install.

## Build

If you extract the full ZIP into a fresh directory, run `npm install` before `eas build -p android --profile preview` to generate/update `package-lock.json`. The ZIP does not include a lockfile.
