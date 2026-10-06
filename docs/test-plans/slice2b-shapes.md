# Manual test plan: Slice 2b – Shapes

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with a drawing (the synthetic test drawing is fine).

## The shape buttons
1. **Buttons.** The toolbar has a button for each shape after the highlighter: line, arrow, rectangle, ellipse, cloud. Tap one: it turns on, with weights and colours like the pen.
2. **Toggle.** Tap another shape: it switches to that one. Tap the one that's on: it turns off.
3. **Fits.** In portrait, with a shape on, the whole toolbar fits across the screen (or scrolls sideways if not; tell me).

## Drawing shapes
4. **Cloud.** Tap the cloud and drag out a box with the Pencil: the cloud follows the Pencil as you drag and is drawn when you lift, filled lightly in its colour.
5. **Cloud bumps.** Draw clouds at **Thin** and **Thick**: thicker clouds have bigger bumps.
6. **Rectangle and ellipse.** Drag out each: both fill the box you dragged, lightly filled.
7. **Line.** Drag a line at any angle: it goes exactly where you point (no snapping to level).
8. **Arrow.** Drag an arrow: the head is at the end where you lifted. At **Thick** the head is bigger than at **Thin**.
9. **Tiny drag.** Tap the drawing with a shape on (no drag): nothing is drawn.
10. **Colours.** Shapes use the same colour row as the pen, but keep their own chosen colour and weight: change the shape colour, switch to Pen, and the pen's colour is unchanged.

## Fill and the eraser
11. **Take the fill off.** Tap **Eraser**, then tap inside a filled shape (away from its outline): the fill goes, the outline stays.
12. **Undo.** Undo brings the fill back.
13. **Erase a shape.** Rub the eraser over a shape's outline: the whole shape goes. Undo brings it back.

## Draw and hold (pen)
14. **Straighten.** With the **Pen**, draw a rough line and keep the Pencil still at the end for about half a second: it snaps into a straight line from where you started.
15. **Swing it.** Still holding, move the Pencil around: the line's end follows in any direction and stretches. Lift: it stays where you left it.
16. **Normal drawing.** Write or draw normally (without pausing): nothing straightens. Pausing briefly mid-stroke, then carrying on: tell me if it ever straightens when you didn't want it to.

## Export and backup
17. **PDF pack.** Export the PDF pack: every shape is in the same place, size and colour, with the light fill (or none where you took it off) and solid arrowheads.
18. **Backup.** Back up the inspection, delete it and import the file: the shapes (and taken-off fills) come back.
