# Image Keysort Mobile v24 — Sub-swipe Back button placement

- In **Sort mode**, while inside any nested swipe menu, the **Back to [parent]** button now appears **directly under the image/video preview**. It has a visible green outline and a 44dp minimum tap area.
- The Back button is no longer duplicated in the lower tool row in Sort mode, leaving Undo / Delete / Crop–Cut / Setup evenly spaced.
- Edit mode retains the original lower-toolbar Back button.
- Both the new button and the swipe-up gesture use the existing `goBack()` function; the current nested menu navigation logic is unchanged.
- The Back button is hidden at the root and while the crop editor is open.
- The hint message now mentions tapping Back below the image instead of only the swipe-up gesture.
- No native dependencies or changes to file I/O.
