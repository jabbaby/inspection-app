# Manual test plan: Step 7g – UI overhaul

Device: iPad [model], iPadOS [version]
Build/commit:
Tester / date:

Reply with the step number and what you saw (no need to edit this file).

## Before you start
- Open the home-screen app and tap **Update now** if offered (or close and reopen it).
- Try each section in landscape and portrait, and once with the iPad in dark mode (Control Centre → Dark Mode).

## Look and top bar
1. **Top bar.** A charcoal bar with the red NORTHROP wordmark on the left and **Inspections | Settings** in the middle. The current one is filled. No red bar anywhere.
2. **Colours.** Warm grey background, white cards with fine lines. Red is only on the main button of each screen (e.g. New inspection, Add pin, Create memo) and on instruction pins.
3. **Offline.** Turn on Airplane mode: an amber **Offline** pill shows top right; everything still works. Turn it off: it goes back to a small cloud icon.

## Home
4. **Greeting.** Today's date and "Good morning/afternoon/evening, {first name}" (first name from Settings → My details; just "Good morning" if none).
5. **Continue where you left off.** The inspection you edited last, with its job, a three-part progress bar (Pre-inspection, Inspection, Site memo, green when done), counts of drawings, instructions, observations and photos, and a dark button for the next step (Add drawings / Open drawings / Create memo / Open memo / Assign a project). Tap it: the right step opens.
6. **Needs attention.** Inspections without a project (red) and inspections with items but no memo (amber) appear as small cards. Tapping one opens the step that fixes it.
7. **Recent inspections.** Rows grouped under **This week** and **Earlier**, each with its project badge, what was inspected, job, client, date and a status chip. No bin icon on the rows.
8. **Search.** Type in the search box: Recent narrows to matching inspections (by item inspected, job or client) and Projects narrows too; Continue and Needs attention hide while searching.
9. **Side column.** Projects (with **New project**, which asks for a job number and name and opens the new project), **This month** (inspections, memos and items created this month) and **Storage**. In portrait they sit below the main column.
10. **First run.** On a device with no inspections or projects (or after deleting them all), the home shows **Start your first inspection** with one button.

## Back buttons
11. **Project → inspection → back.** Home → a project → one of its inspections → the back arrow (top left): you return to the project, not home. Back again: home.
12. **Inspection → project → back.** On Pre-inspection, tap the project's name: its project page opens. Back: you return to that inspection's Pre-inspection.
13. **Steps.** Inside an inspection the three steps are a segmented control in the top bar, with a green tick on finished steps. Switching steps doesn't change where back goes.

## Pre-inspection
14. **Cards.** Landscape: the project card (badge, name, **Change project**, its shared fields) on the left; **This inspection** (item inspected, date, inspector) on the right, with a **Next: the drawings** card and a quiet red **Delete inspection** under it. Portrait: stacked.
15. **Saved.** Type in any field: "Saving…" then "Saved" shows top right in the bar.
16. **No project.** On an inspection with no project, the card shows **Needs a project** with **Create new project** and **Assign to project**.
17. **Delete.** Delete inspection still asks first, then goes home.

## Inspection (drawings)
18. **Whole screen.** The drawing fills everything under the top bar. A white chip at the top left shows the drawing and page; tap it to open the Drawings panel (tap again to close).
19. **Floating tools.** At the bottom: Items (with a count), Undo, Redo, Fit page, camera and **Add pin**. Pins, pinch zoom and scrolling work exactly as before; the drawing never jumps when the tools change (e.g. Add pin → "Tap the drawing…").
20. **Pins don't change colour.** Tap pins, drag them, pinch: they stay red/blue and in place (no grey pins, no sliding after a pinch).
21. **Item editor.** Landscape: a panel on the right; portrait: a sheet below. Sections: Instruction | Observation, the text, **Photo confirmation required before proceeding** as a switch, Photos (Take photo, Choose photos, Save to iPad, thumbnails), Arrows, then **Done** above a quiet red **Delete**.
22. **Items panel.** Rows in one list with dividers; rows whose pins are on screen have a faint tint and a dark left edge. Swipe left to delete and drag ≡ to reorder still work (try dragging the bottom row to the top).
23. **Drawings panel.** Drawings as rows with rename and delete; **Add synthetic test drawing** is a small grey button under the list.
24. **No drawings yet.** A new inspection's Inspection step shows Drawings with **Add drawings** and a short explanation.

## Site memo
25. **Create memo.** Before there's a memo: a centred card with **Create memo**, then Photos and Export cards.
26. **Memo cards.** The editor is a column of cards (memo and reference, recipients, visit, letter, conditions, sign-off) beside the live preview (below it in portrait). The save state shows top right in the bar.
27. **Job details.** They show as one summary line with **Edit job details**. Tap it: the fields open (still shared with Pre-inspection); **Done** folds them again.
28. **To / Copy.** Each recipient has a two-way **To | Copy** switch. Choosing one clears the other; Add from contacts still adds them as To (first) or Copy.
29. **Include signature.** It's a switch now; turning it off removes the signature from the preview.

## Settings and project page
30. **Settings.** Same cards as elsewhere, with soft grey icons; the section list (landscape) or row of sections (portrait) jumps to each card.
31. **Project page.** Back and the project name in the bar; cards for details, inspections (rows) and contacts; Delete project still asks first.

## Offline check
32. With Airplane mode on, close and reopen the app: home, an inspection's three steps, the drawings and the memo preview all work.

## Issues found
-
