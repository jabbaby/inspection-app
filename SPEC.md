# Site Inspection Companion: Project Spec

Status: DRAFT v1.3 (planning complete enough to start build)
Owner: [your name]
Audience: me, Claude Code, and later the digital innovation team (proof of concept review)

---

## 1. What this is

An iPad-first, offline-capable inspection companion for a structural engineer. On site the engineer opens the drawing PDF, drops lettered markers on the areas of concern, attaches photos, writes instructions, and the app generates a **Site Instruction Memo** (editable in-app, exported as a single PDF) with the marked-up drawing and a photo appendix attached.

Longer term the app also holds engineering calculators (AS 3600) and a standard details library. These are **separate areas of the app**, independent of the inspection and memo workflow, and are **not** part of the first build.

## 2. Users and context

- **Primary user:** one structural engineer, on site, on an iPad (Apple Pencil available), with patchy internet.
- **Secondary:** same engineer at a desktop, to review and edit a memo before sending.
- **Proof of concept audience:** the company's digital innovation team. They need to open it via a link with no App Store process.
- **Out of scope for the POC:** multi-user accounts, cloud sync, permissions, client-facing access.

## 3. Scope

### Slice 1 (the POC core, build first)
1. Create an inspection (job details).
2. Upload one or more drawing PDFs and view them with smooth pan/zoom.
3. Use **Add pin** to drop **lettered pins** (A, B, C... for instructions and, separately, for observations) on a drawing. Each pin is either an **instruction** or an **observation**, with text, optional photos, and (for instructions) a flag for "photo confirmation required before proceeding".
4. Generate the **Site Instruction Memo**, editable in app.
5. Export one PDF pack: memo + marked-up drawing page(s) + photo appendix.
6. Export/import an **inspection file** so work moves between iPad and desktop.

### Slice 2
Freehand Apple Pencil markup, shapes/clouds/arrows, text callouts, and saving annotated drawings.

### Slice 3
A standalone **Calculators** area of the app (its own top-level section and navigation entry): AS 3600 concrete checks, area of steel, development length, lap length. Calculators do **not** appear in the memo or the PDF export pack, and are not attached to an inspection. Optional on-device history of recent calculations, kept separate from inspection data and not included in inspection files.

### Slice 4
Standard details library (searchable, attachable to a memo item).

## 4. The memo (from the Northrop sample)

The sample is a one-page **Site Instruction Memo**, not a long report. Anatomy:

**Fixed branding and layout (template, not edited per job)**
- Red full-height left sidebar with logo, the title "SITE INSTRUCTION MEMO", and office contact block at the bottom (address, phone, email, ABN).
- Footer strapline and page number.
- Fixed disclaimer paragraph at the bottom of the memo (site safety remains the builder's responsibility, inspection doesn't relieve the contractor, no variation without approval).
- A4 portrait.

