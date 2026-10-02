# Manual test plan: native scrolling and separate letters

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file). This replaces the scrolling steps (1–10) of docs/test-plans/step5c-scroll-notes.md; its notes box steps (11–13) still apply.

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Use an inspection with **two or more drawings** (multi-page if possible) that already has a few instructions and observations from before this update.

## Letters
1. **Existing items after the update.** Instructions now run A, B, C… and observations separately A, B, C…, each in the order you placed them. Nothing is lost.
2. **Notes box.** NOTED FOR INFORMATION: A, B… then INSTRUCTIONS: A, B…, matching the pins on that page (red A is the instruction, blue A the observation).
3. **New pin.** It takes the next instruction letter.
4. **Switch an instruction to Observation** (e.g. instruction B of A, B, C). It becomes the observation with its creation-order letter; old instruction C becomes B. Switch it back: the letters return.
5. **Delete an observation.** Only the observations re-letter; instructions keep their letters.
6. **Items lists** (inspection home and the Items panel): observations first, then instructions; the item sheet heading says "Instruction A" or "Observation A".

## Scrolling
7. **Flick up and down with one finger.** It should feel like Safari or GoodNotes: smooth (120 Hz on an iPad Pro), real iOS momentum, and a bounce at the top and bottom.
8. **Sideways at normal zoom.** Drag sideways or diagonally: the document only moves up and down.
9. **Pinch to zoom in**, then drag in any direction: it pans freely, with momentum. Pages sharpen shortly after you stop.
10. **Pinch back out** to normal: sideways movement is locked again.
11. **Fast scroll through all drawings.** Pages may show white for a moment and then appear; scrolling itself never stutters. Note any page that stays blank.
12. **Touch while it's still rolling.** It stops. In Add pin mode, that touch doesn't place a pin; the next tap does.
13. **Tap a pin while rolling.** It just stops the scroll; tap again to open it.
14. **Drag a pin and the notes box.** They move, and the document doesn't scroll under your finger.
15. **Apple Pencil.** Drag with the Pencil on the drawing: the document doesn't scroll. In Add pin mode a Pencil tap places a pin.
16. **Items panel and Fit page.** Tapping an item scrolls to its pin; Fit page fits the current page.
17. **Portrait / rotation.** Rotate with the document open: it stays at fit width on the same page.
18. **Offline.** Airplane mode, force-quit, reopen: scrolling, zoom and letters work the same. Turn airplane mode off.

## Feel (free text)
How the scrolling compares with GoodNotes; how the pinch feels (smooth, or steppy); anything that jumps.
