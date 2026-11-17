# Image Keysort Mobile v16 — crop editor repair

- Replaced the crop screen's separate transparent PanResponder layer with direct
  native responder capture on the exact image-sized view. Re-renders no longer
  change the gesture surface. Dragging all four corners, edges, and interior
  uses page-coordinate deltas and the original normalized crop rectangle.
- Corrected crop preview initialization: SDK 58's documented `manipulateAsync`
  creates a normalized local PNG, then a verified copy is used throughout the
  editor. The temporary input and preview remain until Cancel or Apply.
- Used React Native's `Image` to render that local bitmap, with load and error
  callbacks; Apply is disabled until the preview actually loads. Errors show
  an explanation instead of leaving a silent black preview.
- Kept the four-corner UI, correct portrait/landscape coordinate mapping and
  previous selection reuse. No video-cut, tagging, sorting or Undo changes.
- Validation: JSX transpile checks, crop gesture tests for all corners and
  moving selection with portrait/landscape letterboxing; existing unit and
  simulated regression tests.

**Not verified on a real Android phone.** Use a disposable image to confirm
both the preview and handle motion before applying a crop to anything important.
