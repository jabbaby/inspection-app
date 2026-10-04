# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- Offline-first iPad PWA for a structural engineer's site inspections (Northrop). Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/jabbaby/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://jabbaby.github.io/inspection-app/
- Stack: React 19 + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v10), pdfjs-dist (viewer, memo preview, dashboard thumbnail), pdf-lib (memo PDF, export), lucide-react (icons, bundled), Vitest, Playwright (iPad Pro 11 viewport; WebKit, plus Chromium for @offline tests).
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- A dev server config exists in .claude/launch.json ("dev", port 5173; "preview", port 4174).

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a FRESH build (see the stale-server gotcha). Then poll CI and confirm the deploy. Never push with failing or skipped checks. If I say "don't push yet", keep changes local until I say so.
- For anything non-trivial: short plan first, wait for approval. For UI work, show a mockup first (I like reviewing them).
- Show me screenshots with the SendUserFile tool (images you only Read aren't visible to me).
- Small focused commits, each one buildable. Ask before guessing report wording or engineering content.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device).

STATUS (SPEC section 13 build steps)
- Done and iPad-verified: steps 1 to 6, step 7 (memo editor, prefilled messages) and its follow-ups up to the UI refresh with dark mode (plans step7 to step7f).
- Done, awaiting my iPad check: the UI overhaul and bento redesign (plans step7g-ui-overhaul.md, step7h-bento.md including steps 18–23, step7i-drawings-flow.md). That is: charcoal rail with Dashboard / Inspections / Settings; status-bar strip; bento Dashboard with a live drawing thumbnail; Inspections tab (search, Recent table with swipe-to-delete, Projects) that remembers where you were; back buttons that return where you came from; Drawings card on Pre-inspection; the drawings as one continuous document numbered "Page N of M" in a rounded tile, with a left tool pill and a right page/Items pill; tapping the drawing closes the open item, then the panel.

NEXT (agreed order; plan + mockup each before building)
1. Pins (decided 2026-10-04, see log):
   - Tap on the drawing = place an instruction pin and open it. If an item editor is open, the first tap only closes it (then the Items/Drawings panel, as now).
   - Double-tap an empty spot = observation pin. Implement as: the first tap places an instruction at once (no delay); a second tap within ~300 ms and ~30 px switches that new pin to observation (one undo step). Double-tapping an existing pin switches its kind.
   - Tap, hold ~0.5 s, then drag = place the pin at the press point and drag out an arrow; release sets the arrow tip on the same page. Hold without moving = just the pin. This needs the viewer to take over the touch after the hold (non-passive touchmove + preventDefault before scrolling starts) — must be tried on the real iPad.
   - Finger AND Apple Pencil place pins. One finger still scrolls, two pinch; a touch that stops a scroll never places a pin; tapping a pin opens it; dragging a pin moves it. Keep the Add pin button in the tool pill as a fallback. All undoable.
   - This reverses the 2026-10-01 decision "pins only via an Add pin button" — update SPEC section 5's gesture model and the log.
