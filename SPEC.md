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
| Client name | text |
| Client company name | text |
| Address line 1 / 2 | text |
| Date | defaults to today |
| Job number | text |
| Job name | text |
| Memo reference | auto-generated per job (e.g. `SIM-001`, `SIM-002`), editable. Shown in the memo header with the item inspected, e.g. "SIM-001 – Level 3 slab reinforcement". The sample template has no reference field; it is placed in the right-hand header column on its own line under Job name, in the same style as Job name. |
| Recipients table | up to ~5 rows: Company, Attn, and To or Copy (checkbox pair; at least one "To") |
| Site visit requested by | client name/company |
| Reason for visit | the item inspected (e.g. "Level 3 slab reinforcement"); prefilled from the inspection's Item inspected |
| Inspector | the engineer's name |
| Sent via | Aconex / Email (select) |
| Salutation | "Dear [name]," |
| Item inspected | used in the body sentence; prefilled from the inspection's Item inspected (a job details field, also shown in the observations box header) |
| Body paragraph 1 | "We confirm having inspected the [item inspected] as highlighted on the drawing attached." |
| Body paragraph 2 | pick from **prefilled messages** (see below) |
| Conditions list | One lead-in line, then bullets generated from the instruction items and extra standard clauses. With one or more instruction items the lead-in is "Ok to proceed subject to the following:" (same for every body message, as in the sample). With no instruction items the memo shows "Ok to proceed." and no list. |
| Sign-off | engineer name and title |

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

