## v23 — Repeat last swipe destination

In Sort mode, use the large **↻ Repeat move / Repeat copy** button in the toolbar to apply the last successfully swiped destination to the current file. The button respects the current Copy mode, displays the destination folder name and shows the full path when held. It is disabled if the prior swipe is no longer configured or accessible. See `CHANGELOG-v23.md`.

> **v21:** Fast Move Undo no longer rescans the entire source folder; see [CHANGELOG-v21.md](CHANGELOG-v21.md).

# Image Keysort Mobile v18 — crop rollback

This version targets the black/empty Crop editor regression reported in v15–v17. It restores the early v5 crop layout and image-frame geometry, keeps the v16 movable-corner gesture implementation, and keeps the v17 safe Android backup/replacement/Undo logic. The editor now shows the original gallery image and retains an independently normalized temporary image for crop export. See `CHANGELOG-v18.md`.

**Important:** This change is checked with source and simulated tests, but the cropped image has not yet been verified on a physical Android device. Please test with a disposable screenshot before editing valuable files.

To upgrade: extract the archive, run `npm install` to synchronize your `package-lock.json`, then `eas build -p android --profile preview`. Install the APK over the previous version (do not uninstall or clear data if you have backup media stored in the app).

---

## v16: Android crop-editor repair

The v15 Android crop screen could display a black preview while its corners
remained visible but did not respond to touch. v16 changes only the crop flow:

- Uses Expo SDK 58's documented `manipulateAsync` API to normalize the temporary image.
- Keeps a separate, verified, nonempty local PNG preview alive until the editor closes.
- Renders the PNG using React Native's native `Image` component instead of an overlaid image view.
- Captures touches on the same image-sized native view, with native responder events and globally measured drag deltas; no separate transparent `PanResponder` surface.
- Disables Apply when the bitmap fails to load and shows a readable error instead of silently cropping an invisible image.
- Preserves the four corner handles, edge dragging, move-the-whole-rectangle behavior, normalized crop geometry, and the previous crop rectangle.
- Does not touch the original photo until **Apply crop** is explicitly pressed.

No new native dependencies. After replacing `App.js`, `src/CropPane.jsx`, and adding
`src/cropGesture.js`, rebuild the Android APK with
`npm install && eas build -p android --profile preview`.

The new JavaScript/geometry checks pass, but on-device rendering and touch behavior
still require physical Android testing. Test with a disposable screenshot first.

> **Latest update — v15:** Fixed the Expo Crop crash, removed tag toggles from Undo history, display the destination folder after a move/copy, and show an Undo preview while the Undo button is held. See `CHANGELOG-v15.md`.

**Build v15:** In the project folder run `npm install`, then `eas build -p android --profile preview`. Install the APK over the previous version to keep your data. The ZIP has no lock file; `npm install` creates one.

---

> **Latest update — v13:** Android tag toggles and manual rename now avoid unsupported `content://` rename and use a verified copy/delete transaction with Undo. The preview has a green border in Edit or Copy mode. See `CHANGELOG-v13.md`.

# Image Keysort Mobile v12 — Android video-cut fix

**v12 fixes the Android error** `This method cannot be used with content URIs` caused by `File.rename()` on a picked source folder. The cut now uses a verified **new-file copy** back to the source directory, keeping the original in an app-private backup; it renames only a private `file://` staging file. The previous v11 approach documented below is superseded for video cutting. See `CHANGELOG-v12.md` for error handling and recovery details.

If v11 reports **Original restored from backup**, the original should still be in the source directory. Verify this in a file manager and look for an extra `__iks_pending_...mp4` file before deleting anything.

To upgrade the APK, use the same package ID/signing credentials. Never uninstall or clear app data while an original video backup might still be needed.

**Build:** In the extracted project directory run `npm install`, `npm ci --include=dev`, and `eas build -p android --profile preview`. A lockfile is not included because this environment cannot fetch npm dependencies; `npm install` synchronizes it locally.

---

## Version 10 — filename tags

Tap **🏷** next to the filename to add/manage reusable filename tags. Applying/removing a tag renames the current media and can be undone. Deleting a tag from the list never changes a media filename. Tags persist in app settings. See `CHANGELOG-v10.md`.

# Image Keysort Mobile v9 — Android MP4 Cut

**New in v9:** The toolbar automatically displays Crop for pictures and Cut for videos. For MP4s, Cut opens a native two-handle timeline editor to remove the first or last seconds. The processed video replaces the current file after a backup is safely created. Undo restores the original. See `CHANGELOG-v9.md`.

