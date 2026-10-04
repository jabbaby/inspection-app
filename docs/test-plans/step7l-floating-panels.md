# Manual test plan: Step 7l – Floating panels, double-tap order, narrow page pill

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Open an inspection with a drawing, on the Inspection step. Try landscape, then portrait.

## Steps
1. **Narrow pills.** The Page / Items pill is the same width as the tools pill below it. The page button reads "Page" over "1 of 3"; the Items count sits on the button's corner.
2. **Drawing stays put.** Note where a pin sits on screen, then open **Items**: the panel slides over the left of the drawing (bottom in portrait) and the drawing doesn't move or resize. Same for the page button (Drawings) and for tapping a pin.
3. **Portrait controls.** In portrait with a panel open, the pills move to the top of the right edge and aren't covered by the panel.
4. **Double-tap order.** Double-tap an empty spot: the pin turns blue as your second tap goes down, and the editor opens when you lift.
5. **Double-tap, ten times.** Double-tap ten empty spots (including near the left edge in landscape): each gives one blue pin. Note how many worked first time.
6. **Double-tap and hold.** Tap, then press again and hold: the pin turns blue at once, the ring fills, drag an arrow. The editor stays closed until you lift, then opens. Undo once removes the pin and arrow.
7. **Tap still opens.** A single tap: red pin at once, editor a moment later.
8. **Hold still works.** Press and hold (no tap first): red pin and arrow, editor on release.
9. **Items list still jumps.** In Items, tap an item: the drawing scrolls to its pin, visible beside the panel.

## Issues found
-
