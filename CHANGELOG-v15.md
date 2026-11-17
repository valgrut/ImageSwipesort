# Image Keysort Mobile v15 — Crop fix, non-undoable tags, destination notices, Undo preview

## Crop crash fix
- Fixed an SDK 58 JavaScript API call that could throw `undefined is not a function` when opening Crop. The correct call is `ImageManipulator.ImageManipulator.manipulate(uri)`, not `ImageManipulator.manipulate(uri)`. Corrected both the preview normalization and the final crop call.
- Retains the known-good orientation-normalized image preview and four draggable crop corners.
- Corrected newly recorded crop Undo metadata: the image's **file URI** is preserved; the source **folder URI** is stored separately. The video cut history entry was corrected similarly.

## Tagging and Undo
- Tapping saved tags still renames the current file directly through the v14 native Android `DocumentsContract.renameDocument` module.
- Tapping a tag no longer adds an action to the Undo stack. Tap the same tag again to reverse it.
- Manual renaming through the pencil still adds an Undo action.
- Existing Undo entries that point to the tagged file are updated after a successful tag rename (including latest manual rename/crop/cut entries). For a manual rename followed by a tag, the tag is preserved when undoing the manual rename.
- Tag-related rename entries created in **older installed versions** cannot be reliably distinguished from pencil renames in saved history; v15 does not retroactively remove those previous entries.

## Sort status
- On successful transfer, the hint now says `File moved to Internal storage/Pictures/...` (or `File copied to ...`), showing the destination folder instead of only the media filename.
- The status allows three lines. Tap it to display the entire message if it doesn't fit.

## Undo: tap versus hold
- **Short tap**: execute Undo, as before.
- **Press and hold (450 ms)**: show a floating preview of the top Undo operation; release to dismiss without executing it.
- Shows an image thumbnail when the undo target is a picture; for videos, shows a video icon rather than a generated video frame.
- Explains where a moved file will be restored from/to; covers copy, delete, crop, cut, rename, and demo operations as well.
- Long-press never starts an Undo operation.

## Testing and limits
- Source passed TypeScript transpilation syntax checks for React Native JSX and all existing Node-based regression tests.
- New tests verify destination descriptions, undo thumbnail URIs, tag history invariants, and both SDK crop call sites.
- **A physical-device APK build and runtime crop/touch test were not available in the authoring environment.** Use disposable media until verified.
- No new native dependencies. Rebuild over the installed v14 APK, retaining application ID and signing credentials, to preserve settings and private backups.
- The project archive does not include `package-lock.json`; run `npm install` before `eas build` so EAS's `npm ci` receives an up-to-date lock file.
