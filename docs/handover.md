# Handover prompt (paste into a new chat)

You're picking up an in-progress build. Read CLAUDE.md, then SPEC.md (source of truth), then docs/decisions/log.md before doing anything.

PROJECT
- Offline-first iPad PWA for a structural engineer's site inspections (Northrop). Repo: C:\Users\dsamson\Desktop\CODING\inspection-app, remote github.com/jabbaby/inspection-app (public). Every push to main runs CI (typecheck, lint, format, unit, e2e, build) and deploys to GitHub Pages at https://jabbaby.github.io/inspection-app/
- Stack: React 19 + TypeScript + Vite, vite-plugin-pwa, Dexie (IndexedDB, schema v10), pdfjs-dist (viewer and memo preview), pdf-lib (memo PDF, export), lucide-react (icons, bundled), Vitest, Playwright (iPad Pro 11 viewport; WebKit, plus Chromium for @offline tests).
- Local git identity is set (noreply 310427615+jabbaby@users.noreply.github.com). End commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- A dev server config exists in .claude/launch.json ("dev", port 5173; "preview", port 4174).

WORKING AGREEMENTS (important)
- Auto-push to main is allowed, but only after the full gate passes locally: typecheck, lint, format:check, unit tests, and e2e against a fresh build. Then poll CI and confirm the deploy. Never push with failing or skipped checks.
- For anything non-trivial: short plan first, wait for approval (for UI work, a mockup helps: I liked reviewing them). Small focused commits, each one buildable.
- Ask before guessing report wording or engineering content.
- When behaviour changes: update SPEC.md and docs/decisions/log.md, and write a manual iPad test plan in docs/test-plans/ as a NUMBERED LIST (not a table). I reply with step numbers.
- Repo, test fixtures and chats stay synthetic. Real drawings and photos are allowed in the app only (they stay on the device).

