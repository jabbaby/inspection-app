# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- Offline-first iPad PWA for a structural engineer's site inspections (Northrop). Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/jabbaby/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://jabbaby.github.io/inspection-app/
- Stack: React 19 + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v11), pdfjs-dist (viewer, thumbnails, memo preview, dashboard thumbnail), pdf-lib (memo PDF, export), lucide-react (icons, bundled), Vitest, Playwright (iPad Pro 11 viewport; WebKit, plus Chromium for @offline tests).
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- A dev server config exists in .claude/launch.json ("dev", port 5173; "preview", port 4174).
- The app shows its version as "Version 0.1.0 (<commit>)" at the bottom of the Dashboard and in Settings; the commit is what identifies a build.

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a FRESH build (see the stale-server gotcha). Then poll CI and confirm the deploy. Never push with failing or skipped checks. If I say "don't push yet", keep changes local until I say so.
- For anything non-trivial: short plan first, wait for approval. For UI work, show a mockup first (I like reviewing them).
- Show me screenshots with the SendUserFile tool (images you only Read aren't visible to me).
- Small focused commits, each one buildable. Ask before guessing report wording or engineering content.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device). Don't paste real project screenshots into chat; performance recordings use the synthetic test drawing.
- I'm right-handed: all viewer controls (and future Pencil markup tools) live on the right edge; panels open on the left.

STATUS (SPEC section 13 build steps)
- Steps 1 to 7 are DONE and verified on my iPad (2026-10-04), including every step-7 follow-up (plans step7 to step7o): memo editor and prefilled messages, projects, UI overhaul and bento look, drawings flow, pin gestures, floating panels, smooth zoom, the Pages view and items multi-select.

- Step 8 (PDF export pack) is BUILT (2026-10-04), waiting for the iPad test (docs/test-plans/step8-export.md). Code in src/features/export: markupGeometry.ts (pin size, rotated/cropped pages, notes box layout), drawMarkup.ts, drawingPages.ts, appendixLayout.ts + renderAppendix.ts, packContents.ts (pure: what goes in, warnings; no pdf-lib so the memo screen stays light), buildPack.ts (pdf-lib, loaded on demand), packData.ts (loads from Dexie), exportedLetters.ts, ExportCard.tsx, ExportedLettersNotice.tsx. The memo renderer exposes writeMemo() and drawFooter() for the pack.

- Since step 8 (2026-10-05, all pushed, CI green, waiting for iPad tests): memo recipients up to 10; reorder drawings (Pre-inspection drag handles via src/app/useRowDrag.ts; Pages view menu + ReorderDrawingsDialog) and move pages within a drawing (src/db/pages.ts movePage; drawing order is still createdAt, swapped by reorderDrawings); Copy pin (Item.copies; src/features/items/spots.ts gives each pin a spot key "itemId" or "itemId~copyId"; the original decides the letter); step 9 inspection file and backups (src/db/backup.ts collect/import, src/features/backup: inspectionFile.ts zip via fflate, BackupCard, ImportInspection, BackupAll; Inspection.backedUpAt).
- iPad test plans waiting: docs/test-plans/step8-export.md, step8b-reorder-recipients.md, step8c-copy-pins.md, step9-backup.md.

NEXT (agreed order; plan + mockup each before building)
1. Fix anything from the waiting iPad tests.
2. Slice 2: the markup editor (freehand Pencil, shapes/clouds, arrows, text callouts) in its own mode so it doesn't clash with tap-to-pin; its tools go on the right. The export draws page extras in drawPageMarkup() (src/features/export/drawMarkup.ts) and the inspection file has schemaVersion 1: markup bumps it and must round-trip.
3. Step 10 hardening (offline tests, large drawings, storage limits).

