# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- **Northrop Hardhat** (renamed 2026-10-07 from "Site Inspection Companion"; "Hardhat" under the home-screen icon): an offline-first iPad PWA for a structural engineer's site inspections at Northrop. Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/nhardhat/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://nhardhat.github.io/inspection-app/
- Stack: React 19 + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v12), pdfjs-dist (viewer, thumbnails, memo preview, Dashboard thumbnail, the in-app PDF viewer), pdf-lib (memo PDF, export, the manual PDFs), lucide-react (icons, bundled), Vitest, Playwright (iPad Pro 11 viewport; WebKit, plus Chromium for @offline tests).
- Version 0.2.0 (package.json; bumped per milestone, with an entry in src/content/changelog.ts). The app shows "Version 0.2.0 (<commit>)" on the Dashboard, in Settings and in About; the commit identifies a build.
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- A dev server config exists in .claude/launch.json ("dev", port 5173; "preview", port 4174).

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a FRESH build (see the gotchas). Then poll CI and confirm the deploy (the live bundle contains the commit). Never push with failing or skipped checks; a flaky e2e test means rerun the full suite until it's clean. If I say "don't push yet", keep changes local.
- For anything non-trivial: short plan first, wait for approval. For UI work, show a mockup first (I like reviewing them). Ask before guessing tool behaviour, report wording or engineering content. I often answer questions by number, sometimes tersely: if an answer is ambiguous (e.g. which option), confirm rather than guess.
- Show me screenshots with the SendUserFile tool (images you only Read aren't visible to me).
- Small focused commits, each one buildable.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write or extend a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- When features or limitations change, update the documents too (see DOCUMENTS) and rebuild them.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device). Don't paste real project screenshots into chat.
- I'm right-handed: viewer controls on the right edge; panels open on the left. Exception (my choice): markup tools are a GoodNotes-style toolbar across the top.
- No Mac at the moment: no Safari Web Inspector recordings. Don't keep guessing at iPad-only rendering or performance problems: ask me what I see, or build a way to see it.

STATUS
- Steps 1 to 9 DONE and iPad-verified (2026-10-05). Slice 2 markup: 2a, 2b, 2c (including the rework: pin-style callouts, resize, dog legs) DONE and iPad-verified (2026-10-07).
- Built and live 2026-10-07, iPad test plans waiting (ask me for results first):
  - docs/test-plans/slice2d-select.md steps 1-34: Select, editing callouts from Select, rotation (25-30), tap a mark to pick it (31-34).
  - docs/test-plans/slice2e-hold-shapes.md steps 1-24: fluoro highlighter, draw-and-hold shapes, resize after the snap, two-finger double-tap undo.
  - docs/test-plans/general-notes-viewer.md steps 1-16: general notes, the in-app PDF viewer (sizes, zoom, Share).
  - docs/test-plans/about-and-docs.md steps 1-8 (step 8: I read both PDFs before they go to the team).
  - docs/test-plans/dashboard-steps.md steps 1-4.
- Last commit 5397085 (rename to Northrop Hardhat, hard-hat roundel icon). iOS caches home-screen icons and names: to see the new icon and "Hardhat" label I must remove the app from the home screen and add it again. Removing it DELETES its data (a home-screen app has its own storage): Back up all first, then import the backups after re-adding.

NEXT (agreed order; plan + mockup each before building)
1. Fix anything from the waiting iPad test plans.
2. Step 10 hardening: offline tests, large real drawings (speed, file size), storage limits. Start with the in-app diagnostics panel (sharp render scale vs wanted, render errors, canvas megapixels) I can screenshot, then fix the slow scrolling on pages with lots of markup and the earlier blurry-zoom problem together (see OPEN ITEMS).
3. Later list (not scheduled): free-form revision clouds; a sort order for prefilled messages; a "Take another" photo button; undo for pin moves, notes box moves and page operations; slice 3 calculators (AS 3600, separate app area, never in the memo; never invent clauses: ask); slice 4 standard details library.

