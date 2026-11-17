# v11 — preset import/export, unavailable destinations and safe video recovery

## Preset backup
- Setup → **Export setup / preset backup (.json)**: choose a destination folder, create a readable JSON file named `image_swipesort_preset_YYYY-MM-DD.json`. Existing file names receive `-2`, `-3`, etc., instead of being overwritten.
- Setup → **Import setup / preset backup (.json)**: choose an exported file and confirm before replacing your active swipe tree, saved presets, tag shortcuts and crop rectangle.
- Source folder, media, and undo history are **not** transferred, as these depend on local device permissions/files. Imported destination URIs often require reselecting on a different phone.
- All destination folders are checked on tree load/import and when the tree changes. Missing/inaccessible destinations appear gray with ⚠. Those nodes can still contain navigable submenus; sorting into their invalid destination is blocked. A warning lists all affected swipe paths after loading/importing. Edit → Modify → Choose destination to fix each.

## Important: recover original-video backups from older versions
**If a cut failed on v9/v10, DO NOT uninstall the Android app or clear app data/storage or delete backups.** Install the new APK over the existing installation, keeping package ID and signing key unchanged, then:

1. Open **Setup → Recover original videos from failed cuts**.
2. Find the missing video (the list includes older saved backups).
3. Select **Copy original to a folder…** and pick a destination.
4. Verify the recovered MP4 plays normally. The private backup is retained.

If you uninstalled the old APK, changed the package ID or signing key, or cleared app data, private backups may be inaccessible or gone.

## Video replacement safety redesign
- No more writes to the stale content URI (`File.copy(existing SAF File, {overwrite:true})`) implicated in the reported data loss.
- Before modifying the original, the app makes a verified private original backup and copies the rendered clip to a separate temporary file in the selected source folder; the temporary file is verified.
- Only after verification does it remove the old original and rename the temporary cut to the original name. If the final rename fails, the app tries to restore the backup through a new directory copy, never through the old document URI.
- If automatic restoration fails, the original backup stays in app storage and the temporary cut remains in the user-selected source folder for inspection. The Recovery screen exports a backup non-destructively without filename collisions.
- Cut Undo now uses the same staging-and-verification transaction rather than overwriting an existing SAF file. Undo backups are retained until the user explicitly clears them.
- Native Android behavior is **not verified on a physical phone**, and interruptions/providers can still fail in unexpected ways. Test with disposable videos before relying on cuts of original recordings.

## Build and upgrade
- The ZIP contains source, not an APK.
- Run `npm install`, which generates/updates `package-lock.json`. Confirm `npm ci --include=dev` succeeds, then `eas build -p android --profile preview`.
- This environment had no access to the npm registry, so the ZIP does **not** contain a freshly generated lockfile. If extracting over an old project, update the old lock with `npm install` before the EAS build.
- Keep package `dev.imagekeysort.mobile` and Android signing key when updating; otherwise existing app-private backups cannot be transferred automatically.

## Tests
`node tests/video-recovery-v11-test.cjs` and `node tests/preset-backup-v11-test.cjs` cover the main transactional and preset logic with simulated storage. These do **not** replace testing on a physical Android device.
