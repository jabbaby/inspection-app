# Manual test plan: Slice 2a – Markup toolbar, pen, highlighter, eraser

Device: iPad [model], iPadOS [version], Apple Pencil [model]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with a few pages of drawings and some pins. The synthetic test drawing is fine; use a real drawing too for steps 24 to 26.

## Toolbar and the Pin tool
1. **Toolbar.** The Inspection step has a white toolbar under the header: Pin, Pen, Highlighter, Eraser and the hand (Draw with finger). The icons are near-black. The right-edge pill no longer has Add pin.
2. **No tool on.** The drawings open with nothing selected. Tap, double-tap and hold the drawing with a finger and with the Pencil: no pins appear and nothing is drawn. One finger still scrolls and two still zoom.
3. **Tapping a pin with no tool on.** Tap an existing pin: it opens. Tap the drawing: it closes.
4. **Pin on.** Tap **Pin**: it turns red and the toolbar shows "Tap for an instruction · double-tap for an observation · hold and drag for an arrow".
5. **Pin gestures.** With Pin on, check that tap, double-tap, tap-hold-drag and double-tap-and-hold all behave as before. Pin stays on after each pin.
6. **Pin off.** Tap **Pin** again: it turns off and taps place nothing.

## Pen and highlighter
7. **Pen.** Tap **Pen**. Three weights and six colours appear after it. Draw with the Pencil: the line follows the tip with no lag and stays where you drew it when you lift.
8. **Finger scrolls while the pen is on.** With Pen on, one finger scrolls and two zoom; the Pencil never scrolls. Rest your palm on the screen while drawing: it doesn't draw or scroll.
9. **Drawing near pins.** Start a Pencil stroke right on a pin: it draws (the pin doesn't move). Tap the pin with a finger: it opens.
10. **Colour and weight.** Pick blue and **Thick**, then draw: the line is blue and thick. Tap **Thick** again: a slider opens. Drag it and draw: the weight follows.
11. **Remembered.** Switch to Highlighter and back to Pen: the pen is still blue and thick. Close and reopen the app: still blue and thick.
12. **Highlighter.** Tap **Highlighter**: it has its own colours (yellow, green, pink). Highlight over drawing lines and text: they show through. Two highlights crossing look darker where they overlap, but a single stroke never darkens where it crosses itself.
13. **Lines are under the pins.** Draw over a pin, its arrow and the notes box: the pin, arrow and notes box stay on top.
14. **Zoom.** Draw zoomed out, then zoom right in: the line stays sharp, keeps its place on the drawing and gets thicker with the drawing (it is sized to the sheet, like pin arrows). Draw zoomed in, then zoom out: the same.
15. **Pinch.** While pinching, the lines stay visible and move with the drawing (no flicker when the fingers lift).

## Palette
16. **All colours.** Tap **⌄**: the saved palette opens under it. Tap a colour: it's selected and the palette stays open.
17. **Add a colour.** Tap **+**: the iPad colour picker opens. Pick a colour and close the picker: it's added once (not once per drag in the picker) and selected.
18. **Remove a colour.** Hold a colour for about half a second: it's removed. The tap that follows doesn't select anything else by mistake.
19. **Closing.** Tap anywhere else: the palette closes.

## Eraser and undo
20. **Eraser.** Tap **Eraser**. Rub the Pencil over two lines: both disappear as you pass over them, and touching a line removes the whole line. Pins aren't affected.
21. **Undo and Redo.** Undo brings both erased lines back in one step. Undo again removes the last line drawn. Redo puts it back.

## Draw with finger
22. **Finger toggle.** Tap the hand: it shows on. With Pen on, one finger now draws and two fingers scroll and zoom. Tell me how the two-finger scroll feels: it has no iOS momentum.
23. **Finger toggle off.** Tap the hand again: one finger scrolls again. Close and reopen the app: the toggle is as you left it.

## Pages, export and backup
24. **Hiding.** In the Pages view, a page with lines but no pins can't be hidden ("Hide (has markup)"), and **Hide unmarked pages** leaves it alone.
25. **Moving and duplicating.** Duplicate a page with markup: the copy is clean, and lines on later pages stay on their pages. Move a page with markup: its lines go with it.
26. **PDF pack.** Export the PDF pack. The lines and highlights are on the drawing pages in the same places and weights as on screen, under the pins and notes box. A page with only markup (no pins) is in the pack, without a notes box. Highlights are see-through over the drawing lines.
27. **Backup.** Back up the inspection, delete it and import the file: all the markup comes back. Import an older backup made before this update: it still imports.

## Speed (real drawing)
28. **Big sheet.** On a large real A1 drawing, zoom right in and draw for a while: is the line still smooth at the Pencil tip? If not, a Safari Timeline recording on the synthetic drawing would help (Screenshots off).

## Follow-up (2026-10-06): colour slots and a centred toolbar
29. **Reset.** After updating, the pen has its six starting colours again (red, blue, black, green, orange, purple) and the highlighter its three.
30. **Centred.** With no tool on, the tools sit in the middle of the bar. Tap Pen: the row grows and stays centred. Tap Pen again: it shrinks back to the middle.
31. **Chosen colour.** Tap blue: a small ⌄ shows inside it. Tap blue again: the **Pen colour** panel opens under it.
32. **Recolour.** In the panel, tap a preset colour: the blue slot becomes that colour (no new slot). Tap **Custom…** and drag around the picker: only that slot changes, live, and no colours are added.
33. **Add colour.** Tap **Add colour**: a new slot appears at the end of the row and is chosen; the slot you were on keeps its colour. Pick a colour for the new one.
34. **Remove.** With a slot chosen, open its panel and tap **Remove**: it goes and its neighbour is chosen. With one slot left, Remove isn't offered.
35. **Highlighter.** The highlighter's slots work the same way, with lighter preset colours, and don't affect the pen's.
36. **Remembered.** Close and reopen the app: the slots and the chosen one are as you left them.

## Follow-up (2026-10-06): PDF strokes and the photo note
37. **No white nicks.** Draw a few curly pen and highlighter lines, export the PDF pack and open it (Safari, Files): the lines are solid, with no white semicircles along them. Zoom into the PDF too.
38. **Photo note.** Give instruction A photo confirmation. On the Site memo step, A shows "+ (provide photos confirming completion before proceeding)" under it, and the preview and exported PDF read "A. … (provide photos confirming completion before proceeding)". Instructions without it have no note.
39. **Photo condition.** "Confirm completion of items via photos prior to proceeding." is no longer ticked by itself; tick it by hand and it appears in the memo as before.
40. **Rewording.** Reword A for the memo: the note still follows the reworded text.
41. **Settings.** Settings, prefilled messages, has a **Photo confirmation note** (one, no Add or Delete). Change its wording: the memo follows. Empty it: no note in the memo.

## Follow-up (2026-10-06): drawing feel, scrolling and zoom
42. **Drawing feel.** Draw quickly with the Pencil: the line sits on the tip with no drag. When you lift, the line evens out very slightly (no jump).
43. **Scrolling with markup.** Scroll through pages with lines and highlights: they appear as fast as pages without.
44. **Sharp when zoomed.** Zoom right in on a page with markup: the drawing and the lines sharpen (not blurry), on every page you try.
45. **Quick preview.** Zoom into a new area: within a moment it looks nearly sharp, then fully sharp a little after.
46. **Back to where you were.** Zoom in on an area, zoom out to find your place, then zoom back into the same area: it's sharp straight away, with no pause.
47. **Small scrolls.** Zoomed in, scroll a little way: it stays sharp (the sharp area reaches a bit past the screen).
48. **Long session.** Work zoomed in across several pages for a few minutes: nothing turns blurry and stays blurry. If it does, tell me the page and what you did just before.
