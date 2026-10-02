# Manual test plan: tap to close the editor, Add pin fix

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).

## Steps
1. **Tap away to close.** Open a pin, type something, then tap an empty part of the drawing: the editor closes.
2. **Text kept.** Tap the same pin straight away: your text is there. Try it quickly several times.
3. **Taps that don't close.** With the editor open, tapping another pin opens that one instead; dragging the drawing or pinching doesn't close it; tapping an arrow tip selects it.
4. **Add pin and Add arrow still win.** In Add pin mode a tap places a pin; in Add arrow mode a tap places the arrow (neither just closes the editor).
5. **The bug you hit.** Delete a pin, then Add pin and tap: a pin is placed first time. Repeat a few times, mixing in scrolling, pinching, swiping in the Items list and deleting.
6. **Stress it.** Tap and scroll around quickly while pages are sharpening, then use Add pin: it still works without restarting the app.
7. **Offline.** Airplane mode: all of the above still works. Turn airplane mode off.
