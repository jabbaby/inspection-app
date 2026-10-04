# Manual test plan: Step 8b – Reorder drawings and pages, 10 recipients

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with three drawings: at least one with several pages, and pins on two different drawings.

## Pre-inspection
1. **Handles.** The Drawings card shows a ≡ handle at the left of each drawing (none when there's only one drawing).
2. **Drag.** Drag the last drawing's ≡ to the top with your finger: the other rows slide out of the way and it drops at the top. The page doesn't scroll while you drag.
3. **Tap still opens.** Tapping a drawing's name still opens it on the Inspection step.

## Pages view
4. **Move a page.** Open the Pages view, tap a page's **⌄**, then **Move page later**: it swaps with the next page of the same drawing, with its pins (check the pin badge moved with it). The menu stays open on it; tap **Move page later** again to keep going.
5. **Ends of a drawing.** On a drawing's first page **Move page earlier** is greyed out; on its last page **Move page later** is greyed out (pages don't move into another drawing).
6. **Move a drawing.** From any page's menu, **Move drawing earlier / later** moves that whole drawing past its neighbour; greyed out when it's already first or last.
7. **Reorder drawings.** **Reorder drawings…** opens a list of the drawings: drag ≡ to change the order, then **Done**. The Pages view shows the new order.
8. **Menu low down.** On a page in the bottom half of the sheet, the menu opens upward and isn't cut off.

## Letters and export
9. **Letters follow.** After moving a drawing with pins ahead of another, open Items: the moved drawing's instructions are now A, B..., and the notes boxes on the drawings match.
10. **Pins stay put.** After moving pages, open the drawing: each pin and notes box is still on the same sheet, in the same spot.
11. **Export.** If the memo was exported before, the Export card says letters changed. Export again: the drawing pages in the PDF are in the new order.

## Memo recipients
12. **Ten recipients.** In the memo, add recipients until there are 10: **Add recipient** greys out at 10. The preview shows all 10; with a long memo the sign-off moves to a second page.
