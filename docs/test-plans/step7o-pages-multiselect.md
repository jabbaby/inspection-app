# Manual test plan: Step 7o – Pages view and items multi-select

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it). Existing drawings and pins should all still be there after the update.
- Use an inspection with two drawings (several pages) and a few pins.

## Pages view
1. **Open it.** Tap the page button on the right ("Page / 1 of N"): a sheet shows every page as a thumbnail, numbered through the document, with the drawing's name under its first page. The page you were on is outlined; pages with pins show a red "N pins" badge.
2. **Go to a page.** Tap a thumbnail: the sheet closes and the drawing is at that page.
3. **Duplicate.** Tap a page's **⌄** then **Duplicate**: a copy appears right after it, without pins. Pins on later pages stay on their sheets (check one), and the page count goes up by one.
4. **Hide.** On a page without pins, **⌄** then **Hide**: it moves to **Hidden pages** at the bottom; the document and page count skip it.
5. **Pinned pages.** On a page with pins, **⌄** shows **Hide (has pins)**, greyed out.
6. **Restore.** Under Hidden pages, tap **Restore**: the page comes back in its place.
7. **Select mode.** Tap **Select**, tick two pages, tap **Hide 2 pages**. Tick one and tap **Duplicate**. **Select all / Select none** work.
8. **Hide unmarked pages.** In Select mode, **Hide unmarked pages (N)**: only pages with pins are left in the document.
9. **Add drawings.** Tap the **+** tile and choose a PDF: its pages appear at the end.
10. **From Pre-inspection.** On Pre-inspection, the Drawings card has **Pages** beside **Start the inspection**: it opens the Inspection step with the Pages view open. **Close** leaves you on the drawing.
11. **Drawings card counts.** The card shows each drawing's visible pages, with "(N hidden)" when some are hidden.
12. **Thumbnails load.** In a long document, thumbnails draw as you scroll the sheet (no long freeze when it opens).

## Items multi-select
13. **Select.** Open **Items**, tap **Select**: rows get tick boxes; tap rows to tick them; the title shows "N selected". Swipe and drag don't act while selecting.
14. **Switch kind.** Tick two instructions, tap **Make observations**: both turn blue and move to Observations, re-lettered. Undo once switches both back.
15. **Photo confirmation.** Tick instructions and tap **Photo confirmation on**; open one: the switch is on. **Photo confirmation off** turns it off again; each is one Undo.
16. **Delete.** Tick two items, **Delete 2**: both go. Undo once brings both back with their text and photos.
17. **Done.** **Done** leaves Select mode.

## Issues found
-