2. Page management:
   - A Pages view (from the right pill's page button, and from the Drawings card on Pre-inspection): thumbnails of every page, numbered through the document, with a badge/highlight on pages that have pins; Select mode; Hide (restorable, the original PDF is kept; hidden pages leave the document, the page count and the PDF pack), Duplicate (a copy right after the page), Restore; and "Hide unmarked pages (N)". Pages with pins can't be hidden until their items are removed.
   - Proposed data model (confirm before building): Drawing gets `pages: { source: number; hidden?: boolean }[]` (Dexie v11 migration from pageCount); Item.page and ObservationBox.page become positions in that list. Duplicating shifts later pins/boxes on that drawing and re-letters. Step 8 export uses `source` to pick the PDF page.
3. Step 8: the full PDF export pack (see "Step 8" under key decisions).
4. Step 9: inspection file export/import + backups (must carry the project).
5. Slice 2: the markup editor (freehand Pencil, shapes/clouds, arrows, text callouts) in its own mode so it doesn't clash with tap-to-pin. I asked when this comes; offered to move it earlier (then step 8 must export markup from the start) — ask me.

HOW THE UI IS BUILT
- One stylesheet: src/app/styles.css. Tokens at the top: colours (--page warm grey, --surface, --surface-2, --sunken, --ink, --ink-strong maroon titles, --ink-muted, --line/--line-soft/--line-strong, --chrome* (rail), --selected charcoal, --accent red, --ok/--todo/--danger and -bg, --observation, --viewer-bg, --focus), spacing (--space-1..8), radius (--radius-sm 8 / --radius 12 / --radius-lg 18 / --radius-pill; tiles use 22px), type (--text-xs..2xl), --control 44px; a dark set under prefers-color-scheme: dark. Brand values only from src/brand/northrop.ts via applyBrandTokens() (assets: wordmarkRed, icon roundel). Drawing pages, the notes box, the memo preview and the signature pad stay white in both modes.
- Buttons: base rules use :where(button) (zero specificity) so component styles win; colour-only transitions; hover only under (hover: hover). Never add transform effects to buttons: pins and arrow handles are buttons positioned by transform. Variants: default soft pill, .primary (red, one per view), .emphasis (charcoal), .quiet, .danger-outline (red text), .danger (dialog confirm), .toggle-on, .icon-button. Shared pieces: .card/.tile, .eyebrow, .list-panel/.list-row, .empty-state, .chip, .checkbox.switch, .pill-pair/.pill-check, .big-number.
- Shell (src/app/Shell.tsx): charcoal rail (roundel, nav "Main": Dashboard "/", Inspections (link remembers the last place in the area via src/app/sessionPlace.ts; inside the area it goes to "/inspections"), Settings; NetStatus dot) and a screen header beside it. src/app/AppBar.tsx portals into the header slot (appBarSlot.ts): <AppBar left centre right>, BackLink, BarTitle; the header hides (:empty) when unused. .shell-body reserves env(safe-area-inset-top) with a charcoal strip behind the iOS status bar. Back targets: src/app/backTarget.ts (rememberBack(key, path) where an inspection/project is opened; labels "Back to dashboard / inspections / project / inspection"; unknown → /inspections).
- Screens: Dashboard src/features/inspections/DashboardPage.tsx (tiles; DrawingThumb.tsx renders the Continue preview with pdf.js and redraws on resize). Inspections list InspectionsPage.tsx (Recent table, SwipeToDelete rows from src/app/SwipeToDelete.tsx, Projects; also exports InspectionCard for the project page). Shared bits: inspectionParts.tsx (NewInspectionButton, NewProjectButton, InspectionLink, InspectionAvatar, StatusChip); data helpers in homeData.ts (unit tested). Inspection header + steps InspectionTabs.tsx (routes via tabPath.ts). Pre-inspection InspectionHome.tsx (with DrawingsSection). Inspection step src/features/drawings/DocumentScreen.tsx: shell-main gets .flush; rounded .viewer-wrap tile; left .viewer-tools pill (Add pin, camera, undo, redo, fit); right .viewer-side pill (page button = Drawings panel, Items); side panel .item-sheet for ItemSheet / ItemsPanel / Drawings; remembers the page per inspection (sessionPlace "doc-page:<id>"). Document geometry src/features/drawings/document/documentLayout.ts (no labels; PageLayout.number counts through the document); DocumentViewer.tsx (native scroll, pinch, pins, onTapDrawing; current page = page a third of the way down the view). Site memo src/features/memo/MemoScreen.tsx. Project page src/features/projects/ProjectPage.tsx. Settings src/features/settings/.
- e2e tests rely on accessible names and data-testids: navs "Main" and "Inspection sections"; lists "Recent inspections"/"Projects"/"Needs a project"/"Project inspections"; back links "Back to dashboard"/"Back to inspections"/"Back to project"/"Back to inspection"; buttons "Add pin", "Drawings", "Items", "Undo", "Redo", "Fit page"; page-indicator (its data-label attribute holds "S-101 Level 3 · page 2 of 3"; its text is "Page N of M"); drawing-viewer, doc-page, viewer-pin, item-sheet, items-panel, items-panel-row, snippet-row, save-state ids. Helper openInspectionsList(page) in e2e/helpers.ts taps the rail tab twice if it first returns to a remembered place.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Projects: job number, job name, client and address live on a Project shared by its inspections and memos; inspections keep item inspected, date, inspector. Inspections without a project are flagged "Needs a project"; no memo until they have one. Duplicate job numbers are flagged. Delete project deletes its inspections after a confirm giving the count. Memo recipients become project contacts; "Add from contacts" offers them.
- Inspections are deleted from Pre-inspection or by swiping a Recent row (both ask first).
- Letters: per kind (instructions A, B...; observations A, B...), in document order (drawing, page, then order on the page, reorderable in the Items panel). Re-lettered on add, delete, kind switch or reorder.
- Notes box per pinned page: black header, observations (blue), then instructions (red), Arial caps; default 15 mm from the top-right corner. Arrows from pins (several per pin), in the pin's colour.
- Viewer: native browser scrolling (120 Hz on iPad); pinch previews as a CSS transform and lays out once on release; floating controls never move the drawing.
- Undo/Redo (per inspection, session only): pin add, item delete, reorder, arrow add/move/remove, photo add/delete.
- Photos: 1600 px JPEG 0.8 working copy; camera originals kept for "Save to iPad" (Share sheet, batches of 20, prepared before the tap); "Free up space" removes saved originals. General photos on Inspection.photoIds; Site memo shows all photos grouped as the appendix; the camera in the tool pill adds general photos.
- Memo: one per inspection, SIM-NNN per job number. Conditions: ticked standard conditions first ([letters] → e.g. A–D), then instructions. Salutation from the first "To" recipient. Signature printed 40 pt tall. Preview is the real PDF via pdf.js. Job details fold to a summary with Edit; To/Copy is one switch.
- Step 8 (agreed): A4 photo appendix, 4 per page; instructions, observations, then General; groups headed by item label and text; photos labelled IA1 / OA1 / G1 plus caption. Warn about re-lettering once a memo has been exported. Burn in pins, arrows and the notes box with the shared geometry (src/features/drawings/observationBox.ts, arrows.ts; Helvetica in the PDF). Export button on the Site memo step. Hidden pages (once page management exists) are left out.
- Status colours are app-only, never in the memo or PDF. The app follows the device's light/dark setting.

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob (Playwright's WebKit on Windows can't store Blobs in IndexedDB).
- Playwright reuses an existing server on port 4173 (reuseExistingServer), so a leftover `vite preview` from a stopped run serves an OLD build and tests lie. Before a gate run, check port 4173 (PowerShell Get-NetTCPConnection -LocalPort 4173) and stop any leftover preview process.
- Throwaway screenshot specs live at e2e/zz-*.spec.ts and are excluded from git via .git/info/exclude; never `git add e2e/*.spec.ts` with a glob without checking (one slipped into a commit once).
- Local Playwright runs use 3 workers; under load the memo preview can delay saves (memo save checks allow 15 s). A few tests are timing-sensitive (photo flick, memo preview, Items tab); rerun alone before calling it a regression, but real regressions do happen (layout changes move tap targets: tap the middle of a page, not the middle of the view).
- Mobile WebKit in Playwright has no mouse wheel and can't construct Touch objects: pinch helpers dispatch Events with a plain `touches` array (e2e/helpers.ts). Mouse drags on links start a native link drag: swipe rows prevent dragstart and set -webkit-user-drag: none.
- iOS Safari scrolls asynchronously: never set or read the scroll position every frame during a gesture. Read the live scroll position on pointer events. Lost pointerups are handled with page-wide listeners and an isPrimary reset.
- CSS grids sized by content overflow the page: use grid-template-columns: minmax(0, 1fr). After layout changes, check every screen in both orientations.
- Don't use display: grid on <details> (unreliable in Safari). A background shorthand on fields wipes the select arrow: use background-color.
- The Share sheet only opens straight from a tap: prepare files first.
- Vite only bundles new URL("literal", import.meta.url) when the path is written literally (see src/brand/northrop.ts).
- The desktop app's browser pane often doesn't draw when hidden. For screenshots use a throwaway Playwright spec with page.screenshot (colorScheme "dark" works), then send the PNGs with SendUserFile.
- In the Bash tool, heredocs containing apostrophes fail and foreground sleep is blocked. Write Python edit scripts to the scratchpad (open files with newline="" so CRLF isn't introduced; assert each match) and wait for long runs with run_in_background. Don't edit src/ or e2e/ while a background e2e run is going.
- Polling the GitHub Actions API unauthenticated is limited to 60 requests an hour: poll every 90 s, and handle rate-limit errors (a watcher once looped until its timeout). gh isn't installed; failed-run details are readable without auth from /repos/jabbaby/inspection-app/check-runs/{job_id}/annotations.
- Reorderable rows must keep equal heights (ItemsPanel compares row midpoints).
- Lint enforces react-refresh (component files export only components; helpers in their own .ts) and no setState directly in effects.

OPEN ITEMS
- CI change still unanswered: run the deploy workflow in Playwright's official container image with timeout-minutes: 20.
- A throwaway spec with a local scratch path (it includes my Windows username) is in the public repo's history (removed in 470a2f2). Rewriting history needs a force push; only if I ask.
- Idea saved for later: lettered notes-box entries with no pin (general comments).
- Prefilled messages are listed in stored-id order; a sort order could be added.
- Undo doesn't yet cover pin moves, notes box moves, kind switches or typing.
- Android/Windows tablets: native scrolling should work but is untested.

First, confirm you've read the files and summarise where things stand in a few lines. Then show me the plan and a mockup for the pins work (item 1 under NEXT) before building.
