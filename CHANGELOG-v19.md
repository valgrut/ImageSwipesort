# Image Keysort Mobile v19 — crop preview: reuse the existing gallery bitmap

**Problem:** On Android, entering Crop showed a black preview in several versions even though the same image displayed correctly in the normal gallery. Earlier attempts recreated the image with another native image component, temporary PNG or renderer; these were not validated on the affected phone.

**Change:** Crop no longer has its own image component. `App.js` always keeps the gallery's original `expo-image` view mounted while entering/leaving Crop; `CropPane` is a **transparent selection-only layer** on top of that very image. Normal navigation, radial gestures and image transforms are suppressed while cropping. The selection is letterbox-aware and supports moving the whole rectangle, four corners and four edges. The crop image geometry is obtained from the same normalized local input used for export, as before.

**Apply:** Still uses `expo-image-manipulator` on an original local copy, saving the result with existing SAF-safe replacement, backup, Undo and recovery. Nothing is deleted merely by entering Crop. Camera EXIF orientation and device-specific decoder differences still need phone verification.

**Testing:** JSX parse check, static crop architecture test, crop gesture tests, and storage tests. No Android runtime rendering test was possible in this environment. This design specifically eliminates the separate crop image that failed in previous versions, but success on the affected phone is not guaranteed until installed and tried.

**Install:** Build an APK and install over the previous app without uninstalling/clearing data. Same package ID and signing key preserve your settings and backups.

```powershell
npm install
eas build -p android --profile preview
```

If the image is still black in the crop view, report whether it is ALSO black in the normal gallery just before tapping Crop, and share the device's Android version. A device log (`adb logcat`) would then be the next diagnostic step rather than another renderer rewrite.
