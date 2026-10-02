# Manual test plan: Undo, swipe to delete, reorder in the Items tab

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with **three or more instructions on one page** and at least one observation.

## Steps
1. **Undo button.** In the drawings view toolbar there's an **Undo** button, greyed out until there's something to undo.
2. **Delete from the item sheet.** Open an item and tap Delete: it goes at once (no dialog), and the letters after it move up.
3. **Undo the delete.** Tap Undo: the item is back with its text, pin position and letter, and the letters after it shift back. If it was the page's last pin, the notes box comes back where it was.
4. **Swipe to delete.** Open Items, swipe a row left: a red **Delete** button appears. Tap it: the item goes. Undo brings it back.
5. **Swipe and cancel.** Swipe a row left, then swipe it back right, or tap the row: it closes without deleting. Only one row is open at a time.
6. **Scroll the list.** Scrolling the Items list up and down doesn't open rows by accident.
7. **Reorder.** On a page with several instructions, drag a row's **≡** handle up or down: the other rows make room, and when you let go the letters, pins and notes box follow the new order.
8. **Reorder limits.** The handle only moves an item among the same kind on the same page. Items alone on their page (of their kind) have no handle.
9. **Undo a reorder.** Tap Undo: the previous order and letters return.
10. **Several undos.** Delete two items, then tap Undo twice: both come back, most recent first.
11. **Drawing delete.** Deleting a whole drawing from the inspection still asks to confirm.
12. **Undo after closing.** Force-quit and reopen: your work is all there, but Undo is greyed out (the history is cleared when the app closes).
13. **Offline.** Airplane mode: delete, undo, swipe and reorder all work. Turn airplane mode off.

## Feel (free text)
Swipe distance and how easily rows open; whether the drag handle is easy to grab; anything you'd want Undo to cover next.
