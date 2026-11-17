# v6 — Android SAF destination fix

- Fixes a probable cause of `FileSystemFile.copy: A folder with the same name already exists ...` when source and destination are picked Android folders.
- `File.copy()` now targets the **destination Directory** directly, without fabricating a child `content://` URI. It then resolves the actual copied File from the directory listing.
- Name conflict check remains: existing files or folders are never intentionally overwritten.
- Destination copy is verified before deleting the source.
- Undo for Move now copies back to the source directory and verifies before deleting the destination. Undo for Delete stages the original name in app-private storage before restoring to a picked directory.
- On copy or verification failure, the original is retained and the app reports an error. Partial destination files are not automatically deleted.
- The interface, crop behavior, and browser demo are unchanged.

## Test

Run `node tests/storage-saf-test.cjs`. Uses in-memory mocks of SAF and verifies folder transfers/undo/error cases. Real Android device confirmation remains necessary.