HOW THE UI IS BUILT
- One stylesheet: src/app/styles.css. Tokens at the top: colours (--page warm grey, --surface, --surface-2, --sunken, --ink, --ink-strong maroon titles, --ink-muted, --line/--line-soft/--line-strong, --chrome* (rail), --selected charcoal, --accent red, --ok/--todo/--danger and -bg, --observation, --viewer-bg, --focus), spacing (--space-1..8), radius (--radius-sm 8 / --radius 12 / --radius-lg 18 / --radius-pill; tiles use 22px), type (--text-xs..2xl), --control 44px; a dark set under prefers-color-scheme: dark. Brand values only from src/brand/northrop.ts via applyBrandTokens() (assets: wordmarkRed, icon roundel). Drawing pages, the notes box, the memo preview and the signature pad stay white in both modes.
- Buttons: base rules use :where(button) (zero specificity) so component styles win; colour-only transitions; hover only under (hover: hover). Never add transform effects to buttons: pins and arrow handles are buttons positioned by transform. Variants: default soft pill, .primary (red, one per view), .emphasis (charcoal), .quiet, .danger-outline (red text), .danger (dialog confirm), .toggle-on, .icon-button. Shared pieces: .card/.tile, .eyebrow, .list-panel/.list-row, .empty-state, .chip, .checkbox.switch, .checkbox-mark, .pill-pair/.pill-check, .big-number.
- Shell (src/app/Shell.tsx): charcoal rail (roundel, nav "Main": Dashboard "/", Inspections (remembers the last place via src/app/sessionPlace.ts), Settings; NetStatus dot) and a screen header beside it. src/app/AppBar.tsx portals into the header slot (appBarSlot.ts). .shell-body reserves env(safe-area-inset-top) with a charcoal strip behind the iOS status bar. Back targets: src/app/backTarget.ts.
- Screens: Dashboard src/features/inspections/DashboardPage.tsx (DrawingThumb.tsx renders the busiest page's real PDF page). Inspections list InspectionsPage.tsx (Recent table with SwipeToDelete rows, Projects). Inspection header + steps InspectionTabs.tsx (routes via tabPath.ts). Pre-inspection InspectionHome.tsx (Drawings card: add, rename, delete drawings; **Pages** link opens the Inspection step with ?pages=1). Site memo src/features/memo/MemoScreen.tsx. Project page src/features/projects/ProjectPage.tsx. Settings src/features/settings/.
- Inspection step src/features/drawings/DocumentScreen.tsx: rounded .viewer-wrap tile; on the right edge .viewer-controls stacks the Page/Items pill (.viewer-side, page button aria-label "Pages" opens the Pages view; Items) above the tools pill (.viewer-tools: Add pin, camera, Undo, Redo, Fit page), both the same width. Panels (ItemSheet, ItemsPanel) float over the drawing (.drawing-body > .item-sheet): left in landscape, bottom in portrait (controls move to the top); the drawing never resizes. Scroll targets keep pins clear of a panel (DocumentViewer coveredBy).
- Pin gestures (DocumentViewer + DocumentScreen): tap = instruction pin (its editor opens after the 350 ms double-tap window; an open item or panel closes first); double-tap = observation (pin turns blue on the second press, opens on release; on an existing pin it switches kind); tap-hold 0.5 s then drag = pin with arrow (ring after 150 ms; the viewer cancels touchmove so it can't scroll); double-tap-and-hold = observation with arrow. Timing constants in src/features/drawings/document/gestures.ts. Add pin button kept as is (tap it, then tap the drawing).
- Zoom: src/features/drawings/document/pinchSnapshot.ts. A pinch draws a screen-sized snapshot (page canvases, arrows, notes boxes read from the DOM, pins; plus a softer copy 3 views wide) and scales only that; the document is laid out once under it on lift and the snapshot goes once pages have redrawn (max 1.5 s); any new touch removes it. This came from Safari Web Inspector recordings on my iPad: the cost was compositing huge zoomed layers, not JavaScript.
- Pages view src/features/drawings/PagesSheet.tsx (native <dialog>): thumbnails (lazy, IntersectionObserver), ⌄ menu (Go to, Duplicate, Hide; not pages with pins), Select mode (Hide N, Duplicate, Hide unmarked pages), Hidden pages with Restore, + tile adds drawings (src/features/drawings/drawingFiles.ts storePdf). Page ops in src/db/pages.ts (not undoable).
- Items panel src/features/items/ItemsPanel.tsx: swipe to delete, drag ≡ to reorder; Select mode with Delete / Make observations / Make instructions / Photo confirmation on/off (src/features/items/itemActions.ts, one undo each).
- Document geometry src/features/drawings/document/documentLayout.ts (PageLayout: page = position, source = PDF page, number = through the document; hidden pages skipped; documentPageNumbers()).
- e2e tests rely on accessible names and data-testids: navs "Main" and "Inspection sections"; lists "Recent inspections"/"Projects"/"Needs a project"/"Project inspections"; back links "Back to dashboard/inspections/project/inspection"; buttons "Add pin", "Pages", "Items", "Undo", "Redo", "Fit page"; dialog "Pages" with page-thumb buttons named "Page N: <drawing> page <source>" and "Page N options"; page-indicator (data-label "S-101 Level 3 · page 2 of 3", text "Page" + "N of M"); drawing-viewer, doc-page, viewer-pin, pinch-snapshot, item-sheet, items-panel, items-panel-row, snippet-row, save-state ids. Helpers in e2e/drawings.spec.ts: openDrawing (via the Pages view), openPages, addPinAt, threeItemsInPanel; e2e/helpers.ts: openTab (waits for aria-current), openInspectionsList, pinch.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Projects: job number, job name, client and address live on a Project shared by its inspections and memos. Inspections without a project are flagged "Needs a project"; no memo until they have one.
- Letters: per kind (instructions A, B...; observations A, B...), in document order (drawing, page position, then order on the page, reorderable in the Items panel). Re-lettered on add, delete, kind switch, reorder, or page duplication.
- Notes box per pinned page: black header, observations (blue), then instructions (red), Arial caps; default 15 mm from the top-right corner. Arrows from pins (several per pin), in the pin's colour.
- Pages: Drawing.pages { source, hidden? }; Item.page and ObservationBox.page are positions in it. Hidden pages leave the document, numbering and PDF pack; duplicates are copies of the same PDF page without pins.
- Undo/Redo (per inspection, session only): pin add (incl. its arrow), item delete (single or several), reorder, kind switch (single or several), photo confirmation (several), arrow add/move/remove, photo add/delete. Not: pin moves, notes box moves, typing, page operations.
- Photos: 1600 px JPEG 0.8 working copy; camera originals kept for "Save to iPad" (Share sheet, batches of 20); "Free up space" removes saved originals. General photos on Inspection.photoIds. Multi-shot camera: decided to keep the iPad's own camera (an in-app getUserMedia camera gives ~8 MP video frames; no library avoids that). A "Take another" button after each shot is the cheap option if wanted.
- Memo: one per inspection, SIM-NNN per job number. Conditions: ticked standard conditions first, then instructions. Preview is the real PDF via pdf.js.
- Step 8 (built): pages with pins only; pins 1.6% of the sheet's short side; footers numbered through the pack (drawing pages unstamped); a letter change after export shows a one-time viewer notice and a list on the Export card (no confirm). A4 photo appendix, 4 per page; instructions, observations, then General; groups headed by item label and text; photos labelled IA1 / OA1 / G1 plus caption. Warn about re-lettering once a memo has been exported. Burn in pins, arrows and the notes box with the shared geometry (src/features/drawings/observationBox.ts, arrows.ts; Helvetica in the PDF). Export button on the Site memo step. Hidden pages left out; each position exports its source PDF page (duplicates export twice).
- Status colours are app-only, never in the memo or PDF. The app follows the device's light/dark setting.

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob (Playwright's WebKit on Windows can't store Blobs in IndexedDB).
- Playwright reuses an existing server on port 4173 (reuseExistingServer): a leftover `vite preview` serves an OLD build. Before a gate run, check port 4173 (PowerShell Get-NetTCPConnection -LocalPort 4173) and stop any leftover preview.
- Navigation renders as a React transition: the URL changes before the screen does. e2e openTab waits for the tab's aria-current (a file set on the old screen's input was lost: that was the long-running "viewer never ready" flake). Likewise Done closes the item editor via a URL change a moment later; tests that tap right after Done should wait for the sheet to go.
- Throwaway screenshot specs live at e2e/zz-*.spec.ts, excluded from git via .git/info/exclude; never `git add e2e/*.spec.ts` with a glob. Playwright still runs them in the full suite.
- Don't edit e2e/ (or src/ before the build step) while a background gate is running: late workers load the edited spec.
- perf-recordings/ (git-excluded, Prettier-ignored) holds my Safari Web Inspector Timeline exports (JSON, ~160 MB). Recordings exported after a second take can contain the first one too: analyse only the new time range. Record with Screenshots off (it caps the frame rate at ~16 fps).
- Mobile WebKit in Playwright has no mouse wheel and can't construct Touch objects: pinch helpers dispatch Events with a plain `touches` array (no changedTouches: handlers must not assume it).
- iOS Safari scrolls asynchronously: never set or read the scroll position every frame during a gesture. Read the live scroll position on pointer events.
- The React Compiler lint (react-hooks/purity) flags performance.now() inside some handlers: use the module-level helpers (msSince in DocumentViewer, msUntil in DocumentScreen).
- erasableSyntaxOnly is on: no TypeScript constructor parameter properties.
- CSS grids sized by content overflow the page: use grid-template-columns: minmax(0, 1fr). After layout changes, check every screen in both orientations.
- Don't use display: grid on <details> (unreliable in Safari). A background shorthand on fields wipes the select arrow: use background-color.
- The Share sheet only opens straight from a tap: prepare files first.
- Vite only bundles new URL("literal", import.meta.url) when the path is written literally (see src/brand/northrop.ts).
- The desktop app's browser pane often doesn't draw when hidden. For screenshots use a throwaway Playwright spec with page.screenshot, then send the PNGs with SendUserFile.
- In the Bash tool, heredocs containing apostrophes or non-ASCII (e.g. "·") fail: write Python edit scripts to the scratchpad with the Write tool (open files with newline="" so CRLF isn't introduced; assert each match). Foreground sleep is blocked: wait for long runs with run_in_background.
- Polling the GitHub Actions API unauthenticated is limited to 60 requests an hour: poll every 90 s and handle rate-limit errors. gh isn't installed; failed-run details are readable without auth from /repos/jabbaby/inspection-app/check-runs/{job_id}/annotations.
- Reorderable rows must keep equal heights (ItemsPanel compares row midpoints).
- Lint enforces react-refresh (component files export only components; helpers and constants in their own .ts) and no setState directly in effects.

OPEN ITEMS
- CI change still unanswered: run the deploy workflow in Playwright's official container image with timeout-minutes: 20.
- A throwaway spec with a local scratch path (it includes my Windows username) is in the public repo's history (removed in 470a2f2). Rewriting history needs a force push; only if I ask.
- Ideas saved for later: lettered notes-box entries with no pin (general comments); a sort order for prefilled messages; a "Take another" button for photos; undo for pin moves, notes box moves and page operations; bumping the version number per milestone (e.g. 0.2.0).
- Android/Windows tablets: native scrolling should work but is untested.

First, confirm you've read the files and summarise where things stand in a few lines. Then show me the plan and a mockup for step 8 (the PDF export pack) before building.
