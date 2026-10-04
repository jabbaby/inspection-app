# Manual test plan: Step 7n – Snapshot pinch (smooth zoom)

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it). Check the version under Settings shows the new commit.
- Open an inspection with a real, busy drawing (A1 if you have one) that has a few pins, an arrow and the notes box.

## Steps
1. **Zoom in from fit.** Pinch to zoom in: smooth, with no jolt as your fingers land.
2. **Zoom out from zoomed in.** Zoom right in, lift, then pinch out: smooth? Compare with GoodNotes (reply: as smooth / nearly / still choppy).
3. **Small zooms in and out.** Zoomed in, several small pinches in and out, lifting between them: no stutter between pinches?
4. **While pinching.** The pins, arrows and notes box stay visible and on their spots while your fingers are down (pins shrink and grow with the picture, as before).
5. **Zooming out reveals.** Zoom out a long way: the area around the screen appears (a little soft), and beyond about three screens, plain background until you lift.
6. **After lifting.** The picture stays still while the pages sharpen (they may look soft for a moment, then crisp). No jump or flash when it swaps to the real pages.
7. **Scroll straight after.** Pinch, lift, and immediately swipe to scroll: it scrolls at once (no dead swipe).
8. **Tap straight after.** Pinch, lift, and tap the drawing: a pin is placed where you tapped.
9. **Optional recording.** If you have the Mac handy, record one more Timeline (Screenshots off, same moves) and save it as `perf-recordings/v3.json`.

## Issues found
-
