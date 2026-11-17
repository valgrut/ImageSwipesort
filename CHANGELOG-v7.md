# v7 — readable storage paths

- Format Android SAF `content://` identifiers into readable folder paths in the interface.
  - Example: `content://com.android.externalstorage.documents/tree/primary%3AVideos%2FMy%20Exercises` now appears as **Internal storage/Videos/My Exercises**.
- Show the full selected destination path below the folder picker in the swipe editor, without truncating it to a basename.
- Decode encoded names in the current filename header and rename input; avoid renaming a file if the user confirms its already-displayed name unchanged.
- Internal identifiers, storage operations, move/copy/undo and the underlying saved destination URIs are unchanged.
- Add path-display regression tests.
