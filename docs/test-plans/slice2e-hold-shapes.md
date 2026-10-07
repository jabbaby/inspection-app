# Manual test plan: Draw and hold shapes, fluoro highlighter

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use a drawing (the synthetic test drawing is fine).

## Fluoro highlighter
1. **Starting colours.** Turn the Highlighter on: its colours are now fluoro yellow, green, pink and red (your pen colours are as they were).
2. **Red is red.** Highlight over some linework in each colour: the red reads as a bright red, not brown, and the linework still shows through.
3. **More colours.** Tap the selected highlighter colour again: the panel offers 12 fluoro colours, Custom…, Add colour and Remove.
4. **PDF.** Export: the highlights look the same in the PDF.

## Draw and hold (pen)
5. **Circle.** With the Pen, draw a rough circle, finish near where you started and hold the Pencil still: about half a second later it snaps to a clean circle, lightly filled, before you lift.
6. **Ellipse.** Draw a long oval level, then one at an angle: the level one is level; the angled one keeps its angle.
7. **Rectangle and square.** Draw a rough rectangle and hold: square corners, straight sides. Draw a rough square: equal sides.
8. **At an angle.** Draw a rectangle on a slant: it keeps its slant, with right-angled corners.
9. **Triangle and more.** Draw a triangle, then a five- or six-sided shape: they snap through their corners.
10. **Straight line.** Draw an open stroke and hold: it becomes a straight line whose end follows the Pencil until you lift (as before).
11. **Unclear.** Scribble a closed squiggle and hold: it stays as drawn.
12. **Undo.** Undo after a shape: the whole stroke goes.

## Draw and hold (highlighter)
13. **Shapes, not filled.** With the Highlighter, draw and hold a rectangle and a circle: they snap, drawn see-through like a highlight, with no fill inside.
14. **Straight highlight.** Draw an open highlight and hold: it becomes a straight highlight.

## With other tools
15. **Select.** Pick a level rectangle or circle made by holding: its handles resize it. Pick an angled one: it moves, recolours and deletes (no handles).
16. **Eraser.** Rub over a held shape: it goes. Tap inside a pen-held shape with the eraser: its fill comes off.
17. **PDF and backup.** Export: the shapes are in the PDF as drawn on screen. Back up and import: they come back.

## Follow-up (2026-10-07): resizing after the snap
18. **Bigger.** Draw a circle and hold until it snaps, then (still pressing) drag away from its middle: it grows, staying round. Lift: it's saved that size.
19. **Smaller.** Do the same with a rectangle, dragging in towards its middle: it shrinks, keeping its shape and angle.
20. **Highlighter.** Do 18 with the highlighter: it grows too, still without fill.
