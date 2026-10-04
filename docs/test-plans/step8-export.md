# Manual test plan: Step 8 – PDF export pack

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with a memo, at least two drawings (one A1 or A3), pins on two or three pages (a mix of instructions and observations, one with an arrow), photos on a couple of items, one general photo, and one photo with a caption.

## Export card
1. **What it holds.** Site memo step, scroll to **Export**: it lists Memo (its SIM reference), Marked-up drawings ("N pages with pins") and Photo appendix ("N photos · N pages").
2. **Warnings.** Clear one item's text (or remove every "To" recipient): the card says so in an amber box. Export still works. Put the text back afterwards.
3. **Export.** Tap **Export PDF**: a progress bar names each step (memo, drawing pages, photos). It finishes with the file name (`job_SIM-NNN_item.pdf`), page count, size and time.
4. **Share.** Tap **Share…**: the Share sheet opens straight away. Save to Files (or AirDrop / Mail to yourself) to open it in the next steps.
5. **Preview.** Tap **Preview**: the PDF opens (in Safari's viewer or a new tab). Come back to the app.
6. **Offline.** Turn on Airplane mode, tap **Export again**: it still works. Turn Airplane mode off.

## The PDF
7. **Order.** Memo first, then only the drawing pages that have pins (in document order), then the photo appendix.
8. **Memo.** Matches the preview in the app.
9. **Drawing pages keep their size.** An A1 sheet is A1 and an A3 is A3 (Files > Get Info, or zoom in: the drawing stays sharp, it isn't a picture).
10. **Pins, arrows, notes box.** Each drawing page has its pins (red instructions, blue observations, white letters), arrows in the pin's colour, and the notes box where you dragged it, with the same wording and line breaks as in the app.
11. **Pin size.** Print a drawing page at 100% (or judge on screen): pins about 9.5 mm across on A1, 4.8 mm on A3.
12. **Duplicate and hidden pages.** Duplicate a page in the Pages view and put a pin on the copy; hide a page without pins. Export again: the copy is in the PDF as its own page, the hidden page isn't.
13. **Appendix.** A4 pages, up to 4 photos each: instructions A, B... first, then observations, then General. Each group is headed "Instruction A – its text"; photos are labelled Photo IA1, IA2... OA1... G1, with the caption after the label. A group that runs onto the next page repeats its heading with "(continued)".
14. **Page numbers.** Memo and appendix pages are numbered through the whole PDF (the appendix carries on after the drawing pages); drawing pages have no Northrop footer.
15. **Real drawings.** Export an inspection with a large real drawing set: note how long it takes and the file size (tell me roughly; no screenshots of real drawings).

## Letters changed after an export
16. **Notice in the viewer.** After exporting, go to Inspection and delete an instruction that has a letter before another one (e.g. A when there is a B). A dark notice appears at the top: "Letters changed after the memo was exported…". Tap it: it goes. Delete another item: it doesn't come back (once per export).
17. **Export card.** Back on Site memo, the card says "Letters changed since the export on…" and lists the changes (e.g. "Instruction A was deleted; Instruction B is now Instruction A").
18. **Export again clears it.** Tap **Export PDF**: the warning goes.
19. **Undo.** Export, delete an item, then Undo: the warning on the card goes (letters are back as exported).
