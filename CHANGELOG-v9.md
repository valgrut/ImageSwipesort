# v9 — Cut MP4 videos

- The third toolbar action is **Crop** for photos and **Cut** for videos.
- For MP4 files the Cut action launches a native timeline editor with two handles.
- The selection keeps the segment *between* the handles, removing the beginning and end.
- The video remains on-device. Precise trimming is enabled (re-encoding may take time).
- MP4 is copied into a temporary app cache file first, because Android's SAF `content://` document URIs cannot reliably be consumed by native video trimmers.
- After export, the output is verified, the original is backed up in `video-cut-backups`, and only then is the source replaced.
- Undo restores the original MP4. Settings contains a button to clear cut backups when no longer needed.
- Video preview is remounted after Cut or Undo to avoid showing a cached pre-cut file.
- Video sorting, renaming, image cropping, photo preview, safe-area layout, and other v8 functionality are preserved.

## Requirements

This release adds `react-native-video-trim@8.2.4`, which includes native Android code.
**Expo Go cannot run v9.** Install v9 into a new Android APK built using EAS:

```powershell
npm install
npx expo install --fix
eas build -p android --profile preview
```

The built APK (not this ZIP) must be installed on the phone. Use the same Expo project, package name and signing key to update an existing APK without losing app data. If you previously tested only in Expo Go, v9 will not appear there; build the APK first.

## Current constraints

- On-device build and native video export are not verified in this environment. Test on disposable recordings.
- Only `.mp4` files are supported for in-place cuts. WebM, MOV, MKV and AVI can still be played/sorted but are not cut, to avoid replacing them with MP4 content under an incompatible extension.
- The complete original video is kept in app-private storage for Undo, consuming additional space until you clear backups via Setup.
- The native trimmer requires enough temporary free storage for a cached input, rendered output, and original backup. This is not designed for multi-gigabyte videos.
- Precise trimming re-encodes (takes longer than a keyframe-only stream copy). Keeps audio by default.
- The browser HTML demo remains a simulated sorting/cropping interface; **native video cutting is in the Android project only**.
