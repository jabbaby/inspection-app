# Manual test plan: Slice 2c – Text callouts

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with a drawing (the synthetic test drawing is fine), and an A3 or A4 sheet if you have one.

## Placing a callout
1. **Text button.** The toolbar has a **Text** button after the cloud. Tap it: **S M L** sizes and colours appear. In portrait the whole bar still fits.
2. **With a leader.** With the Pencil, drag from a spot on the drawing and lift a little way off: the arrow follows as you drag, and when you lift the keyboard opens with a box where you lifted.
3. **Typing.** Type a few words: they appear in capitals, the box grows as you type, and the arrow stays pointing at your spot.
4. **Wrapping.** Keep typing a long sentence: the box stops growing at about two dozen letters and wraps onto more lines.
5. **No page zoom.** On an A3 or A4 sheet, placing a callout doesn't make the whole page zoom in (iOS does that to small text boxes).
6. **Finishing.** Tap elsewhere or turn Text off: the keyboard closes and the callout stays, white box, coloured border and text.
7. **Without a leader.** With Text on, tap the drawing (no drag): a box with no arrow. Type and finish.
8. **Empty.** Tap to place one and finish without typing: nothing is left behind.
9. **Keyboard covering it.** Place a callout low on the screen: tell me whether it stays visible above the keyboard while you type.

## Editing
10. **Edit.** With Text on, tap a callout: its text opens for editing. Change it and finish.
11. **Move.** With Text on, drag a callout's box: it moves, and its arrow still points at the same spot.
12. **Re-point.** With Text on, drag the arrowhead: the arrow points at the new spot.
13. **Undo.** Undo reverses the edit, the move and the re-point, one at a time.
14. **Other tools.** With Pen on, drawing over a callout draws (doesn't move it). With no tool on, tapping a callout does nothing.
15. **Erase.** With the eraser, rub over a callout: it goes. Undo brings it back. Edit one and delete all its text: it goes (Undo brings it back).

## Sizes and colours
16. **Sizes.** Place callouts at S, M and L: M is about the size of the notes box text.
17. **Colours.** Change the colour before placing: the border, text and arrow use it.

## Export and backup
18. **PDF pack.** Export: the callouts are in the same places, the same size, with the same line breaks, and the text can be selected or searched in the PDF.
19. **Backup.** Back up, delete and import the inspection: the callouts come back.

## Follow-up (2026-10-06): moving callouts, tapping off
20. **Tap off.** While typing a callout, tap an empty part of the drawing: the keyboard closes and the callout is kept, and no new callout starts.
21. **Move with the Pencil.** With Text on, press on (or just next to) a callout's box and drag: it moves, its arrow still pointing at the same spot.
22. **Re-point.** With Text on, a small hollow circle shows at each arrow's tip. Drag it: the arrow points at the new spot.
23. **With a finger.** Do 21 and 22 with a finger: the callout moves and the page doesn't scroll. Away from callouts, a finger still scrolls.
24. **Like a pin.** With no tool on (and with Pin on), tap a callout: it opens for editing. Drag it: it moves. Drag its arrow tip: it re-points. No pin is placed.
25. **Drawing tools.** With Pen on, draw over a callout with the Pencil: it draws (the callout doesn't move). A finger on the callout still moves it.
