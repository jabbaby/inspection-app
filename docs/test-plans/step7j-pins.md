# Manual test plan: Step 7j – Pins by tap, double-tap and hold

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Open an inspection with a drawing, on the Inspection step, with no item or panel open.

## Steps
1. **Tap = instruction.** Tap an empty spot on the drawing with a finger: a red pin appears at once where you tapped, its editor opens and the keyboard comes up.
2. **Tap away closes first.** With that editor open, tap the drawing elsewhere: the editor closes (text kept) and no pin is added. Tap again: a new pin.
3. **Panels close first.** Open **Items**, tap the drawing: Items closes, no pin. Tap again: a pin. Same with the Drawings panel.
4. **Apple Pencil.** Tap with the Pencil: a pin, as with a finger. Drag with the Pencil: the drawing doesn't scroll.
5. **Double-tap = observation.** Double-tap an empty spot: one blue pin (not a red one plus a blue one). The keyboard may flash up as it switches; that's expected.
6. **One undo step.** Tap Undo once: the observation pin is gone. Redo brings it back, still blue.
7. **Double-tap a pin.** Double-tap an existing red pin: it turns blue and its editor shows Observation. Undo turns it red again. Double-tap a blue pin: it turns red.
8. **Editor switch undoes.** In an item's editor, switch Instruction to Observation, then Undo: back to Instruction.
9. **Hold = pin only.** Press and hold an empty spot without moving: after about half a second a red ring fills under your finger and a pin appears. Lift: the pin is placed with no arrow and its editor opens.
10. **Hold then drag = arrow.** Press, hold until the pin appears, then drag: an arrow follows your finger and the drawing doesn't scroll. Lift: the pin stays where you first pressed and the arrow points to where you lifted. Undo once removes both.
11. **Arrow stays on the page.** Hold near the bottom of a page and drag past the page edge: the arrow tip stops at the page edge.
12. **Scrolling still scrolls.** Swipe the drawing quickly: it scrolls with momentum and no pin or ring appears. Press and start moving straight away: it scrolls, no ring.
13. **Stopping a scroll.** While the drawing is still gliding, tap it: it stops, no pin.
14. **Pinch.** Pinch to zoom: no pin and no ring. Hold one finger, then add a second and pinch: the ring disappears and it zooms.
15. **Pins as before.** Tap a pin: its editor opens. Drag a pin: it moves. Drag the notes box: it moves, no pin or ring.
16. **Add pin button.** Tap **Add pin** in the left pill, then tap the drawing: a pin, as before.
17. **Mouse (if you have one connected, or on a computer).** Click = pin, double-click = observation, hold the button half a second then drag = pin with an arrow; a quick drag pans.

## Issues found
-
