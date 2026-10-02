# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- Offline-first iPad PWA for a structural engineer's site inspections (Northrop). Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/jabbaby/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://jabbaby.github.io/inspection-app/
- Stack: React + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v8), pdfjs-dist (viewer and memo preview), pdf-lib (memo PDF, export), Vitest, Playwright (iPad viewport; WebKit, plus Chromium for @offline tests).
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a fresh build. Then poll CI and confirm the deploy. Never push with failing or skipped checks.
- For anything non-trivial: short plan first, wait for approval. Small focused commits, each one buildable.
- Ask before guessing report wording or engineering content.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device).

STATUS (SPEC section 13 build steps)
- Done and iPad-verified: steps 1 to 6 (scaffold, Spike A memo PDF, Spike B viewer, inspections, drawings and lettered items with all step 5 revisions, photos including general photos).
- Step 7 (memo editor and prefilled messages) is built and live (commit 1daf797) but not yet iPad-tested: docs/test-plans/step7-memo.md.
- Next: I want to tidy the memo editor's UI. I'll send a marked-up screenshot or typed notes. After that comes step 8: the full PDF export pack.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Letters: per kind (instructions A, B...; observations A, B...), in document order (drawing, page, then order on the page, which can be reordered in the Items tab). Re-lettered on add, delete, kind switch or reorder.
- Notes box per pinned page: black header, observations (blue), then instructions (red), Arial caps; default 15 mm from the top-right corner. Arrows from pins (several per pin), in the pin's colour.
- Viewer: native browser scrolling (120 Hz on iPad); the pinch previews as a CSS transform and lays out once on release; tapping the drawing closes the item editor.
- Undo/Redo (arrow icons in the drawings toolbar, per inspection, session only): pin add, item delete, reorder, arrow add/move/remove, photo add/delete.
- Photos: 1600 px JPEG 0.8 working copy, EXIF orientation applied by the browser. Camera originals are kept for "Save to iPad" (Share sheet, batches of 20, prepared before the tap). "Free up space" removes saved originals. General photos live on Inspection.photoIds.
- Memo: one per inspection with a SIM-NNN reference per job number. Job details are read from the inspection (never copied). Conditions: ticked standard conditions first ([letters] becomes e.g. A–D), then instructions. Salutation defaults to the first name of the first "To" recipient. The preview is the real PDF drawn with pdf.js.
- Step 8 appendix (agreed): A4, 4 photos per page; instructions, then observations, then General last. Each group is headed by the item label and text; photos are labelled IA1 / OA1 / G1 plus caption. Step 8 must also warn about re-lettering once a memo has been exported, and burn in pins, arrows and the notes box using the shared geometry (src/features/drawings/observationBox.ts, src/features/drawings/arrows.ts; Helvetica in the PDF).

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob (Playwright's WebKit on Windows can't store Blobs in IndexedDB).
- Local Playwright runs are capped at 3 workers. Mobile WebKit in Playwright has no mouse wheel, and its WebKit can't construct Touch objects: e2e pinch helpers dispatch Events with a plain `touches` array (e2e/helpers.ts).
- iOS Safari scrolls asynchronously: never set or read the scroll position every frame during a gesture (it caused jumpy pinch zoom). Read the live scroll position on pointer events.
- The viewer tracks pointers; lost pointerups are handled with page-wide listeners and an isPrimary reset (that fixed Add pin dying until restart).
- CSS grids sized by content overflow: use grid-template-columns: minmax(0, 1fr) (bit the photo viewer and the memo form).
- The Share sheet only opens straight from a tap: prepare files first.
- Vite only bundles new URL("literal", import.meta.url) when the path is written literally (see src/brand/northrop.ts).
- The browser preview pane in the desktop app often doesn't draw when hidden: requestAnimationFrame, scroll events and ResizeObserver stall until a screenshot is taken. Don't mistake that for app bugs.
- In the Bash tool, heredocs containing apostrophes fail. Write scripts to the scratchpad and run them, or use the Edit tool.
- Polling the GitHub Actions API unauthenticated is limited to 60 requests an hour: poll every 90 s.

OPEN ITEMS
- CI change still unanswered: run the deploy workflow in Playwright's official container image with timeout-minutes: 20 (the browser install once took over 10 minutes).
- Idea saved for later: lettered notes-box entries with no pin (general comments). Ask which page's box, whether instructions are allowed, and how they're lettered.
- Offered, not done: group the inspection home's Items list by page like the Items tab.
- Undo doesn't yet cover pin moves, notes box moves, kind switches or typing.
- Android/Windows tablets: native scrolling should work but is untested.

First, confirm you've read the files, summarise where things stand in a few lines, and wait for my markup or instructions.