**Important: V9 REQUIRES A NEW APK. It cannot run in Expo Go because `react-native-video-trim` includes native code not bundled with Expo Go.** The existing QR-code/Expo Go instructions below describe the earlier image-only prototype; they are not sufficient to test Cut.

## Build and install v9 on Android (Windows)

1. Extract this ZIP. Open PowerShell in the directory containing `package.json`.
2. Install dependencies: `npm install`, then `npx expo install --fix`.
3. Install EAS CLI if necessary: `npm install -g eas-cli`, then log in: `eas login`.
4. Build: `eas build -p android --profile preview`. If Expo asks to initialize the project or create credentials, follow its prompts.
5. Open the resulting APK download link on the phone and install it. Keep the same Android package name and signing credentials as your prior installed APK.
6. Select a source directory containing a **disposable MP4**. Choose Cut, drag the start/end handles, then Apply cut; verify the clip and Undo before using valuable media.

Once installed, the APK needs no running development server or backend. Native video cutting cannot be enabled in an already compiled v8 APK by hot reloading JS; you must install the new APK.

---

# Image Keysort Mobile · Android-first prototype

A React Native/Expo mobile adaptation of the desktop Image Keysort workflow, plus a self-contained browser interaction prototype. This is **an experimental source project, not a tested production APK**. The authoring environment could check syntax and browser interactions but could not download npm packages, compile an Android build, or test SAF file operations on a phone. **Start with copies of nonimportant media.**

## Fast test on Android using Expo Go

1. Install **Node.js 22.13+** on your computer.
2. Install **Expo Go** on your Android phone (Google Play).
3. Extract this ZIP and open a terminal in the `imagekeysort-mobile` folder.
4. Install and align dependencies:

   ```bash
   npm install
   npx expo install --check
   ```

   If `expo install --check` reports version incompatibilities, use `npx expo install --fix` before proceeding.

5. Start the QR-code dev server:

   ```bash
   npx expo start
   ```

   Leave the terminal running. Connect phone and computer to the same Wi-Fi network. Scan the QR code using Expo Go, or the regular camera if supported by your Expo Go version.

   If your Wi-Fi prevents LAN connections, try `npx expo start --tunnel`. Expo may need to download `@expo/ngrok` for tunnel mode.

6. The app opens in **demo mode** with three bundled images; no actual files change until you pick a source and destinations. Tap `Edit mode`, configure a swipe, switch to `Sort mode`, and drag from the center icon. The toolbar has two rows: Mode + Copy above Undo/Delete/Crop-or-Cut/Setup (and Back when inside a nested swipe). Open the source directory and save/load swipe presets from Setup.

7. To test real files, create two temporary test folders containing disposable copies of a few small JPG/PNG/MP4 files, select one as source (`⚙ Setup` → `📂 Open source directory`), and select the second as the destination for a swipe.

**Important:** For older versions only: the QR code launches a local Expo project *inside Expo Go*. It is **not an installed, standalone APK**. The computer must keep running the dev server while you test. Expo Go needs a version compatible with SDK 58.

## Standalone APK later

Create an Expo account, install EAS (`npm install -g eas-cli`), run `eas login`, `eas build:configure`, and then `eas build -p android --profile preview` using the included `eas.json`. This requires the remote build service, and will produce an installable APK after the build finishes. An APK is **not included** in this archive.

## Browser demo

Open `browser-prototype.html` in a browser (or host it as a static webpage). It allows touching/dragging the radial menu, creating nested swipe trees, naming virtual destinations, cropping previews and undoing simulated operations. From Setup, choose a folder (where supported by the browser) or import individual images/videos for preview. The browser demo **never moves, deletes, or renames device files**.

## Implemented in the React Native source