**Per-job fields (filled in the app)**
| Field | Notes |
|---|---|
| Client name | text, from the inspection's **project** (shared by its inspections) |
| Client company name | text, from the project |
| Address line 1 / 2 | text, from the project |
| Date | defaults to today |
| Job number | text, from the project |
| Job name | text, from the project |
| Memo reference | auto-generated per job (e.g. `SIM-001`, `SIM-002`), editable. Shown in the memo header with the item inspected, e.g. "SIM-001 – Level 3 slab reinforcement". The sample template has no reference field; it is placed in the right-hand header column on its own line under Job name, in the same style as Job name. |
| Recipients table | up to 5 rows: Company, Attn, and To or Copy (checkbox pair; at least one "To", warned if none). A new memo starts with the client as the first "To". **Add from contacts** offers the project's contacts not already listed (added as "To" if there is none yet, otherwise "Copy"); a recipient typed in is added to the project's contacts when you leave its row (no duplicates: same company and attn, ignoring case and spaces), and a new memo's client is added too. |
| Site visit requested by | defaults to "client name, client company"; editable, with Reset |
| Reason for visit | the item inspected (e.g. "Level 3 slab reinforcement"); prefilled from the inspection's Item inspected |
| Inspector | the engineer's name |
| Sent via | Aconex / Email (select) |
| Signature | under Sent via in the editor: **Include signature** (on by default) and the memo's own signature, printed between "Yours sincerely," and the engineer's name, 40 pt tall (narrower if very wide), keeping its shape. **Draw signature** opens a signing pad (Apple Pencil or finger, black ink; Pencil pressure varies the line; every pen sample is drawn as it arrives so it keeps up at 120 Hz; once the Pencil is used, finger touches are ignored so a resting palm doesn't draw), **Upload image** takes a PNG or a photo of a signature on paper (white paper is made see-through unless the image already has a transparent background), both cropped to the ink. **Use my saved signature** and **Remove**. A new memo copies the signature saved in Settings; the first one added to a memo with none saved in Settings is saved there too |
| Salutation | defaults to "Dear {first name}," from the Attn of the first "To" recipient; editable, with Reset |
| Item inspected | used in the body sentence; prefilled from the inspection's Item inspected (a job details field, also shown in the observations box header) |
| Body paragraph 1 | "We confirm having inspected the [item inspected] as highlighted on the drawing attached." |
| Body paragraph 2 | pick from **prefilled messages** (see below); the chosen text is copied into the memo and can be edited there |
| Conditions list | One lead-in line, then bullets: first the ticked **standard conditions** (condition snippets; "[letters]" becomes the instruction letters, e.g. "A–D"), then each **instruction** as "A. text" in letter order, generated live from the items. "Complete items [letters] listed below." is ticked by default when there are instructions, and "Confirm completion of items via photos prior to proceeding." when any instruction has photo confirmation required; the engineer can tick or untick any. An instruction can be reworded for the memo without changing the item ("Use item text" goes back). With one or more conditions the lead-in is "Ok to proceed subject to the following:" (same for every body message, as in the sample); with none, "Ok to proceed." and no list. |
| Sign-off | engineer name and title, from Settings (My details) when the memo is created; editable |

**Prefilled messages (needs a small snippet library)**
The sample explicitly says different prefilled messages should be selectable. Example from the sample:
- "At the time of the inspection the works were generally in accordance with the structural design except for the items noted in the attachment."

Standard conditions from the sample:
- "Complete items (A-G) listed below."
- "Confirm completion of items via photos prior to proceeding."

The starter set (in `docs/content/snippets.md`) has four body messages: works generally in accordance except for listed items; works in accordance; not in accordance with re-inspection; not in accordance with photo confirmation. The engineer picks one per memo. The app ships with this starter set; the engineer can add, edit and delete snippets. Snippets are stored locally and included in the exported inspection file.

### 4a. Branding (POC decision)

Northrop branding is **hard-coded** for the POC. Brand assets come from the sample `.docx` (kept in the repo at `docs/reference/Northrop_sample_report.docx`): `word/media/image1.png` is the wordmark, `image2.png` the red sidebar shape, `image3.png` the footer icon. Extract and convert them into app assets during scaffolding (the sample is the visual reference for the memo layout). To keep a later swap cheap, keep all brand values (colours, font, logo, office block, disclaimer, strapline) in one module (`src/brand/northrop.ts`) and have the memo renderer read from it rather than embedding values in layout code. No template-switching UI in the POC.

## 5. Lettered items and pins

- **Instructions and observations are lettered separately**, each in **document order**: by drawing (the order drawings were added), then page, then the item's order on that page (the order the pins were placed, unless the engineer reorders them in the Items tab). Instructions run A, B, C ... Z, then AA, AB ..., and observations A, B, C ... the same way. So a pin added later on an earlier page takes its place in the sequence and the pins after it move along (pin on page 2 is A; a new pin on page 1 becomes A and page 2's becomes B). An instruction A and an observation A can both exist; they are told apart by pin colour, and the app always names the kind ("Instruction A", "Observation A"). Deleting an item (or a drawing) re-letters the remaining items of that kind so there are no gaps: delete instruction C and instruction D becomes C. Switching an item's kind moves it to the other sequence (at its document-order position) and re-letters both. Memos are checked before sending; build step 8 warns before deleting once a memo has been exported.
- Letters are **per inspection**, not per drawing, so instruction "C" in the memo points to exactly one pin on one drawing.
- The memo's conditions list is generated from the items, e.g. "A. [instruction]". The engineer can edit the text in the memo without changing the underlying item.
- Each item has a **kind**: `instruction` (something the builder must fix or complete) or `observation` (neutral note, no action required). Both get a letter and a pin.
- In the memo, instructions feed the "Ok to proceed subject to the following:" list.
- Observations **do not appear in the memo**, so they are never read as conditions. Instead each drawing page that has pins gets an **observations box** (the "notes box" in the app), burned into that page in the export. It also lists that page's instructions, so the builder sees both on the drawing:
  - A header line on every page with pins: `NORTHROP INSPECTION | {item inspected} | {first initial}. {surname} | {DD/MM/YYYY}` (inspector and date from the inspection; empty parts are left out).
  - Then, only when the page has observations: a heading from a `heading` snippet (default "Noted for information:"; longer alternative in the starter set), followed by that page's observations by letter, e.g. "A. Existing crack noted at grid 4".
  - Then, only when the page has instructions: the fixed heading "Instructions:" followed by that page's instructions by letter, e.g. "A. Add N12 bar at grid C/4".
  - The engineer **drags the box into place** in the drawing viewer so it doesn't cover drawing detail. Its position is stored in normalised page coordinates (0..1), like pins. Default spot: top right of the page, 15 mm in from the top and right edges on every sheet size (just inside a standard 10 mm drawing frame, roughly in line with the title block's right edge).
  - Text size and box width are relative to page size, like the markers, so it stays legible on A1/A3 sheets. In the viewer the box is drawn on the page so it looks as it will in the export.
  - The box is removed from a page when its last pin is removed.
  - Style: header line in black; border and observations in markup blue `#0165FC`; the instructions heading and lines in red `#DA1A32` to match the instruction pins. All in capitals, Arial on screen. The PDF export uses Helvetica (Arial's metric twin, built into every PDF viewer) so no font file is bundled. Colour and fonts live in `src/brand/northrop.ts` (`markup`).
- **Item sheet:** placing a pin creates an item and opens its sheet. New items start as **instruction** with the cursor in the text box; an Instruction | Observation switch changes the kind at any time. Instructions have the "photo confirmation required before proceeding" option. Text saves as you type. Tapping a pin reopens its sheet; tapping the drawing away from pins closes it (the text is saved). A **Done** button sits above **Delete** (as well as the one in the sheet's header). Delete removes the item at once, with no confirm; Undo brings it back.
- **Pin style:** instructions are filled red circles with a white letter; observations are filled markup-blue (`#0165FC`) circles with a white letter.
- **Arrows:** a pin can have several arrows pointing from it to the spots it refers to, on the same page. In the item sheet, **Add arrow** then tap the drawing where it should point (a tap on another page is refused with a hint). When the item is selected, each arrow's tip shows a hollow handle: drag it to move the tip, tap it to select it, then **Remove arrow** (with a single arrow it needs no selecting). Arrows are a line from the pin with an arrowhead on the spot, in the pin's colour, sized relative to the page (about 4 pt line and a 30 pt head on A1) and drawn in page units so they zoom with the drawing; the step 8 export burns them in with the same geometry (`src/features/drawings/arrows.ts`). Adding, moving and removing arrows is undoable.
- Letters are always derived from the items and drawings (no stored counter); a new pin starts as an instruction lettered by its place in the document.
- In the viewer's Items panel, items are grouped under an **Observations** heading (A, B ...) and then an **Instructions** heading (A, B ...), matching the notes box.
- **Gesture model (GoodNotes style, decided in Spike B):** one finger scrolls, two fingers pinch to zoom. Scrolling is the browser's own (native scrolling): on iPad that is Safari's 120 Hz scrolling with iOS momentum and bounce, and on other platforms their own scrolling. At fit width (and below) the document is exactly as wide as the view, so it never moves sideways; zoomed in, it scrolls in any direction. A touch that lands while the document is scrolling only stops it; it never places a pin or opens one. Pinch is handled by the app (touch events, as in pdf.js's viewer): while the fingers are down the document is only scaled as a picture around the fingers (at most one update per frame, with page drawing paused) (nothing is laid out or scrolled mid-gesture, which Safari's separate scrolling would fight); when they lift, the new zoom is laid out once and the pages sharpen. Pins scale with the picture during the pinch and return to their normal size after. Apple Pencil never scrolls the document. With a mouse, dragging pans, the wheel scrolls and ctrl+wheel (or a trackpad pinch) zooms. Android and Windows tablets should get their own native scrolling but are untested; pen handling there relies on the standard pen pointer type. Pins are placed only through an **Add pin** button: tap it, then tap the drawing (finger, Apple Pencil or mouse); the mode ends after one pin. Taps never place pins otherwise, so the Apple Pencil stays free for freehand markup (slice 2). Pins can be dragged to move them.
- Fields per item: letter, kind, drawing + page, position, text, photos (0..n), `requiresPhotoConfirmation` (bool, only meaningful for instructions). No open/closed status in the POC (re-inspections are out of scope).

## 6. Photos

- **General photos** (not tied to a pin, e.g. overall views) are added in the Site memo step's Photos section, or with the **camera** button in the drawings toolbar (without leaving the drawing), with the same Take photo / Choose photos, viewer, captions, originals and Save to iPad as item photos (saved as `SY000001 General 1.jpg`). The Site memo step's Photos section shows every photo grouped as the appendix will be (instructions, observations, then General); it has no Undo button, so deleting a photo there asks first.
- Each item's sheet has a **Photos** section: **Take photo** opens the camera; **Choose photos** opens the library (several at once). Photos taken in the iPad's Camera app are saved to Photos automatically and can be added with Choose photos.
- Photos attach to an item and also appear in the **photo appendix** at the end of the PDF pack, grouped by item (e.g. Instruction A) with captions. Captions are optional; a photo without one shows none.
- Every photo gets a **working copy**: JPEG, long edge 1600 px (never enlarged), quality 0.8, the right way up. The camera stores which way up as an EXIF flag; Safari and Chrome apply it when decoding, and the working copy has no EXIF, so it can't be rotated twice. Photos are decoded one at a time to stay within iPad memory.
- **Camera shots also keep their full-size original**, so they can be saved to the iPad at native resolution later. Library picks keep only the working copy (they are already in Photos). Originals use roughly 3–5 MB each.
- Thumbnails in the sheet open a full-screen viewer on the app's cream background, kept clear of the iPad's status bar and home bar: swipe sideways (or use the arrow keys) between photos (the photos either side are preloaded in a strip that follows the finger and glides on release; a quarter-width drag or a quick flick changes photo), an optional caption (saved as you type, when moving on, and by **Save** at the top, which also closes the viewer; **Close** keeps it too) and Delete. Adding and deleting photos are undoable. The Items lists show each item's photo count.
- **Save to iPad** (item sheet, that item's photos) and **Save photos to iPad** (Site memo step, every photo, in item list order) share the photos through the Share sheet: choose Save Images (Photos) or Save to Files. A web app can't save to Photos silently; iPadOS only allows the Share sheet straight after a tap, so each batch of up to 20 is loaded first and shared on the next tap. Camera shots are shared as their original, others as the working copy, named like `SY000001 Instruction A 1.jpg`. Browsers without file sharing download the files instead.
- **Free up space** (Site memo step) removes the full-size originals of photos already saved to the iPad; the working copies stay for the report.
- Storage is the main offline risk on iPad (see section 10).

## 7. PDF export pack

One PDF, in this order:
1. Memo page(s) (branded, A4).
2. Marked-up drawing page(s): the original PDF pages that have pins, with lettered markers and (where there are observations) the observations text box burned in. **Each page keeps its native size** (the PDF will mix an A4 memo with larger drawing sheets). Marker size is defined relative to page size so letters stay legible on A1/A3 sheets. Watch file size and test with real large drawings.
3. Photo appendix (engineer decisions, 2026-10-02): A4 pages, **4 photos per page** (2 × 2), using the working copies. Groups in this order: **instructions** A, B, C… (matching the memo's conditions), then **observations** A, B, C…, then **General** last. Each group is headed by the item's label and text, e.g. "Instruction A – Add N12 bar at grid C/4" ("General" for general photos). Each photo is labelled **Photo IA1**, IA2… (instruction A), **OA1**… (observation A) or **G1**… (general), followed by its caption if one was typed.

Export must work offline.

### 7a. Memo reference and filename

- Reference format `SIM-NNN`, counted per job number, generated when the memo is created and editable afterwards.
- Because there is no sync, two devices could both create `SIM-002` for the same job. Mitigation for the POC: memos are created on the iPad, desktop is for editing imported inspections, and the reference stays editable. Flag this for the sync phase.
- Exported filename: `{jobNumber}_{reference}_{itemInspected}.pdf` (sanitised).

## 8. Data model

Stored locally in IndexedDB. File bytes (PDFs, photos) are stored in a `blobs` table as ArrayBuffer records `{ id, data, type, size }` and referenced by id. (Not Blob objects: Blob storage in IndexedDB is not supported by every WebKit build.)

```ts
Project        { id, jobNumber, jobName, client{ name, company, address1, address2 },
                 contacts[]: { id, company, attn }, createdAt, updatedAt }
               // a job: its details are shared by all its inspections and their memos
Inspection     { id, projectId|null, itemInspected, date, inspector, status,
                 photoIds[],   // general photos (not tied to a pin)
                 unsorted?{ jobName, client },   // details from before projects, when it had no job number
                 createdAt, updatedAt }
               // projectId null: "Needs a project" (no memo until it has one)
Drawing        { id, inspectionId, name, pdfBlobId, pageCount, fileSize, pageSizes, createdAt }
               // name defaults to the file name; pageSizes [w, h] per page lay out the document;
               // createdAt orders drawings in the document
Item           { id, inspectionId, letter, kind: 'instruction' | 'observation',
                 drawingId, page, x, y,   // x,y normalised 0..1 of page
                 text, requiresPhotoConfirmation, photoIds[], createdAt,
                 sequence,    // order on its page: placement order unless reordered
                 arrows[] }   // { id, x, y }: arrow tips, normalised 0..1 on the item's page
Photo          { id, blobId, originalBlobId?, originalSize?, source: 'camera' | 'library',
                 caption?, takenAt, width, height, savedAt? }
               // blobId: working copy (1600 px JPEG); originalBlobId: camera original, until freed
Memo           { id, inspectionId, templateId, reference, recipients[], siteVisitRequestedBy|null,
                 reasonForVisit|null, sentVia, salutation|null, bodySnippetId, bodyText,
                 conditionChoices{snippetId: bool}, itemOverrides{itemId: text},
                 signOffName, signOffTitle, signatureBlobId|null, includeSignature,
                 createdAt, updatedAt }
               // one per inspection; job details (client, address, date, job number/name,
               // item inspected, inspector) are read from the inspection, never copied; null = default.
               // The signature is the memo's own copy (PNG in blobs), so it travels with the inspection
MemoCounter    { jobNumber, lastSeq }   // drives SIM-001, SIM-002 ... per job number
MemoTemplate   { id, name, branding{ colours, logoBlobId, fonts }, fixedText{ disclaimer, officeBlock } }
               // POC: a single hard-coded Northrop template (see section 4a)
ObservationBox { id, drawingId, page, x, y }   // normalised 0..1 top-left; one per drawing page with pins
Snippet        { id, kind: 'body' | 'condition' | 'heading', label, text }   // 'heading' = observations box heading
Settings       { inspectorName, inspectorTitle, defaultSentVia, signatureBlobId?, ... }
               // signatureBlobId: my signature (PNG), copied into each new memo
// later
Markup         { id, drawingId, page, strokes[] }
Calculation    { id, type, inputs, outputs, createdAt }   // standalone history, no inspectionId, never exported with an inspection
```

Pin coordinates are stored relative to the page (0..1), so they stay correct at any zoom, device, or export resolution.

## 9. Inspection file (move between devices)

A single zip with a custom extension (e.g. `.inspection`) containing:
- `inspection.json` (all records above for that inspection, including its project, plus a `schemaVersion`)
- `drawings/` original PDFs
- `photos/` compressed photos

Rules: import never silently overwrites; if the same inspection id exists, ask (keep both / replace). Desktop uses the same app and its own local storage: import, edit, export PDF, optionally export the file back.

## 10. Offline and storage

- Service worker precaches the app shell; the app loads and works with no connection.
- Request **persistent storage** (`navigator.storage.persist()`) on first run.
- Show a storage meter and a clear **Back up now** action (exports the inspection file).
- iOS may evict a web app's stored data if it is unused for a long time. Mitigations: home-screen install, persistent storage request, prominent backup prompt after each inspection.
- Never store anything only in memory.

## 11. Tech stack

| Concern | Choice |
|---|---|
| Language/UI | TypeScript, React, Vite |
| PWA | vite-plugin-pwa (Workbox) |
| PDF render | pdfjs-dist |
| PDF write/export | pdf-lib (build the PDF directly, do not rely on browser print) |
| Local DB | Dexie (IndexedDB) |
| Photos | `<input type="file" accept="image/*" capture>` plus library picker; canvas for resize |
| Memo editing | structured form + light rich text for body blocks (TipTap or plain textarea for POC) |
| Fonts | Figtree (self-hosted, so it works offline and embeds in the PDF) |
| Calculators (later) | pure TS functions in `/src/engineering`, unit tested, no UI dependencies; UI lives in its own feature module (`src/features/calculators`) with no imports from the inspection/memo code |
| Tests | Vitest (unit), Playwright (key flows, iPad viewport) |

Brand tokens from the sample: red `#DA1A32`, cream `#FFF2DF`, dark maroon `#580B07`, body grey `#3B3B3B`, font Figtree. Page A4 (595 x 842 pt).

## 12. Screens

1. **Dashboard** (the first tab and the screen the app opens on): the Northrop wordmark, today's date, a greeting with the inspector's first name (from My details) and **New inspection**, then tiles (bento): **Continue where you left off** (the inspection edited last: its project badge, job, a live preview of its drawing page with the most pins, zoomed in around them with the pins drawn on top and redrawn when the iPad rotates, a three-part progress bar for the steps, counts of instructions, observations and photos, and a button for its next step: Assign a project, Add drawings, Open drawings, Create memo or Open memo); **Items logged** this month (big number, warm brand gradient); **Needs attention** (charcoal gradient: how many inspections need a project or have items but no memo, and the first three, each opening the step that fixes it; "All clear" when none); **Memos this month** (with the latest SIM reference); **Storage** (a ring, used and quota, and whether the iPad keeps the data). With no inspections and no projects it shows **Start your first inspection**.
1b. **Inspections** (the second tab; new, open, delete): one search box (inspections by item inspected, job or client, and projects), **New inspection**, then **Recent inspections** (the last 10 edited, as a table grouped This week / Earlier: inspection with its project badge, project with the client underneath, date (hidden in portrait) and a status chip: Needs a project in red; Memo SIM-NNN in green; "N items, no memo" in amber; No items yet); older inspections still needing a project are listed under it. Swipe a row left to show **Delete**; it asks first (the inspection, its drawings, items, photos and memos are removed), and a tap on an open row closes it. **Projects** sits beside it (below in portrait): searchable, most recent activity first, coloured initials badges, and **New project** (asks for a job number and name and opens it). **New inspection** asks for its project: choose one (searchable), start a new one (job number required; a job number already used, ignoring case and spaces, is flagged with **Use that project**, or **Create a new one anyway**), or **Skip for now** (flagged Needs a project). Inspections without a project open on Pre-inspection.
1a. **Project** page (cards, like Settings): its details (job number, job name, client, address; autosaved, flagged if another project has the same job number), its inspections with **New inspection**, its contacts (edit, add, remove) and **Delete project** (asks first, saying how many inspections, with their drawings, photos and memos, go with it; memo counters are kept).
2. **Inspection**: the screen header (a light row beside the rail) shows a round back button, the job and item inspected, and the steps as a pill switcher in the centre: Pre-inspection, Inspection, Site memo, each a link with its own address (so the browser's Back steps through them); a finished step shows a green tick and its status (e.g. "Job details done", "2 drawings · 5 items", "SIM-001") is read out to screen readers; the save state shows on the right. The back button returns to the screen the inspection was opened from (the Dashboard, the Inspections list, or its project's page; the Inspections list if unknown); a project opened from an inspection's Pre-inspection goes back to that inspection (remembered for the browser session). The steps: **Pre-inspection** (in landscape two columns: a project card with its badge, a link to it, **Change project** (its memo keeps its reference) and the project's details, marked as shared by every inspection in it; or, without one, a **Needs a project** card with **Create new project** (starting from the client and address it had) and **Assign to project**; beside it **This inspection** (item inspected, date, inspector), a **Next: the drawings** card with **Open drawings**, and Delete inspection), **Inspection** (the drawings viewer itself; with no drawings yet it shows the drawings list to add them) and **Site memo** (Create memo, then the memo editor, then Photos, then export later, each a card). A new inspection opens on Pre-inspection; an existing one on Inspection. Job details save automatically as you type (no Save button). Nothing is required to save; a missing job number or job name is flagged, and both are required before a memo is created (step 7). New inspections are dated today and take the inspector name from Settings. Deleting an inspection (after confirmation) removes its drawings, items, photos, memos and observation boxes; memo counters are kept so SIM references are never reused.
3. **Drawing viewer** (pan/zoom, drop pin, item sheet with instruction + photos). All of an inspection's drawings appear as **one continuous scrolling document** (GoodNotes style): every page of every drawing stacked vertically, in the order the drawings were added, each page shown at the same width, with the drawing's name above its first page. The document sits in a large rounded tile under the screen header. Its controls float over it, so they never move the drawing: a vertical charcoal pill on the left with **Add pin** (a red circle; while placing it turns white with a red ring and a red "Tap the drawing to place the pin" hint shows at the top), the **camera** (a general photo), Undo, Redo and **Fit page**; at the top right a chip with the current drawing and page (cut short with "…" if long) that opens the **Drawings** panel (add, rename and delete drawings; tapping one scrolls to it; **Add synthetic test drawing** is a small button under the list); at the bottom right **Items** with the item count. The current page is the one a third of the way down the view (so with two short pages on screen it names the one being read at the top). Only pages on or near the screen are rendered, and drawing PDFs are opened only while needed. It is the Inspection step; ?drawing= and ?item= links open it at a drawing or pin. An **Items** button opens a panel listing every item: observations, then instructions, each in letter order and grouped under a page subheading (e.g. "S-101 Level 3 · page 1"); rows show just the letter and text, in one list split by hairlines. Rows whose pins are on screen are highlighted (a faint tint with a dark left edge), updating when scrolling or zooming pauses. Tapping one scrolls to its pin and opens its sheet. Swiping a row left shows a **Delete** button (deletes at once, undoable). Items of the same kind on the same page have a drag handle (≡) to reorder them, which re-letters them and reorders the notes box; reordering across pages isn't possible because letters follow the document. **Undo** and **Redo** buttons (arrow icons) in the toolbar reverse and re-apply the latest pin added, item deleted, reorder, or arrow added, moved or removed (undoing an add removes the pin with anything typed since, and its notes box if it was the page's first pin); doing something new clears Redo. The history is per inspection and lasts until the app closes (the data itself is always saved). Later features (markup, edits) will add to the same Undo and Redo. Deleting a whole drawing still asks first. The item sheet is a side panel in landscape and below the drawing in portrait; opening it keeps the current zoom and pans only if the selected pin would be hidden.
4. **Memo editor** (the Site memo tab): **Create memo** (needs a job number and job name) gives the memo the job's next SIM reference and shows the editor, which the tab opens from then on. The editor is a column of cards (the memo and its reference, with the job details folded to a one-line summary and **Edit job details** to open them, shared with the inspection so editing them here changes them there; recipients, each with a **To | Copy** switch; visit details with the signature, where **Include signature** is a switch; letter; conditions; sign-off) beside a **live preview** in landscape, below it in portrait. The save state shows in the screen header. The preview is the real PDF built by the export renderer and drawn with pdf.js, so it shows exactly what will be exported, and works offline. Everything saves as you type.
5. **Export** (preview, generate PDF, share sheet)
6. **Settings**, as cards with a section list beside them in landscape (chips in portrait; tapping one jumps to it): (inspector details and signature (draw or upload; copied into new memos), storage, and **Prefilled messages**: memo messages, standard conditions and the notes box heading, shown as chips with counts, each message folded to its name and the start of its text and opened by a tap to edit as you type, with Add and Delete; message boxes use body-size text and grow to show all their text. A memo keeps its own copy of the message it chose; standard conditions and the heading are used live).

**Look (bento):** a charcoal rail on the left with the Northrop roundel, **Dashboard**, **Inspections** and **Settings** (icon over label) and the online dot (an amber Offline badge when offline); the strip behind the iPad's clock and battery is charcoal on every screen and content starts below it; screens inside an inspection or project have a light header row beside it. Warm grey page with white, borderless, large-radius tiles (thin outlines in dark mode); pill-shaped buttons, chips and switches; big tight-tracked Figtree numbers; a warm cream-to-peach gradient and a charcoal gradient on home's hero tiles; charcoal for selected things; Northrop red only for the main action on a screen and instruction pins; maroon page titles. Buttons are soft secondary by default, with primary (red), emphasis (charcoal), quiet and danger (red text) variants; one field style; colour, spacing, radius and type scales are tokens at the top of `src/app/styles.css` (design direction: `docs/reference/Site_Inspection_Companion_UI_Overhaul_Addendum.md`). Status colours (green done, amber to do, red needs attention) in the app only, never in the memo or PDF; Lucide icons (bundled, offline).  The app follows the device's **light or dark** setting; drawing pages, the notes box, the memo preview and the signature pad stay white in both, as printed.

Top-level navigation has separate areas: **Dashboard** and **Inspections** (screens 1 to 5), **Calculators** (slice 3, own screens, not linked to inspections or the memo), **Standard details** (slice 4), and **Settings**. In slice 1 only Inspections and Settings exist; the other entries are added in their own slices.

## 13. Build order

1. Project scaffold, PWA, offline shell, Dexie schema, deploy a "hello" to a shareable URL.
2. **Spike A:** pdf-lib export of a one-page memo that matches the sample, tested on a real iPad.
3. **Spike B:** PDF.js viewer with smooth pan/zoom and pin placement on iPad Safari.
4. Inspection CRUD + job details.
5. Drawings upload + viewer + lettered items.
6. Photos (camera/library, compression, attach to item).
7. Memo editor + snippets.
8. Full export pack (memo + marked-up drawings + appendix).
9. Inspection file export/import + backup prompts.
10. Hardening: offline tests, large-drawing performance, storage limits.

## 14. Risks

| Risk | Mitigation |
|---|---|
| PDF export fidelity on iPad Safari | Build PDF with pdf-lib, spike early |
| Large drawings (A1, many MB) slow on iPad | Render at device resolution only, lazy-render pages, test with real drawings early |
| iOS storage eviction / limits | Persistent storage request, storage meter, backup prompts |
| Pencil/touch gesture conflicts (pan vs draw) | Decided: fingers pan/zoom, Pencil reserved for drawing, pins only via an Add pin button (section 5) |
| Calculator correctness (later) | Every formula cites its AS 3600 clause, has unit tests against hand calcs, and is verified by the engineer before use |
| Company data and AI tool policy | Check policy before using real drawings or client data with any AI tool |

## 15. Assumptions and open questions

- [x] Lettered items can be instructions or neutral observations (decided). Observations go in a draggable text box on the drawing, not in the memo; heading defaults to "Noted for information:" (decided).
- [x] Memos get an auto-numbered reference per job (SIM-001...), shown together with the item inspected (decided; placed under Job name in the memo header, see sections 4 and 7a).
- [x] Drawings keep native size in the export (decided).
- [x] Branding hard-coded to Northrop for the POC (decided).
- [ ] Is "Aconex / Email" the full list for "Sent via"?
- [x] Re-inspections are out of scope for the POC (decided).
- [x] Hosting for the POC: GitHub Pages from David's personal GitHub account (decided). The site is public to anyone with the link (no password option on Pages), which is acceptable because the app has no backend and all user data stays on the device. Revisit hosting (company host or sign-in in front of the link) before wider sharing.
- [x] Real drawings may be used in the app (decided 2026-10-01): they are stored only on the device and never sent to GitHub, a server or an AI tool. The repo, test fixtures and AI chats stay synthetic, per company policy. Until backups (build step 9), keep original PDFs elsewhere: iOS can clear local web app data.
- [x] Figtree is self-hosted under the SIL Open Font License (decided). Web fonts come from the @fontsource/figtree package; static TTFs from the official Figtree repo are embedded in the PDF.
- [x] Memo body text is plain: the sample's italics on the item inspected, the body message and the condition bullets were placeholder highlighting. Bold and italic are kept only for the engineer name and the disclaimer, as in the sample (decided).
