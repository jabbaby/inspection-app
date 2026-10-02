# Decision log

Format: `YYYY-MM-DD | decision | why | changed in SPEC section`

2026-10-01 | iPad-first PWA, offline capable | patchy site internet, no App Store process for POC | 3, 10, 11
2026-10-01 | Local-only storage, inspection file moves data between iPad and desktop | simplest POC, sync later | 9
2026-10-01 | Lettered items can be instruction or observation | engineer's workflow | 5
2026-10-01 | Drawings keep native size in the PDF pack | legibility, fidelity | 7
2026-10-01 | Northrop branding hard-coded in one module | POC only | 4a
2026-10-01 | Memo ref auto-numbered per job (SIM-001) and shown with item inspected | engineer request | 7a
2026-10-01 | Re-inspections out of scope for POC | keep slice 1 tight | 15
2026-10-01 | Calculators are a separate app area, never part of memo or PDF pack | engineer request | 3, 8, 12
2026-10-01 | Observations move off the memo into a draggable text box on each drawing page (hidden if none); new ObservationBox record | keep observations from being read as conditions | 5, 7, 8, 15
2026-10-01 | Snippet gets a 'heading' kind; observations box heading defaults to "Noted for information:" | heading must stay user-editable | 8
2026-10-01 | Four starter body messages (generally in accordance except items; in accordance; not in accordance + re-inspection; not in accordance + photo confirmation), engineer picks one | engineer request | 4
2026-10-01 | Conditions lead-in is one line "Ok to proceed subject to the following:" for any body message; "Ok to proceed." alone when no instruction items | match sample memo | 4
2026-10-01 | CLAUDE.md memo-content rule updated to match the observations change (edited by Cowork; review) | keep CLAUDE.md consistent with SPEC | n/a
2026-10-01 | POC hosted on GitHub Pages from David's personal GitHub account; local git with GitHub remote | free HTTPS hosting, no company host yet; site is public but holds no user data | 15
2026-10-01 | Synthetic data only until IT approves hosting; revisit before real project material or wider sharing | public link, personal account | 15
2026-10-01 | Figtree self-hosted under SIL OFL | free licence, works offline | 15
2026-10-01 | Hash routing (/#/settings) instead of path routing | GitHub Pages has no SPA fallback; every route is served by the one precached index.html | n/a
2026-10-01 | Automated offline test runs in Chromium at iPad viewport; other e2e tests in WebKit | Playwright's WebKit cannot reload offline through a service worker; real iPad offline check stays in the manual test plan | n/a
2026-10-01 | Memo reference shown on its own line under Job name, same style as Job name | sample has no reference field; keeps the header block together | 4, 15
2026-10-01 | Memo body text is plain (sample italics were placeholder highlighting); bold/italic only for engineer name and disclaimer | engineer decision | 15
2026-10-01 | Static Figtree TTFs (official repo, OFL) committed for PDF embedding; memo sidebar drawn as vector, wordmark and footer icon embedded as PNG from the sample | pdf-lib needs TTF; vector keeps the sidebar crisp and small | 15
2026-10-01 | Gesture model: one finger pans, two-finger pinch zooms, pins only via an Add pin button (one pin per tap of the button); Apple Pencil reserved for freehand markup in slice 2 | engineer wants GoodNotes-style behaviour and no accidental pins while drawing | 3, 5, 14
2026-10-01 | Use the standard (non-legacy) pdf.js build | test iPad runs iPadOS 26.5, which supports it | n/a
2026-10-01 | Job details autosave as you type (no Save button) | nothing lost if the iPad sleeps or the app closes on site | 12
2026-10-01 | No field blocks saving an inspection; job number and job name flagged and required before a memo | start inspections with partial details on site; SIM reference and filename need them | 12
2026-10-01 | New inspections take the inspector name from Settings (My details) | engineer request | 12
2026-10-01 | Deleting an inspection keeps its job's memo counter | SIM references are never reused | 12
2026-10-01 | Real drawings may be used in the app; they stay on the device. Repo, fixtures and AI chats stay synthetic | engineer decision: drawings are never uploaded to git, a server or AI | 15
2026-10-01 | Observations box on every page with pins, default top right, with header "NORTHROP INSPECTION / item inspected / initial surname / DD/MM/YYYY"; observation list only when the page has observations | engineer request | 5, 8
2026-10-01 | Item inspected becomes an inspection job detail; memo Item inspected and Reason for visit prefill from it | needed for the observations box header before the memo exists | 4, 8
2026-10-01 | New items start as instructions; kind switched in the item sheet (no separate Add observation button) | most items are instructions; one tap to switch | 5
2026-10-01 | Inspection keeps an only-increasing letter counter (nextLetterIndex) | letters never reused after deletion | 5, 8
2026-10-01 | Re-letter deferred; raise it when planning step 7 and before step 10 | gaps are harmless; re-lettering after a memo is sent could confuse | 5
2026-10-01 | File bytes stored as ArrayBuffer records (with type and size), not Blob; drawings keep fileSize | Blob-in-IndexedDB unsupported in some WebKit builds; ArrayBuffer works everywhere and zips simply | 8
2026-10-01 | Opening the item sheet keeps the drawing's zoom; the view pans only to keep the selected pin visible | avoid the drawing jumping when the sheet opens in portrait | 12
2026-10-02 | Deleting an item or drawing re-letters the rest in creation order (no gaps); replaces "letters never reused" and the deferred manual re-letter | engineer decision; memos are checked before sending. Step 8 to warn after a memo has been exported | 5, CLAUDE.md
2026-10-02 | Notes box also lists the page's instructions under "Instructions:" above observations | engineer request | 5
2026-10-02 | Notes box text and border, and observation pins, in markup blue #0165FC | easier to tell observations from instructions | 5
2026-10-02 | Notes box in Arial capitals (screen); Helvetica in PDF export. ISOCPEUR not bundled: Autodesk copyright, public repo and site | licensing; Helvetica is Arial's metric twin and needs no font file | 5, 8
2026-10-02 | All of an inspection's drawings shown as one continuous vertical document, pages at equal width; page buttons removed | engineer request (GoodNotes style) | 12
2026-10-02 | Items tab inside the drawings view (letter order; tap scrolls to the pin) | engineer request: see items without leaving the viewer | 12
2026-10-02 | Notes box instructions (heading and lines) in red #DA1A32 to match instruction pins; header, observations and border stay blue | engineer request | 5
2026-10-02 | Notes box lists observations before instructions; header line in black (border and observations stay blue, instructions red) | engineer request | 5
2026-10-02 | Drags lock to their starting axis; finger flicks keep rolling with iOS deceleration (touch only, not mouse); a touch stops the roll without placing or opening a pin | engineer request (GoodNotes feel); mouse drags don't roll in desktop apps | 5
2026-10-02 | Instructions and observations lettered separately (A, B, C... each, per inspection, creation order); switching kind re-letters; lists show observations then instructions; letter counter (nextLetterIndex) dropped, Dexie v4 re-letters existing items | engineer request: separate A-Z lists in the notes box, with pins matching | 5, 8, 12, CLAUDE.md
2026-10-02 | Document scrolls natively (browser scroll area) instead of app-driven panning; custom momentum and axis lock removed; sideways movement locked at fit width, free when zoomed in; pinch via touch events | engineer found app-driven scrolling choppy; Safari limits page animation to 60 fps but native scrolling runs at 120 Hz on ProMotion with real iOS momentum | 5
2026-10-02 | Letters per kind follow document order (drawing, page, then placement order on the page) instead of time placed; Dexie v5 re-letters existing items; drawings get strictly increasing createdAt | engineer request: letters should read in order through the drawings | 5, CLAUDE.md
2026-10-02 | Items lists grouped under Observations and Instructions headings | engineer request | 5
2026-10-02 | Notes box default inset fixed at 15 mm from the top and right edges (was 2% of the sheet's short side) | engineer request: not hugging the edge, in line with the title block; title blocks can't be detected | 5
2026-10-02 | Item deletes have no confirm; an Undo button (per-inspection history, until the app closes) reverses item deletes and reorders, and is the app's general undo for later features. Drawing deletes keep their confirm | engineer request; confirms slow down site work | 5, 12
2026-10-02 | Items tab: swipe left to delete; drag handle reorders items of one kind within a page (new Item.sequence, Dexie v6), which re-letters them | engineer request; reordering across pages would break document-order letters | 5, 8, 12
2026-10-02 | Items tab grouped by page within each kind (row subtitles removed); Redo added; Undo/Redo shown as arrow icons; Done button above Delete in the item sheet | engineer request: handles were confusing across pages | 5, 12
2026-10-02 | Adding a pin is undoable (Undo removes it, Redo restores it with its text and notes box); Items tab highlights rows whose pins are on screen | engineer request: undo felt inconsistent without adds; easier to find the items you're looking at | 12
