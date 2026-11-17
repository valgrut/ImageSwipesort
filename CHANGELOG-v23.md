# Image Keysort Mobile v23 — Repeat Last Destination

- Added a prominent **↻ Repeat move / Repeat copy** button in the first toolbar row, larger than the Edit and Copy toggles. The toolbar remains two rows and the Repeat button shows the last selected destination folder name. Long-press it for the full path.
- Repeat executes the same transfer path as a normal swipe for the **current** media file, respecting the current Copy toggle (including when it has changed since the previous swipe). The usual success message and Undo entry are retained.
- Tracks the **last successful** configured swipe, including nested swipes and container-center destinations. A failed, canceled or unsupported gesture never changes the repeat target. Repeating itself doesn't change that target.
- Repeat is disabled until a successful swipe has occurred, in Edit mode, while an operation is running, when there is no media, and when the underlying swipe has been removed, reassigned or marked unavailable.
- The previous destination is stored between app restarts, scoped to its source directory, and cleared when changing the source directory or loading/importing a different swipe tree.
- No native Android code or storage behavior was changed, so v22's fast Move/Delete and Undo remain intact.

## Update from v22

Replace `App.js` and add `src/repeatSort.js`, or extract the complete project and build a new APK using the existing EAS instructions. Since this is a JavaScript-only update, Expo Go / an existing development build can be reloaded; to update a standalone APK you still need to rebuild it.

## Verification

The repeat selector and v22 regression tests pass in simulation. The layout and native behavior have not been validated on a physical Android phone. Test with disposable images/videos first.