- Source directory selection via Android's native document tree picker, with no default source.
- List JPEG, PNG, WebP, HEIC, GIF, BMP, MP4, MOV, MKV, WebM, AVI and M4V files (format support depends on Android's codecs).
- Filename, file size, square contain-fit preview, adjacent thumbnails, and number index jumping.
- Center gesture radial selector with 8 directions; configured segments have tinted highlights and unspecified directions remain blank.
- Edit tree: create, delete (with confirmation), rename, icon, color, destination folder picker, lock and move direction, nested sub-swipes.
- Sort tree: root radial menu appears only during interaction, sub-level nodes remain visible; return through Back or the upward gesture.
- Normal navigation via swiping the image horizontally; pinch-to-zoom for images (basic, without inertial panning).
- Native-file-copy-backed transfer and deletion, copy-only toggle, undo stack persisted as JSON, and an app-private recycle bin.
- Video playback plus time scrub bar; video gestures use the same radial center widget.
- Pixel-aligned manual crop for JPG/PNG with all four adjustable corners, four draggable edges, movable rectangle, reusable selection and original backup for undo. The native editor first normalizes the image to a temporary PNG using expo-image-manipulator, shows that bitmap, then crops from that same PNG so EXIF rotation and decoder differences cannot shift the result.
- Local snapshots for swipe presets and saved source configuration.

## Important limitations

- **Android-first**: directory picking is supported on Android via Storage Access Framework. iOS is not tested or guaranteed to have equivalent semantics.
- **New v6 SAF transfer fix is not yet tested on a real phone**: native SAF `File.copy`, `File.move`, `rename`, crop-in-place, video playback and file URI persistence require validation on device. Android file providers (including cloud providers) differ; some may reject an operation. If saved folder permissions become stale, pick them again.
- **Don't test on irreplaceable files.** A copy is verified before the source of a move is deleted, and existing destination filenames are never intentionally overwritten during sorting. Bugs or interrupted transfers can still lead to inconsistent state.
- **No automatic crop edge detection** yet; all four corners and edges are manually adjustable. Images are normalized to an orientation-free temporary PNG before native cropping. This is safer but uses extra temporary storage and may take longer for very large screenshots. The intermediate file is deleted when the crop is completed or cancelled. No batch auto-detection.
- Filename tag shortcuts (literal strings) are implemented. Content recognition / automatic semantic tagging is not implemented.
- **Nested transitions** are currently basic fade-and-scale rather than the requested directional slide/push choreography.
- Browser demo is simulated. Native APK is not bundled.
- `Undo` for a move depends on the destination still being accessible; for crop it depends on the preserved original backup. Removing or replacing files outside the app can invalidate undo.
- **Deletion (v22):** Android attempts a fast, reversible SAF move into a hidden `.imagekeysort-trash-…` folder **inside the selected source directory**. This keeps the video on the same storage provider, without copying its bytes. Undo moves the document back. If the provider does not support this, the app uses the older, slower app-private recycle bin. The hidden folders survive an app uninstall; use **Setup → Empty app recycle bin** to permanently remove their contents while the app still has directory access. Crop backups remain app-private and can be cleared separately.
- Directory listing is nonrecursive. Folders with thousands of files may need thumbnail prefetching and pagination to keep scrolling and loading smooth.
- Some devices need Expo development builds rather than Expo Go for a robust release. An optimized standalone production version should consider a dedicated Kotlin Android SAF module for high-performance cross-volume moves and permissions.

## Files

- `App.js` – main UI, state and gestures
- `src/model.js` – swipe tree data structures and geometry
- `src/storage.js` – Android file I/O and undo implementation
- `src/VideoPane.jsx` – video preview and timeline
- `src/CropPane.jsx` – fitted-image crop editor with draggable corners and edges
- `src/cropMath.js` – aspect-ratio-safe crop geometry and source-pixel calculations
- `assets/demo*.jpg` – synthetic demo images
- `browser-prototype.html` – fully offline browser UI prototype

## Development workflow

Modify source and save. Expo Fast Refresh automatically updates the app in Expo Go. For build/runtime errors, inspect the terminal logs and the red error screen on the phone. UI and data logic are separated so they can be iterated independently.

### Sort-mode fingerprint visibility

At the root level, the center fingerprint button is invisible until you touch and hold its position. The transparent touch target is still active. In Edit mode and inside nested swipe levels, the center button remains visible.

### Crop fixes in v4

The crop box is attached to the displayed bitmap itself (not the square canvas). Drag any corner, edge or the rectangle interior. The selection persists between images. In the browser demo, the crop preview is a canvas rendered from the same pixels used for crop output. In the Android app, a temporary orientation-normalized PNG is both displayed and cropped so EXIF metadata cannot shift the result. The source is backed up for Undo. The native build still needs physical-device testing.

Run `node --experimental-default-type=module tests/crop-math-test.mjs`, `python tests/browser-test.py`, `python tests/crop-browser-test.py`, and `python tests/crop-orientation-test.py` for regression tests. The orientation test covers EXIF orientations 1, 3, 6 and 8, and checks the green Edit-mode border. The two browser test suites cover portrait and landscape images and compare decoded crop pixel values to source coordinates. Native Android operations still need physical device validation.


## Android SAF copy fix (v6)

Android SAF destinations now use `source.copy(destinationDirectory)` and resolve the actual returned `File` URI via the folder listing. Preflight refuses name collisions; copy is verified before removing source; undo of moves/deletes uses the same safe folder-copy flow. Physical device testing is still needed.

## Display safe areas (v8)

The header now sits inside the platform-reported safe area (Android status bar / camera cutout, iPhone notch) with 10 px additional top space. React Native requires `react-native-safe-area-context` (declared in `package.json`). To update from a previous version by replacing only `App.js`, first run `npx expo install react-native-safe-area-context`, then restart `npx expo start -c`.

## v11 changes — backups, recovery, validation

Read `CHANGELOG-v11.md` before updating. The version adds dated JSON setup export/import in Setup, invalid-destination warnings with ⚠ and disabled gray sort targets, and a **Recover original videos from failed cuts** screen. The Android CUT operation uses backup + staging + verification + non-overwriting final rename instead of copying into the existing SAF document URI. The old backup is preserved even if recovery succeeds.

**Critical for prior lost videos:** Never uninstall/clear app data before opening the new recovery screen and exporting the original video backups. Install a newly built v11 APK *over* your old APK using the same package and signing key. The affected original might still be in the private `video-cut-backups` directory. The new Recovery screen copies it to an external folder without deleting the private copy.

To build:

```bash
npm install
npm ci --include=dev
eas build -p android --profile preview
```

`npm install` must run **before** EAS Build so `package-lock.json` matches `package.json` (the earlier v10 ZIP lacked a synchronized lock). This project archive intentionally contains no lockfile because the creation environment could not access the npm registry; generate it on your connected computer. There are no additional third-party native dependencies relative to v10; the import picker uses Expo FileSystem's built-in Android file-picker API.

## v14 — radial sorting and Android rename

See [CHANGELOG-v14.md](CHANGELOG-v14.md).

**Radial sorting:** press and hold the invisible center of the image preview in Sort mode to display the destinations. Continue touching while sliding anywhere within the preview: the currently occupied defined direction stays highlighted, and the full name appears in the hint bar. Returning to the center, moving onto an undefined direction, or moving outside the image preview cancels; lifting commits the currently selected direction. The menu does not disappear until the finger is lifted at root level.

**Tagging / manual rename:** uses a new Android local Expo module and Android `DocumentsContract.renameDocument()`; this changes document names through the provider rather than copying their contents. Tag addition, removal, and Undo use the returned URI. Not all Android document providers support renaming; unsupported providers produce an error without deleting/copying the file.

The custom native module requires rebuilding a **standalone APK** (Expo Go cannot run it). Keep the same package ID/signature and install over the existing build to preserve private data. Before submitting EAS Build, run `npm install` followed by `npm ci --include=dev` to sync/verify the lock file.

## v17 crop preview and backup recovery

Crop now uses the same image URI and `expo-image` renderer as the gallery (with a byte-for-byte cached fallback), instead of displaying a generated PNG. The four-corner selector remains. Applying a crop uses a separate cached copy, and saving the result uses an Android SAF-safe transaction with an original-image backup. Setup → Recover original images from crops exports a backup to a chosen folder without deleting it.

Always test on a disposable image when upgrading; these changes have not been verified on a physical Android device.


## v19 crop editor

See [CHANGELOG-v19.md](CHANGELOG-v19.md). Crop now overlays the **existing gallery image** rather than mounting a second image renderer. The native Android view is never replaced when Crop opens.


## v20 fast native Move

Moving between Android SAF folders uses a native `DocumentsContract.moveDocument()` method when the provider supports it, avoiding video-byte copying. Unsupported providers fall back to verified copy/delete and show a one-time warning. Native undo moves files back the same way. See `CHANGELOG-v20.md`. This requires an APK rebuild and real-device verification.


## v22 — Fast reversible Delete

See `CHANGELOG-v22.md`. On Android, deleting from a selected source folder now uses native `DocumentsContract.moveDocument()` to move into an app-owned hidden recycle directory inside the **same source folder**, avoiding a full video copy. Undo moves the same document back. Both remove/restore the item from the in-memory gallery rather than rescanning the whole folder. The recycle bin is not automatically cleared; **Setup → Empty app recycle bin** now clears both the old private bin and fast same-provider bins tracked for previously selected source folders.

The hidden folders live alongside your media, not in app-private storage. **Do not uninstall or clear app data until you have restored important deleted files or emptied the recycle bin intentionally.** If the app is uninstalled, the hidden recycle folders may remain in your source directories and can be recovered manually using a file manager that shows hidden files. An unsupported storage provider falls back to the older slower private recycle bin.

The Kotlin native module changed; build and install a new APK with the same package ID/signing credentials. Validate Delete and Undo using disposable files on your phone; simulated JS tests cannot verify all SAF provider behaviors.


## v24 — Back button under the preview

In Sort mode, when you enter a nested swipe menu, a prominent `← Back to <parent>` button is shown directly beneath the media preview. The bottom toolbar has no Back button in Sort mode; it remains available there in Edit mode. See `CHANGELOG-v24.md`.
