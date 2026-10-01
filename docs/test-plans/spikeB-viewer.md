# Manual test plan: Spike B – drawing viewer, pan/zoom and pins

Device: iPad [model], iPadOS [version], Safari, installed to home screen: yes/no
Build/commit: 
Tester / date: 

## Preconditions
- Latest build deployed; open the installed home-screen app and tap **Update now** if offered.
- Settings > Drawing viewer (Spike B) > **Open drawing viewer**.
- Synthetic drawings only (company policy until IT approves). Pins in this spike are not saved.
- The grey line under the toolbar shows timings; please note the numbers in the table.

## Steps and expected results
| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Tap **Typical drawing** | A1 sheet appears fitted to the screen within a second or two; "1 / 3" shown | | opened in __ ms, first render __ ms |
| 2 | One finger: drag around | Drawing follows the finger smoothly, no lag or jumps | | |
| 3 | Two fingers: pinch in and out, and pinch while moving | Zooms around the point between your fingers; feels smooth (GoodNotes-like) | | |
| 4 | Zoom right in on small blue text and stop | Text blurs briefly, then turns sharp within about half a second | | sharp render __ ms |
| 5 | Make sure Safari itself never zooms the page or shows a text-selection callout | Only the drawing zooms; the toolbar stays the same size | | |
| 6 | With the Apple Pencil, draw on the drawing (Add pin off) | Nothing happens: no pins, no panning | | |
| 7 | Tap the drawing with a finger (Add pin off) | Nothing happens | | |
| 8 | Tap **Add pin** (button turns red), then tap a grid intersection with a finger | Pin **A** appears exactly on that spot; Add pin turns off | | |
| 9 | **Add pin**, then tap with the Apple Pencil | Pin **B** appears exactly under the Pencil tip | | |
| 10 | Zoom in a long way on pin A, then zoom out and pan | Pin stays on the same grid intersection at every zoom; pin size stays the same on screen | | |
| 11 | Drag pin A to another intersection (finger, then Pencil) | Pin follows and stays where dropped | | |
| 12 | **›** to page 2, add a pin, then **‹** back | Page 2 pin is **C** (letters continue); page 1 still shows A and B | | |
| 13 | Rotate the iPad | Drawing refits (if not zoomed) or stays put; pins stay on their spots | | |
| 14 | Tap **Heavy drawing** | Opens without the app reloading or crashing; pan/pinch still usable | | opened __ ms, first render __ ms, sharp __ ms |
| 15 | Heavy drawing: **›** to page 2 (raster underlay), zoom in | Image sharpens on zoom; no crash | | |
| 16 | **Open PDF…** and pick a PDF from Files (synthetic, or the memo PDF from Spike A) | Opens; sheet size shown in the grey line | | |

## Offline check
Airplane mode on, force-quit and reopen from the home screen. Settings > Open drawing viewer > Typical drawing: opens, pans, zooms and accepts pins. Turn airplane mode off.

## Feel (free text)
How does it compare to GoodNotes for panning and pinching? Anything that felt wrong (speed, zoom limits, pin size)?

## Issues found
-