- **Instructions and observations are lettered separately**, each in **document order**: by drawing (the order drawings were added), then page, then the order the pins were placed on that page. Instructions run A, B, C ... Z, then AA, AB ..., and observations A, B, C ... the same way. So a pin added later on an earlier page takes its place in the sequence and the pins after it move along (pin on page 2 is A; a new pin on page 1 becomes A and page 2's becomes B). An instruction A and an observation A can both exist; they are told apart by pin colour, and the app always names the kind ("Instruction A", "Observation A"). Deleting an item (or a drawing) re-letters the remaining items of that kind so there are no gaps: delete instruction C and instruction D becomes C. Switching an item's kind moves it to the other sequence (at its document-order position) and re-letters both. Memos are checked before sending; build step 8 warns before deleting once a memo has been exported.
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
- **Item sheet:** placing a pin creates an item and opens its sheet. New items start as **instruction** with the cursor in the text box; an Instruction | Observation switch changes the kind at any time. Instructions have the "photo confirmation required before proceeding" option. Text saves as you type. Tapping a pin reopens its sheet.
- **Pin style:** instructions are filled red circles with a white letter; observations are filled markup-blue (`#0165FC`) circles with a white letter.
- Letters are always derived from the items and drawings (no stored counter); a new pin starts as an instruction lettered by its place in the document.
- Wherever items are listed (inspection home, the viewer's Items panel), they are grouped under an **Observations** heading (A, B ...) and then an **Instructions** heading (A, B ...), matching the notes box.
- **Gesture model (GoodNotes style, decided in Spike B):** one finger scrolls, two fingers pinch to zoom. Scrolling is the browser's own (native scrolling): on iPad that is Safari's 120 Hz scrolling with iOS momentum and bounce, and on other platforms their own scrolling. At fit width (and below) the document is exactly as wide as the view, so it never moves sideways; zoomed in, it scrolls in any direction. A touch that lands while the document is scrolling only stops it; it never places a pin or opens one. Pinch is handled by the app (touch events, as in pdf.js's viewer). Apple Pencil never scrolls the document. With a mouse, dragging pans, the wheel scrolls and ctrl+wheel (or a trackpad pinch) zooms. Android and Windows tablets should get their own native scrolling but are untested; pen handling there relies on the standard pen pointer type. Pins are placed only through an **Add pin** button: tap it, then tap the drawing (finger, Apple Pencil or mouse); the mode ends after one pin. Taps never place pins otherwise, so the Apple Pencil stays free for freehand markup (slice 2). Pins can be dragged to move them.
- Fields per item: letter, kind, drawing + page, position, text, photos (0..n), `requiresPhotoConfirmation` (bool, only meaningful for instructions). No open/closed status in the POC (re-inspections are out of scope).

## 6. Photos

- Add from the camera or photo library.
- Photos attach to an item and also appear in the **photo appendix** at the end of the PDF pack, grouped by item (e.g. Instruction A) with captions.
- Compress on import (target long edge about 1600 px, JPEG ~0.8) to keep local storage and PDF size sensible. Keep EXIF orientation correct.
- Storage is the main offline risk on iPad (see section 10).

## 7. PDF export pack

One PDF, in this order:
1. Memo page(s) (branded, A4).
2. Marked-up drawing page(s): the original PDF pages that have pins, with lettered markers and (where there are observations) the observations text box burned in. **Each page keeps its native size** (the PDF will mix an A4 memo with larger drawing sheets). Marker size is defined relative to page size so letters stay legible on A1/A3 sheets. Watch file size and test with real large drawings.
3. Photo appendix: photos by item (e.g. Instruction A) with captions.

Export must work offline.

### 7a. Memo reference and filename

- Reference format `SIM-NNN`, counted per job number, generated when the memo is created and editable afterwards.
- Because there is no sync, two devices could both create `SIM-002` for the same job. Mitigation for the POC: memos are created on the iPad, desktop is for editing imported inspections, and the reference stays editable. Flag this for the sync phase.
- Exported filename: `{jobNumber}_{reference}_{itemInspected}.pdf` (sanitised).

## 8. Data model

Stored locally in IndexedDB. File bytes (PDFs, photos) are stored in a `blobs` table as ArrayBuffer records `{ id, data, type, size }` and referenced by id. (Not Blob objects: Blob storage in IndexedDB is not supported by every WebKit build.)

```ts
Project        { id, name?, createdAt }                    // optional grouping; may be dropped for POC
Inspection     { id, jobNumber, jobName, itemInspected, client{...}, date, inspector, status,
                 createdAt, updatedAt }
Drawing        { id, inspectionId, name, pdfBlobId, pageCount, fileSize, pageSizes, createdAt }
               // name defaults to the file name; pageSizes [w, h] per page lay out the document;
               // createdAt orders drawings in the document
Item           { id, inspectionId, letter, kind: 'instruction' | 'observation',
                 drawingId, page, x, y,   // x,y normalised 0..1 of page
                 text, requiresPhotoConfirmation, photoIds[], createdAt }
Photo          { id, blobId, caption?, takenAt, width, height }
Memo           { id, inspectionId, templateId, reference, fields{...}, bodyBlocks[], conditionBlocks[], updatedAt }
MemoCounter    { jobNumber, lastSeq }   // drives SIM-001, SIM-002 ... per job number
MemoTemplate   { id, name, branding{ colours, logoBlobId, fonts }, fixedText{ disclaimer, officeBlock } }
               // POC: a single hard-coded Northrop template (see section 4a)
ObservationBox { id, drawingId, page, x, y }   // normalised 0..1 top-left; one per drawing page with pins
Snippet        { id, kind: 'body' | 'condition' | 'heading', label, text }   // 'heading' = observations box heading
Settings       { inspectorName, inspectorTitle, defaultSentVia, ... }
// later
Markup         { id, drawingId, page, strokes[] }
Calculation    { id, type, inputs, outputs, createdAt }   // standalone history, no inspectionId, never exported with an inspection
```

Pin coordinates are stored relative to the page (0..1), so they stay correct at any zoom, device, or export resolution.

## 9. Inspection file (move between devices)

A single zip with a custom extension (e.g. `.inspection`) containing:
- `inspection.json` (all records above for that inspection, plus a `schemaVersion`)
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

1. **Inspections list** (new, open, import, back up)
2. **Inspection home** (job details, drawings, items summary, memo, export). Job details save automatically as you type (no Save button). Nothing is required to save; a missing job number or job name is flagged, and both are required before a memo is created (step 7). New inspections are dated today and take the inspector name from Settings. Deleting an inspection (after confirmation) removes its drawings, items, photos, memos and observation boxes; memo counters are kept so SIM references are never reused.
3. **Drawing viewer** (pan/zoom, drop pin, item sheet with instruction + photos). All of an inspection's drawings appear as **one continuous scrolling document** (GoodNotes style): every page of every drawing stacked vertically, in the order the drawings were added, each page shown at the same width, with the drawing's name above its first page. A label shows the current drawing and page; **Fit page** fits the current page. Only pages on or near the screen are rendered, and drawing PDFs are opened only while needed. Opened from the inspection home's Drawings list (scrolls to that drawing) or Items list (scrolls to that pin). An **Items** button opens a panel listing every item (observations, then instructions, each in letter order); tapping one scrolls to its pin and opens its sheet. The item sheet is a side panel in landscape and below the drawing in portrait; opening it keeps the current zoom and pans only if the selected pin would be hidden.
4. **Memo editor** (live preview of the branded page, field editing, snippet picker)
5. **Export** (preview, generate PDF, share sheet)
6. **Settings** (inspector details, snippets, template, storage)

Top-level navigation has separate areas: **Inspections** (screens 1 to 5), **Calculators** (slice 3, own screens, not linked to inspections or the memo), **Standard details** (slice 4), and **Settings**. In slice 1 only Inspections and Settings exist; the other entries are added in their own slices.

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