DOCUMENTS (built 2026-10-07)
- docs/manual/features-and-limitations.md (for the digital innovation team) and docs/manual/user-guide.md (for engineers). Rendered to Northrop-branded A4 PDFs in public/docs/ by scripts/build-manual.ts (`npm run docs:build`), with screenshots of the synthetic drawing from e2e/manual-shots.spec.ts (`npm run docs:shots`; tagged @shots, excluded from the normal suite by playwright.config.ts). Markdown subset: front matter (title, subtitle, audience), # sections (new page), ##/###, **bold**, - bullets, 1. steps, > notes, ![Caption|maxHeightPt](shots/x.jpg or .png), <!-- page -->. pdf-lib can't read some WebKit JPEGs (small element screenshots): those are PNG.
- Bundled with the app (pdf precached) and opened from Settings, About, in the in-app PdfViewer. My decisions: hosting described only as "a public web page"; a short "How it was built" (AI-assisted, synthetic data only) note; no password on the features document (a password on a public static site isn't real protection; I said don't worry); the buddy isn't on the documents.
- Check layout after rebuilding (sparse pages): render pages with pypdfium2 (pip install into the scratchpad, PYTHONPATH) and look; cap tall screenshots with |height.

HOW THE UI IS BUILT
- One stylesheet: src/app/styles.css. Tokens at the top (colours incl. --page, --surface, --surface-2, --sunken, --ink, --ink-strong maroon, --ink-muted, --line*, --selected charcoal, --accent red, --ok/--todo/--danger, --observation, --viewer-bg, --focus; spacing --space-1..8; radius; type --text-xs..2xl (no --text-base: use --text-md); --control 44px); a dark set under prefers-color-scheme: dark. Brand values only from src/brand/northrop.ts via applyBrandTokens(). Drawing pages, the notes box, the memo preview and the signature pad stay white in both modes.
- Buttons: base rules use :where(button); colour-only transitions; never transform effects on buttons (pins and handles are positioned by transform). Variants: default soft pill, .primary, .emphasis, .quiet, .danger-outline, .danger, .toggle-on, .icon-button.
- Branding: the app icon is public/icon.svg (Northrop roundel, its white Figtree-Bold N wearing a white hard hat, on white); `npm run icons:build` regenerates the PNGs (pwa-assets.config.ts; apple padding 0.06, white backgrounds). The side rail keeps the plain Northrop roundel. The buddy (src/app/Buddy.tsx, SVG mascot in currentColor, clipboard filled with --buddy-fill) appears in the app only: About and the first-run screen; never anything client-facing.
- Shell, screens and routes as before: Shell.tsx (rail: Dashboard, Inspections, Settings), AppBar, Dashboard (DashboardPage.tsx; the Continue tile ends with Pre-inspection | Inspection | Site memo links, the suggested next step dark), Inspections list, InspectionTabs, Pre-inspection (InspectionHome.tsx), Site memo (MemoScreen.tsx, ExportCard.tsx), Project page, Settings (SettingsPage.tsx; About is AboutCard.tsx with src/content/changelog.ts).
- src/app/PdfViewer.tsx: full-screen in-app PDF viewer (a home-screen app has no browser controls): Back, title, − / + and pinch zoom, Share… (onShare gets the loaded bytes so the Share sheet opens from the tap). Pages keep their relative sizes (widest fills the width), each labelled with its paper size (src/app/paperLabel.ts). Used by About's documents and Export's Preview.
- Inspection step src/features/drawings/DocumentScreen.tsx: MarkupToolbar under the header, the .viewer-wrap tile, right-edge pills (Page/Items; camera, Undo, Redo, Fit page), floating panels (ItemSheet, ItemsPanel). A brief "Undo: …" note (.viewer-toast) shows after a two-finger double-tap.
- Markup (src/features/markup):
  - MarkupToolbar.tsx: Pin, Pen, Eraser, Highlighter, line, arrow, rect, ellipse, cloud, Text (callout icon), Select (dotted lasso, custom lucide icons via createLucideIcon), Draw with finger. Hints for Pin, Eraser, Select always; Text's hint only in landscape (.markup-hint-group.beside-options).
  - markupPrefs.ts (localStorage UI prefs): palettes per row (pen row shared by pen, shapes, text; highlighter row fluoro, highlighterSet: 2 resets older pastel slots once), selected slot and weight per tool, shape, fingerDraw, predict.
  - markGeometry.ts: weights, strokes (thin + smoothLifted), shapes (shapeDrawing), polygon and oval kinds (oval legacy), isBoxShape/rotatePoint/boxCentre; drawMark applies Markup.rotation to rect/ellipse/cloud by turning the level drawing's path (paths are absolute M/L/C/Z only, never Q) and outline; isHighlight (tool highlighter or Markup.highlight); HIGHLIGHTER_OPACITY 0.55.
  - shapeRecognition.ts: draw and hold → rect/ellipse (with rotation when tilted, level within 4°), polygon (triangles etc.), or null; DocumentViewer straighten() then scaleHeld() grows/shrinks the snapped shape as the Pencil drags on.
  - calloutGeometry.ts: callout box, wrap, fixedWidth sizing, dog-leg leaders (shoulder 1.5 em from the side facing the tip; straight when the tip is above/below). drawings/arrows.ts: pin arrows dog-leg too (elbow 4% of the short side from the pin centre).
  - CalloutsOverlay.tsx: callouts like pins (tap selects + turns Text on, second tap edits; drag box/tip; side handle resizes with Text on); passive when Select is on.
  - selectGeometry.ts: pickMark, marksInLoop (any part), movedPoints, clampMove, shapeHandles (turned boxes' handles turn), resizedPoints (turned boxes resize along their own sides), rotateHandle/rotationCentre/rotationBy (snap 45°)/rotatedMark, weightIndex/weightToolOf, ROTATE_OFFSET_PX.
  - SelectionOverlay.tsx: dashed box (turned outline for one turned box), handles, rotate grip, floating bar (Colour, weights or S/M/L, Duplicate, Delete).
  - markupActions.ts: drawWithUndo, eraseWithUndo(label), unfillWithUndo, changeMarkWithUndo, changeMarksWithUndo (one step for many), duplicateWithUndo. db/markups.ts: addMarkup(s), updateMarkup(s), MarkupPatch (points, text, fixedWidth, colour, weight, rotation).
- DocumentViewer (src/features/drawings/document/DocumentViewer.tsx): ink tools take pen/mouse (touch with fingerDraw) in onPointerDownCapture; Select takes the pointer first (startSelect: handle, move inside box, loop; finger taps pick via onPointerUp); a tap with no tool / pen / highlighter / shape tool on a mark calls onTapMark (Select comes on; letting go returns to the previous tool); Text uses the pin-style tap/hold (startHold kind "text"); two-finger double-tap → onUndoGesture (touch handlers, twoTap state).
- Items: general notes are Items with general: true, drawingId "", page 0 (itemSpots → [], lettered first in letterChanges, kind locked to observation in updateItem, listed in every notes box; DocumentScreen shows a box on every page while they exist, at the default spot until moved (placeObservationBox creates the record); export: drawingPages adds them to each exported page's box; pages are still only those with pins or markup).
- Pin gestures, zoom (pinchSnapshot.ts), Pages view, Items panel as in SPEC 5 / 12.
- e2e relies on accessible names and data-testids. Helpers: e2e/drawings.spec.ts openDrawing (Pin on unless false), addPinAt, drawLine, sheet; e2e/helpers.ts openTab, openInspectionsList, pinch, pinToolOn, touchTap, stageBox, startInspection.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Projects hold job number, name, client, address; inspections without one are "Needs a project".
- Letters per kind in document order (general notes first among observations); re-lettered on add, delete, switch, reorder, page duplication.
- Notes box per pinned page (and every page while there are general notes); arrows from pins (dog legs); pages can be hidden, duplicated, moved.
- Undo/Redo per inspection, session only: pins, deletes, reorders, kind switches, photo confirmation, arrows, photos, all markup (draw, erase, fill, callout edit/move/resize, select move/resize/rotate/recolour/weight/duplicate/delete). Not: pin moves, notes box moves, typing in items, page operations.
- Memo: SIM-NNN per job; standard conditions then instructions; photo-confirmation note per instruction.
- Export pack: memo, pages with pins or markup (native sheet sizes, vector, markup drawn as vector, highlights multiplied), photo appendix.
- No sync; per-inspection backup files (schemaVersion 2 with markup; version 1 still imports).

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob.
- Playwright reuses a server on port 4173: a leftover `vite preview` serves an OLD build. Check port 4173 and stale node / WebKit processes (Get-Process WebKit*,node) before a gate run and stop them.
- Run the full e2e suite in the FOREGROUND (Bash with a 600000 ms timeout): a background run once took 7.6 hours because the PC slept, and its failures were meaningless.
- Known flaky e2e tests under load: "photo viewer: a quick flick changes photo" and occasionally "create a memo…", "deletes an inspection only after confirming" (tab navigation timing). Rerun the full suite for a clean run before pushing.
- Marks render in random id order: e2e must find marks by data-tool (e.g. '[data-tool="rect"]'), never nth(). Wait for a new mark to exist before tapping it (it saves asynchronously).
- Throwaway screenshot specs live at e2e/zz-*.spec.ts (git-excluded) and DO run in the full suite: delete them when done.
- In the Bash tool, heredocs with apostrophes, backslashes or non-ASCII break Python edit scripts: write the script to the scratchpad with the Write tool (newline="" to keep line endings; assert each match), use raw strings for regexes.
- Navigation renders as a React transition: e2e openTab waits for aria-current.
- Mobile WebKit in Playwright has no mouse wheel and can't construct Touch objects: pinch/two-finger helpers dispatch Events with a plain `touches` array. A mouse counts as a drawing pointer for the ink tools (so with Pen on, a mouse click on a callout draws or picks; use touchTap for a finger).
- iOS Safari: scrolls asynchronously; zooms into text inputs under 16 px; the Share sheet only opens straight from a tap; a link to a PDF in a home-screen app opens in the app window with no way back (hence PdfViewer); home-screen icons and names are cached until the app is re-added.
- Painting marks into extra canvases made zoomed pages blurry on the iPad (unexplained; rolled back). Don't retry without device diagnostics.
- React Compiler lint: no performance.now() in some handlers (use helpers), no ref writes in effects the compiler flags (write refs in event handlers), no setState directly in effects; react-refresh: component files export only components (put helpers like paperLabel in their own .ts).
- erasableSyntaxOnly is on: no TypeScript constructor parameter properties.
- CSS grids sized by content overflow: use minmax(0, 1fr). Check every screen in both orientations after layout changes. The base button rule sets min-height: small buttons need min-width/min-height 0.
- Don't use display: grid on <details> in Safari; use background-color (not the shorthand) on fields.
- Vite only bundles new URL("literal", import.meta.url) with a literal path. Node scripts can import src/brand/northrop.ts (its new URL()s resolve to file URLs).
- Starter prefilled messages: edit docs/content/snippets.md and run npm run snippets:build.
- CI runs in Playwright's Docker image (v1.63.0-noble), 20-minute timeout; @playwright/test pinned to 1.63.0.
- Polling the GitHub Actions API unauthenticated: 60 requests an hour, poll every 90 s; confirm the deployed bundle contains the commit. gh isn't installed.

OPEN ITEMS
- Markup performance (deferred by me): scrolling slows on pages with a lot of markup (SVG marks repainted into every tile Safari scrolls in). Canvas-painted marks fixed scrolling but made zoom blurry on the iPad (cause unknown; rolled back 2026-10-06). Next attempt starts with an in-app diagnostics panel I can screenshot. The Pencil feels less fluid than GoodNotes; native-level feel may not be reachable on the web.
- Android/Windows tablets: untested.
- Marketing should be consulted before the hard-hat N icon is used more widely (I've said it's fine for the POC).
- Limitations (kept in docs/manual/features-and-limitations.md): no sync between devices; data in one browser on one device and iOS can clear it (hence backups); one device at a time (Replace overwrites); SIM references can clash across devices; Android/Windows untested; the Share sheet needs a tap after preparing; large real drawings untested; scrolling slows with lots of markup; the Pencil feel isn't native-level; no re-inspections or item status; undo is session-only and partial; callout text stays level; no accounts; calculators and details library not built; public hosting.

First, confirm you've read the files and summarise where things stand in a few lines. Then ask me for my results on the waiting iPad test plans before starting step 10.
