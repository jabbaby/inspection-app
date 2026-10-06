# Manual test plan: Slice 2c – Text callouts (reworked 2026-10-06)

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file). This replaces the earlier 2c plan (steps 1 to 25).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with a drawing (the synthetic test drawing is fine), and an A3 or A4 sheet if you have one.

## The button
1. **Icon.** The Text button (after the cloud) shows a small box of text with an arrow, not a T.
2. **Hint.** In landscape, with Text on, the bar shows S M L, the colours and "Tap for a text box · hold and drag for an arrow". In portrait the hint is left out and the bar still fits.

## Placing, like a pin
3. **Tap with a finger.** With Text on, tap the drawing with a finger: a box appears where you tapped, with no arrow, and the keyboard opens. Type a few words: capitals, and the box grows.
4. **Tap with the Pencil.** Do the same with the Pencil.
5. **Hold and drag.** With a finger, press and hold: the ring fills and a small box shows under your finger. Drag away and lift: the box stays where you pressed, the arrow points where you lifted, and the keyboard opens.
6. **Same with the Pencil.** Do step 5 with the Pencil.
7. **Hold without dragging.** Hold until the ring fills, then lift without moving: just a box, no arrow.
8. **Quick drags do nothing.** With Text on, a quick finger drag scrolls the page; a quick Pencil drag does nothing. Neither places a callout.
9. **Tap off.** While typing, tap an empty part of the drawing: the keyboard closes, the callout stays, and no new box starts.
10. **Empty.** Tap to place one and finish without typing: nothing is left behind.
11. **Wrapping.** Type a long sentence: the box stops growing at about two dozen letters and wraps.
12. **No page zoom.** On an A3 or A4 sheet, placing a callout doesn't make the whole page zoom in.

## Dog legs
13. **To the side.** Place a callout with its arrow pointing off to the left or right: the arrow leaves the middle of the box's side with a short flat piece, then angles down (or up) to the point.
14. **Above or below.** Point an arrow straight down or up from the box: it's a single straight line from the box's edge.
15. **Move it about.** Drag the box from one side of its point to the other: the flat piece swaps sides.

## Selecting, editing, resizing
16. **First tap selects.** With no tool on (or Pen on), tap a callout with a finger: the toolbar switches to Text, a dashed outline and a small handle on its right side show, and the keyboard does NOT open.
17. **Second tap edits.** Tap it again: the keyboard opens with its text. Change it and tap off.
18. **Let go.** With one selected, tap an empty part of the drawing: the outline goes and no box is placed. The next tap places one.
19. **Resize.** Select a callout and drag its side handle left: the box gets narrower and the text wraps onto more lines. Drag it right: wider, fewer lines. It never gets narrower than its longest word.
20. **Width stays.** Edit a resized callout and add a few words: the width stays and the box grows taller.
21. **Move and re-point.** Drag a callout's box: it moves, its arrow still pointing at the same spot. Drag its arrowhead: it points somewhere new. Try both with a finger and the Pencil.
22. **Undo.** Undo reverses the resize, edit, move and re-point, one at a time.
23. **Drawing tools.** With Pen on, draw over a callout with the Pencil: it draws (the callout doesn't move or get selected).
24. **Erase.** With the eraser, rub over a callout (box or arrow): it goes. Undo brings it back.

## Sizes, colours, export
25. **Sizes and colours.** Place callouts at S, M and L in a couple of colours: M is about the notes box text; the border, text and arrow use the colour.
26. **PDF pack.** Export: callouts in the same places and widths, the same line breaks, and the dog legs drawn the same, with a rounded elbow.
27. **Backup.** Back up, delete and import the inspection: the callouts come back, resized ones keeping their width.
