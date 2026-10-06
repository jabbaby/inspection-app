# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- Offline-first iPad PWA for a structural engineer's site inspections (Northrop). Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/jabbaby/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://jabbaby.github.io/inspection-app/
- Stack: React 19 + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v12), pdfjs-dist (viewer, thumbnails, memo preview, dashboard thumbnail), pdf-lib (memo PDF, export), lucide-react (icons, bundled), Vitest, Playwright (iPad Pro 11 viewport; WebKit, plus Chromium for @offline tests).
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- A dev server config exists in .claude/launch.json ("dev", port 5173; "preview", port 4174).
- The app shows its version as "Version 0.1.0 (<commit>)" at the bottom of the Dashboard and in Settings; the commit is what identifies a build.

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a FRESH build (see the stale-server gotcha). Then poll CI and confirm the deploy (and that the live bundle contains the commit). Never push with failing or skipped checks; a flaky e2e test means rerun the full suite until it's clean. If I say "don't push yet", keep changes local until I say so.
- For anything non-trivial: short plan first, wait for approval. For UI work, show a mockup first (I like reviewing them). Ask before guessing tool behaviour, report wording or engineering content.
- Show me screenshots with the SendUserFile tool (images you only Read aren't visible to me).
- Small focused commits, each one buildable.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device). Don't paste real project screenshots into chat; performance recordings use the synthetic test drawing.
- I'm right-handed: viewer controls live on the right edge; panels open on the left. Exception (my choice): the markup tools are a GoodNotes-style toolbar across the top.
- I don't have a Mac at the moment, so no Safari Web Inspector recordings. Don't keep guessing at iPad-only rendering or performance problems: ask me for what I see, or build a way to see it (see OPEN ITEMS).

STATUS (SPEC section 13 build steps, and slice 2)
- Steps 1 to 9 are DONE and verified on my iPad (by 2026-10-05): inspections and projects, drawings viewer with pins, photos, memo editor, PDF export pack, inspection file and backups.
- Slice 2 markup (SPEC 5a), all pushed:
  - 2a (toolbar, Pin tool, pen, highlighter, eraser, Draw with finger, colour slots, weights, undo, export, inspection file schemaVersion 2) and 2b (shapes) are DONE and iPad-verified (2026-10-06).
  - 2c text callouts is BUILT (2026-10-06, last commit 91e22b6 plus "Callouts behave like pins"); iPad plan docs/test-plans/slice2c-text.md (steps 1 to 25) waiting.
  - The photo-confirmation note on instructions in the memo (photoNote snippet) is built and pushed; covered by steps 37 to 41 of docs/test-plans/slice2a-markup.md.

NEXT (agreed order; plan + mockup each before building)
1. Fix anything from the 2c iPad test.
2. Slice 2d Select: pick marks (tap one, or loop round several) to move, delete, recolour or change weight; resizing shapes (on my later list). Plan and questions first.
3. The features and limitations PDF (see OPEN ITEMS).
4. Step 10 hardening (offline tests, large drawings, storage limits), including the markup scrolling/zoom problem below.

