# Manual test plan: pinch zoom fix

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file). The 5h plan still applies (its step 6 highlight now updates when scrolling pauses).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).

## Steps
1. **Pinch in on a pin.** The zoom stays centred between your fingers, with no jumping or snapping back, and it's smooth while your fingers move.
2. **Let go.** The page stays exactly where it was and sharpens shortly after. Pins grow with the zoom while pinching, then return to their normal size.
3. **Pinch out** back to normal. Same: smooth, centred, no jump when you let go (unless you zoomed out past the page edge, when it settles back into place).
4. **Pinch and move.** Move both fingers while pinching: the drawing follows them.
5. **Several pinches in a row.** Zoom in, let go, zoom in further: each one continues from where the last finished.
6. **Scroll right after a pinch.** One-finger scrolling, momentum and Add pin all still work as before.
7. **Items highlight.** With Items open, scroll or zoom, then stop: the highlighted rows update a moment after you stop.
8. **Offline.** Airplane mode: pinching works the same. Turn airplane mode off.

## Feel (free text)
Compared with before the last update, and with GoodNotes.
