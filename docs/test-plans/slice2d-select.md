# Manual test plan: Slice 2d – Select

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- On a drawing, draw a few pen lines, a highlight, a rectangle, a cloud, an arrow and a text callout.

## The button
1. **Icon and hint.** The Select button (after Text) is a lasso with a dotted loop. Tap it: the bar shows "Tap a mark or draw a loop round several · tap open space to deselect" (in portrait too).

## Picking
2. **Tap with the Pencil.** Tap a pen line: a dashed box goes round it and a dark bar appears above it.
3. **Tap with a finger.** Tap another mark with a finger: it's picked instead. A finger drag away from the selection still scrolls the page.
4. **Inside a shape.** Tap inside a filled rectangle: it's picked.
5. **Loop.** With the Pencil, draw a loop that only clips part of two or three marks: all of them are picked (any part inside counts).
6. **Callouts.** Tap a callout: it's picked like the other marks (no keyboard, the toolbar stays on Select).
7. **Pins.** Tap a pin: it opens as usual and isn't picked.
8. **Let go.** Tap open space: the box and bar go and Select stays on.

## Moving and resizing
9. **Move with the Pencil.** Drag inside the dashed box: everything picked moves together, and the bar hides while dragging.
10. **Move with a finger.** Do the same with a finger: it moves, and the page doesn't scroll.
11. **Page edge.** Drag a selection hard against the page edge: it stops at the edge.
12. **Callout arrow.** Move a callout with an arrow: the box and arrow move together.
13. **Resize a box.** Pick one rectangle (then a cloud, then an ellipse): eight square handles show. Drag a corner and a side handle: the shape follows.
14. **Resize a line.** Pick one arrow: round handles at each end. Drag one: that end moves.

## The bar
15. **Position.** Pick something near the top of the page: the bar sits below it instead.
16. **Colour.** Tap the colour button and pick a colour: everything picked changes, except highlights, which keep their colour. Pick only highlights: the bar offers highlighter colours and they change.
17. **Weight.** Tap Thin, Medium and Thick: lines and shapes change; callouts keep their size. Pick only callouts: the bar shows S M L and the text resizes.
18. **Duplicate.** Tap Duplicate: copies appear a little down and right and are the new selection; drag them into place.
19. **Delete.** Tap Delete: the picked marks go.
20. **Undo.** Undo reverses each of the above one at a time (move, resize, colour, weight, duplicate, delete). Redo puts them back.

## Export
21. **PDF pack.** Export after moving, resizing, recolouring and duplicating: the PDF shows the marks where they are now.

## Follow-up (2026-10-07): callouts in Select
22. **Edit without switching.** With Select on, tap a callout (it's picked), then tap it again: the keyboard opens with its text and the toolbar stays on Select. Change it and tap elsewhere: the keyboard closes and the change is kept.
23. **Handles.** With one callout picked, a hollow circle shows at its arrow tip and a handle on its right side. Drag the tip: the arrow re-points. Drag the side handle: the box gets narrower or wider and the text re-wraps.
24. **Undo.** Undo reverses the edit, the re-point and the width change, one at a time.