HOW THE UI IS BUILT
- One stylesheet: src/app/styles.css. Tokens at the top: colours (--page warm grey, --surface, --surface-2, --sunken, --ink, --ink-strong maroon titles, --ink-muted, --line/--line-soft/--line-strong, --chrome* (rail), --selected charcoal, --accent red, --ok/--todo/--danger and -bg, --observation, --viewer-bg, --focus), spacing (--space-1..8), radius (--radius-sm 8 / --radius 12 / --radius-lg 18 / --radius-pill; tiles use 22px), type (--text-xs..2xl), --control 44px; a dark set under prefers-color-scheme: dark. Brand values only from src/brand/northrop.ts via applyBrandTokens() (assets: wordmarkRed, icon roundel). Drawing pages, the notes box, the memo preview and the signature pad stay white in both modes.
- Buttons: base rules use :where(button) (zero specificity) so component styles win; colour-only transitions; hover only under (hover: hover). Never add transform effects to buttons: pins and arrow handles are buttons positioned by transform. Variants: default soft pill, .primary (red, one per view), .emphasis (charcoal), .quiet, .danger-outline (red text), .danger (dialog confirm), .toggle-on, .icon-button. Shared pieces: .card/.tile, .eyebrow, .list-panel/.list-row, .empty-state, .chip, .checkbox.switch, .checkbox-mark, .pill-pair/.pill-check, .big-number.
- Shell (src/app/Shell.tsx): charcoal rail (roundel, nav "Main": Dashboard "/", Inspections (remembers the last place via src/app/sessionPlace.ts), Settings; NetStatus dot) and a screen header beside it. src/app/AppBar.tsx portals into the header slot (appBarSlot.ts). .shell-body reserves env(safe-area-inset-top) with a charcoal strip behind the iOS status bar. Back targets: src/app/backTarget.ts.
- Screens: Dashboard src/features/inspections/DashboardPage.tsx (DrawingThumb.tsx renders the busiest page's real PDF page). Inspections list InspectionsPage.tsx (Recent table with SwipeToDelete rows, Projects). Inspection header + steps InspectionTabs.tsx (routes via tabPath.ts). Pre-inspection InspectionHome.tsx (Drawings card; Backup card). Site memo src/features/memo/MemoScreen.tsx (Export card). Project page src/features/projects/ProjectPage.tsx. Settings src/features/settings/ (My details, prefilled messages incl. the single Photo confirmation note, Drawing (Pencil prediction switch), Storage and backup).
- Inspection step src/features/drawings/DocumentScreen.tsx: the markup toolbar (MarkupToolbar) under the header, then the rounded .viewer-wrap tile. On the right edge .viewer-controls stacks the Page/Items pill (.viewer-side, page button aria-label "Pages" opens the Pages view; Items) above the tools pill (.viewer-tools: camera, Undo, Redo, Fit page). Panels (ItemSheet, ItemsPanel) float over the drawing (.drawing-body > .item-sheet): left in landscape, bottom in portrait; the drawing never resizes.
- Markup (slice 2, src/features/markup):
  - MarkupToolbar.tsx: full-width bar, row centred; buttons in order Pin, Pen, Eraser, Highlighter, Line, Arrow, Rectangle, Ellipse, Revision cloud, Text, Draw with finger; every tool a toggle; drawings open with no tool. Pen/highlighter/shapes show Thin/Medium/Thick, Text shows Small/Medium/Large (S M L); then the tool's colour slots ("Colour #RRGGBB"; the chosen one shows a chevron and tapping it again opens the "<Tool> colour" panel: presets "Use #...", Custom..., Add colour (appends and selects), Remove). Fits in portrait exactly (762 px).
  - markupPrefs.ts (localStorage, UI prefs only): palettes per row (pen row shared by pen, shapes and text; highlighter row), selected slot and weight per tool (pen, highlighter, shapes, text), the shape in use, fingerDraw, predict.
  - markGeometry.ts: weights as a fraction of the sheet's short side (pen medium = a pin arrow's line); strokes = exact Pencil points as straight segments, thinned (points closer than a third of the line width dropped: this fixed Apple's white crescents) and lightly smoothed after lift (smoothLifted); shapes (shapeDrawing: arrowheads 7 line-widths, cloud bumps 10 line-widths, closed shapes fill at 10% unless fill false); drawMark/isFilled/insideMark/touchesMark. Path data never uses SVG Q (pdf-lib turns it into a different curve): use C.
  - calloutGeometry.ts: text callouts (points = box x, y, w, h then optional tip; weight = text size; text in Markup.text, capitals), wrapping, layout, leader as thick as the box border. measureText.ts: Arial widths via canvas (Helvetica in the PDF matches).
  - MarkupOverlay.tsx (SVG per page, data-testid "mark" groups with data-tool/data-colour/data-filled; drawn under arrows, notes box and pins), CalloutsOverlay.tsx (callouts: data-testid "callout" with aria-label = text, "callout-box", "callout-tip"; behave like pins: tap to edit, drag to move or re-point, with any tool; the editor textarea "Callout text" is laid out at 16 px or more and scaled down because iOS zooms into smaller inputs), markupActions.ts (undo: draw, erase, unfill, change).
  - DocumentViewer: ink tools (pen, highlighter, shapes, eraser, and text placement) take pen/mouse (and touch with fingerDraw) in onPointerDownCapture; the live stroke goes on canvas .viewer-ink (hidden and freed when not drawing); pen draw-and-hold (500 ms still) straightens into a line; the eraser tap inside a filled shape takes the fill off; pin gestures only when tool === "pin" (addPinMode means placing an arrow or copy).
  - db: Markup table (src/db/markups.ts: add, delete, restore, update, setMarkupFill); page ops carry markup; pages with markup can't be hidden; export draws markup first and includes markup-only pages.
- Pin gestures (only while the Pin tool is on): tap = instruction pin (editor opens after the 350 ms double-tap window); double-tap = observation (or switch kind); tap-hold 0.5 s then drag = pin with arrow; double-tap-and-hold = observation with arrow. Timing in src/features/drawings/document/gestures.ts.
- Zoom: src/features/drawings/document/pinchSnapshot.ts (screen-sized snapshot scaled during a pinch, document laid out once on lift; draws marks and callouts too). DocPage renders a fit-quality base canvas and one sharp tile for the visible part (12 MP / pages on screen).
- Pages view src/features/drawings/PagesSheet.tsx; Items panel src/features/items/ItemsPanel.tsx; document geometry src/features/drawings/document/documentLayout.ts.
- e2e relies on accessible names and data-testids (see existing specs). Helpers: e2e/drawings.spec.ts openDrawing (turns the Pin tool on unless passed false), openPages, addPinAt, drawLine; e2e/helpers.ts openTab, openInspectionsList, pinch, pinToolOn, touchTap, stageBox.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Projects hold job number, job name, client and address; inspections without one are "Needs a project" (no memo until assigned).
- Letters per kind in document order; re-lettered on add, delete, kind switch, reorder or page duplication.
- Notes box per pinned page; arrows from pins; pages can be hidden, duplicated and moved.
- Undo/Redo (per inspection, session only) covers pins, deletes, reorders, kind switches, photo confirmation, arrows, photos, and all markup (draw, erase, fill off, callout edit/move). Not: pin moves, notes box moves, typing in items, page operations.
- Memo: one per inspection, SIM-NNN per job; standard conditions then instructions; an instruction needing photo confirmation ends with the Photo confirmation note "(provide photos confirming completion before proceeding)" (editable in Settings; the general photo condition no longer ticks itself).
- Export pack: memo, pages with pins or markup (markup drawn as vector, highlights multiplied), photo appendix.
- Moving data between devices: no sync; per-inspection backup files (schemaVersion 2 with markup; version 1 still imports).

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob.
- Playwright reuses an existing server on port 4173: a leftover `vite preview` serves an OLD build, and a hung run can leave node processes idle (near-zero CPU) holding it. Check port 4173 (PowerShell Get-NetTCPConnection -LocalPort 4173) and stop leftovers before a gate run.
- Navigation renders as a React transition: e2e openTab waits for aria-current; Done closes the item editor a moment later.
- Throwaway screenshot specs live at e2e/zz-*.spec.ts (git-excluded via .git/info/exclude) and DO run in the full suite: delete them when done (old ones broke when the UI changed).
- Don't edit e2e/ while a background gate is running.
- Known flaky e2e tests under full-suite load: "photo viewer: a quick flick changes photo" and occasionally "create a memo from the instructions". They pass alone; rerun the full suite for a clean run before pushing.
- Mobile WebKit in Playwright has no mouse wheel and can't construct Touch objects: pinch helpers dispatch Events with a plain `touches` array. A mouse counts as a drawing pointer for the ink tools.
- iOS Safari: scrolls asynchronously (never set/read scroll every frame mid-gesture); zooms into text inputs under 16 px; the Share sheet only opens straight from a tap; the viewer prevents default on mouse pointerdown, so a tap on the drawing doesn't blur inputs (close editors explicitly in tapDrawing).
- Painting marks into extra canvases made zoomed pages blurry on the iPad (unexplained; rolled back). Don't retry without device diagnostics.
- The React Compiler lint flags performance.now() inside some handlers: use module-level helpers (msSince in DocumentViewer, msUntil/nowMs in DocumentScreen).
- erasableSyntaxOnly is on: no TypeScript constructor parameter properties.
- CSS grids sized by content overflow: use minmax(0, 1fr). Check every screen in both orientations after layout changes. The base button rule sets min-height: --control: small buttons (swatches) need min-width/min-height 0.
- Don't use display: grid on <details> in Safari; use background-color (not the shorthand) on fields.
- Vite only bundles new URL("literal", import.meta.url) with a literal path.
- The desktop app's browser pane often doesn't draw when hidden: for screenshots use a throwaway Playwright spec with page.screenshot, then SendUserFile.
- In the Bash tool, heredocs containing apostrophes or non-ASCII fail: write Python edit scripts to the scratchpad with the Write tool (newline="" to keep line endings; assert each match). Foreground sleep is blocked: use run_in_background for long runs.
- Starter prefilled messages are generated: edit docs/content/snippets.md and run npm run snippets:build (never edit src/content/snippets.json by hand). New single-message kinds are added once to devices seeded before them (src/db/seed.ts SINGLE_KINDS).
- CI runs in Playwright's Docker image (mcr.microsoft.com/playwright:v1.63.0-noble) with a 20-minute timeout; @playwright/test is pinned to 1.63.0: bump both together.
- Polling the GitHub Actions API unauthenticated: 60 requests an hour, poll every 90 s. gh isn't installed. Check the deployed bundle contains the commit.
- Reorderable rows must keep equal heights; lint enforces react-refresh (component files export only components) and no setState directly in effects.

OPEN ITEMS
- Markup performance (deferred by me): scrolling is slow on pages with a lot of markup (SVG marks repainted into every tile Safari scrolls in). Canvas-painted marks fixed scrolling but made zoom blurry on the iPad (cause unknown; rolled back 2026-10-06). Next attempt starts with an in-app diagnostics panel (sharp render scale vs wanted, render errors, canvas megapixels) I can screenshot. The Pencil feels less fluid than GoodNotes; native-level feel may not be reachable on the web. Pencil prediction is a Settings switch (off; I found either fine).
- Later list: free-form revision clouds; resizing shapes (with Select); lettered notes-box entries with no pin; a sort order for prefilled messages; a "Take another" photo button; undo for pin moves, notes box moves and page operations; bumping the version number per milestone (e.g. 0.2.0).
- Android/Windows tablets: untested.
- To do after slice 2: a PDF of everything the app does and its limitations, for the digital innovation team (Northrop branding, plan first). Limitations so far: no sync between devices (manual inspection files; profile/signature and empty projects don't transfer); data lives in one browser on one device and iOS can clear it (hence backups); one device at a time (Replace overwrites); SIM references can clash across devices; Android/Windows untested; the Share sheet needs a tap after preparing; large real drawings untested for speed and file size; scrolling slows on pages with a lot of markup; the Pencil feel isn't native-level.

First, confirm you've read the files and summarise where things stand in a few lines. Then ask me for my 2c iPad test results before starting slice 2d (Select), and bring a plan with questions for 2d.
