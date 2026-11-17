# v10 — Filename tags

- Adds a tag button (🏷) beside the existing filename rename (✎) control.
- Adds a reusable persistent list of user-defined literal text tags.
- `+ Add tag` prompts for a string; Cancel and Confirm are supported.
- Tap a saved tag to toggle its literal text within the filename stem, before the extension. Selected tags are highlighted green.
- Trash beside a saved tag deletes **only that saved shortcut**. Existing filenames are never modified by this deletion.
- Every successful filename toggle is recorded as a Rename operation and supports Undo.
- Names that conflict with another file in the source directory are rejected. Preserves Unicode and punctuation, and avoids modifying the extension.
- Tags are stored in AsyncStorage with the existing app state; tag list survives restarts and source changes.
- No new dependencies or native modules beyond v9; existing video Cut functionality is kept.

## Notes
- Tags are *literal filename strings*, not EXIF metadata or database labels.
- Tags are detected by a case-sensitive substring match in the filename **stem**. If a tag is part of unrelated text, it will also appear active; choose distinctive tags, for example `[Pole]`.
- On-device file-provider rename compatibility must still be tested on your Android phone.
