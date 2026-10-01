# Manual test plan: Step 5 – drawings, pins and lettered items

Device: iPad [model], iPadOS [version], Safari, installed to home screen: yes/no
Build/commit: 
Tester / date: 

## Preconditions
- Latest build deployed; open the installed home-screen app and tap **Update now** if offered.
- Real drawings may be used (they stay on the device). Keep the originals elsewhere until backups arrive in step 9.
- Create an inspection with Job number, Job name, **Item inspected**, Inspector and Date filled in.

## Steps and expected results
| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Drawings > **Add drawings**, pick one or more PDFs from Files | Each appears with its file name, page count, "0 items" and size | | Largest file tried: __ MB |
| 2 | Add a file that isn't a PDF (or a damaged PDF) | A message says it couldn't be opened; nothing else breaks | | |
| 3 | **Rename** a drawing | New name shows in the list and on the drawing screen | | |
| 4 | Open a drawing | Opens fitted; pan and pinch feel as in Spike B | | Time to open: __ s |
| 5 | **Add pin**, tap a spot | Pin **A** appears exactly there (filled red); the item sheet opens with **Instruction** selected | | Keyboard pops up straight away? yes/no |
| 6 | Type an instruction, tick **Photo confirmation required** | "Saved" shows | | |
| 7 | Look at the top right of the page | Observations box shows `NORTHROP INSPECTION \| item inspected \| T. Surname \| DD/MM/YYYY` only | | |
| 8 | Add pin **B**, switch to **Observation**, type text | Pin turns white with red border; box gains "Noted for information:" and "B. …"; photo option disappears | | |
| 9 | Drag the observations box clear of detail; zoom in and out | Box moves smoothly and zooms with the drawing; text readable on A1/A3 | | Text size OK? |
| 10 | Drag a pin (finger, then Pencil) | Pin follows and stays where dropped | | |
| 11 | Tap a pin | Its sheet opens; **Done** closes it | | |
| 12 | Portrait: open a sheet for a pin near the bottom | Drawing doesn't jump or rezoom; pin stays visible above the sheet | | |
| 13 | Delete the latest item, then add a new pin | New pin gets the **next** letter (deleted letter not reused) | | |
| 14 | Delete every pin on a page | The observations box disappears from that page | | |
| 15 | Add pins on page 2 (and another drawing) | Letters continue across pages and drawings | | |
| 16 | Back on the inspection: **Items** list | All items in letter order with kind and drawing/page; tapping one opens that pin with its sheet | | |
| 17 | Force-quit and reopen; open the drawing again | All pins, text, kinds, flags and box positions are still there | | |
| 18 | **Delete** a drawing with items | Confirmation states how many items go; afterwards they are gone from the Items list | | |
| 19 | Apple Pencil on the drawing with Add pin off | Nothing happens (reserved for markup later) | | |

## Offline check
Airplane mode on, force-quit and reopen. Open an inspection, add the synthetic test drawing, add a pin with text, force-quit, reopen: it's all there. Turn airplane mode off.

## Feel (free text)
Observations box size and position defaults; pin size; item sheet layout in portrait and landscape.

## Issues found
-
