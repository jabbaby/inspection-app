# Manual test plan: photo viewer fixes

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an item with three or more photos, portrait and landscape.

## Steps
1. **Top bar.** Open a photo: **Close** (top left) and **Save** (top right) sit below the iPad's clock and battery, not under them, in portrait and landscape.
2. **Background.** The viewer is cream like the rest of the app, not black.
3. **Swipe.** Swipe left: the next photo. Swipe right: the previous one. The photo follows your finger.
4. **Ends.** At the first or last photo, swiping further just springs back.
5. **Vertical drags.** Dragging up or down doesn't change photo.
6. **Save.** Type a caption and tap **Save**: the viewer closes. Reopen the photo: the caption is there.
7. **Close keeps it too.** Type a caption, tap **Close**, reopen: the caption is kept.
8. **Caption while swiping.** Type a caption, swipe to another photo and back: it's kept.
9. **Delete.** Delete photo still works, and Undo brings it back.
10. **Bottom.** The caption box and Delete button stay clear of the home bar.
