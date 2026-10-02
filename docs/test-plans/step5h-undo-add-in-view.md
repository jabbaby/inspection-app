# Manual test plan: undo adding a pin, items in view

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file). The 5f and 5g plans still apply.

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).

## Steps
1. **Undo an add.** Add a pin and type some text. Tap Undo: the pin goes (and the page's notes box, if it was the first pin there).
2. **Redo an add.** Tap Redo: the pin is back with its text and letter.
3. **Mixed history.** Add pins A and B, delete A, then tap Undo three times: A comes back, then B goes, then A goes, in that order. Redo three times replays it forward.
4. **Letters stay consistent.** While undoing and redoing, the pins, notes box and Items list always agree on the letters, with no gaps.
5. **Highlight in view.** With pins on several pages, open Items: rows for the pins you can see now are highlighted (cream with a maroon edge on the left); the others aren't.
6. **Scroll.** Scroll to another page: the highlight moves to that page's items.
7. **Zoom.** Zoom in on one pin: only the rows for pins still on screen stay highlighted.
8. **Offline.** Airplane mode: all of the above still works. Turn airplane mode off.

## Feel (free text)
Is the highlight easy to see without being distracting?