STATUS (SPEC section 13 build steps)
- Done and iPad-verified: steps 1 to 6, step 7 (memo editor, prefilled messages) and its follow-ups: two-column home, bigger growing text boxes, recipients table rule, memo signature (draw or upload), inspection steps, projects and contacts, and the UI refresh with dark mode (latest commit 14cf329; plans step7 to step7f in docs/test-plans/).
- Next: a UI overhaul (I'll paste my brief). After that, step 8: the full PDF export pack.

HOW THE UI IS BUILT (for the overhaul)
- One stylesheet: src/app/styles.css. Colours are semantic tokens at the top (--page, --surface, --ink, --ink-strong, --line, --selected, --accent, --ok/--todo/--danger and their -bg, --observation, --viewer-bg), with a dark set under prefers-color-scheme: dark. Brand values (red, cream, maroon, grey, Figtree) come from src/brand/northrop.ts via applyBrandTokens(); never hard-code brand values elsewhere. Drawing pages, the notes box, the memo preview and the signature pad stay white in both modes (they show what's printed).
- All inputs/selects/textareas share one global style (44 px, 16 px text). Buttons: default outline; .primary (red); .danger-outline; .icon-button; .toggle-on.
- Screens: Shell (red top bar, nav) src/app/Shell.tsx. Home src/features/inspections/InspectionsPage.tsx (Recent + Projects columns, status chips, InspectionCard, ProjectAvatar). Inspection header + step bar src/features/inspections/InspectionTabs.tsx (InspectionHeader, CompactInspectionHeader, InspectionTabs; routes via tabPath.ts: /inspections/:id/details | /inspection | /memo). Pre-inspection src/features/inspections/InspectionHome.tsx. Inspection step = drawings viewer src/features/drawings/DocumentScreen.tsx (toolbar, Drawings panel, Items panel, item sheet, camera button). Site memo src/features/memo/MemoScreen.tsx (+ CreateMemo, MemoPreview, Photos section). Project page src/features/projects/ProjectPage.tsx; ProjectPicker dialog. Settings src/features/settings/ (cards, section nav, folding SnippetsEditor).
- e2e tests rely on accessible names and data-testids (e.g. "Inspection sections" nav, "Recent inspections"/"Projects" lists, "Back to inspections", step links named Pre-inspection / Inspection / Site memo, page-indicator, drawing-viewer, item-sheet, snippet-row). Keep them or update the tests in e2e/ deliberately.

KEY DECISIONS ALREADY MADE (details in SPEC and the log)
- Projects: job number, job name, client and address live on a Project shared by its inspections and memos; inspections keep item inspected, date, inspector. Inspections without a project are flagged "Needs a project" (Create new project / Assign to project); no memo until they have one. Duplicate job numbers are flagged. Delete project deletes its inspections after a confirm giving the count. Memo recipients become project contacts (on leaving the row); "Add from contacts" offers them.
- Letters: per kind (instructions A, B...; observations A, B...), in document order (drawing, page, then order on the page, reorderable in the Items panel). Re-lettered on add, delete, kind switch or reorder.
- Notes box per pinned page: black header, observations (blue), then instructions (red), Arial caps; default 15 mm from the top-right corner. Arrows from pins (several per pin), in the pin's colour.
- Viewer: native browser scrolling (120 Hz on iPad); the pinch previews as a CSS transform and lays out once on release; tapping the drawing closes the item editor. The toolbar must keep a fixed shape (one row in portrait) so the drawing never shifts under a tap.
- Undo/Redo (per inspection, session only): pin add, item delete, reorder, arrow add/move/remove, photo add/delete.
- Photos: 1600 px JPEG 0.8 working copy, EXIF orientation applied by the browser. Camera originals kept for "Save to iPad" (Share sheet, batches of 20, prepared before the tap). "Free up space" removes saved originals. General photos live on Inspection.photoIds; the Site memo step shows all photos grouped as the appendix; a camera button in the drawings toolbar adds general photos.
- Memo: one per inspection with a SIM-NNN reference per job number. Conditions: ticked standard conditions first ([letters] becomes e.g. A–D), then instructions. Salutation defaults to the first name of the first "To" recipient. Signature (memo's own copy, from Settings) printed 40 pt tall between "Yours sincerely," and the name. The preview is the real PDF drawn with pdf.js.
- Step 8 appendix (agreed): A4, 4 photos per page; instructions, then observations, then General last. Each group is headed by the item label and text; photos are labelled IA1 / OA1 / G1 plus caption. Step 8 must also warn about re-lettering once a memo has been exported, and burn in pins, arrows and the notes box using the shared geometry (src/features/drawings/observationBox.ts, src/features/drawings/arrows.ts; Helvetica in the PDF). Export goes on the Site memo step. The step 9 inspection file must carry the project.
- Status colours (green done, amber to do, red attention) are app-only, never in the memo or PDF. The app follows the device's light/dark setting.

GOTCHAS LEARNED
- File bytes are stored as ArrayBuffer in the blobs table, not Blob (Playwright's WebKit on Windows can't store Blobs in IndexedDB).
- Local Playwright runs are capped at 3 workers; under that load the memo preview (rebuilt after every edit) can delay saves, so memo save checks allow 15 s. Mobile WebKit in Playwright has no mouse wheel, and can't construct Touch objects: e2e pinch helpers dispatch Events with a plain `touches` array (e2e/helpers.ts). The photo-viewer flick test is timing-sensitive and occasionally flaky.
- iOS Safari scrolls asynchronously: never set or read the scroll position every frame during a gesture. Read the live scroll position on pointer events.
- The viewer tracks pointers; lost pointerups are handled with page-wide listeners and an isPrimary reset.
- CSS grids sized by content overflow the page: always use grid-template-columns: minmax(0, 1fr) (bit the photo viewer, the memo form and Settings). After layout changes, check document.documentElement.scrollWidth on every screen in both orientations.
- Don't use display: grid on <details> (unreliable in Safari); the folding rows use block layout.
- A background shorthand on fields wipes the select arrow: use background-color.
- The Share sheet only opens straight from a tap: prepare files first.
- Vite only bundles new URL("literal", import.meta.url) when the path is written literally (see src/brand/northrop.ts).
- The browser preview pane in the desktop app often doesn't draw when hidden (rAF, scroll and ResizeObserver stall). For screenshots, a throwaway Playwright spec (e2e/zz-*.spec.ts, deleted afterwards) with page.screenshot works well, including colorScheme: "dark".
- In the Bash tool, heredocs containing apostrophes fail, and Prettier may reflow code between edits. Write Python edit scripts to the scratchpad and run them, asserting each match.
- Polling the GitHub Actions API unauthenticated is limited to 60 requests an hour: poll every 90 s.
- Lint enforces react-refresh (component files export only components; helpers go in their own .ts) and no setState directly in effects.

OPEN ITEMS
- CI change still unanswered: run the deploy workflow in Playwright's official container image with timeout-minutes: 20 (the browser install once took over 10 minutes).
- Idea saved for later: lettered notes-box entries with no pin (general comments). Ask which page's box, whether instructions are allowed, and how they're lettered.
- Prefilled messages are listed in stored-id order (new ones land anywhere); a sort order could be added.
- Undo doesn't yet cover pin moves, notes box moves, kind switches or typing.
- Android/Windows tablets: native scrolling should work but is untested.

First, confirm you've read the files, summarise where things stand in a few lines, then I'll paste my UI overhaul brief.
