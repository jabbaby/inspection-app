/**
 * What's new, by milestone (engineer, 2026-10-07: milestones only), newest
 * first. Shown in Settings, About. Add an entry when the version goes up.
 */
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.2.0",
    date: "7 October 2026",
    items: [
      "Pencil markup: pen, highlighter (fluoro colours), line, arrow, rectangle, ellipse and revision cloud, in colour slots and three weights",
      "Draw and hold: a held stroke becomes a straight line, or a clean circle, rectangle, triangle or polygon you can resize before lifting",
      "Text callouts with dog-leg arrows, placed and moved like pins; pin arrows are dog legs too",
      "Select: tap or loop round marks to move, resize, rotate (one shape or a group), recolour, change weight, duplicate, delete or edit callouts",
      "General notes: observations with no pin, listed in every page's notes box",
      "Eraser, and undo with a two-finger double-tap",
      "Markup in the PDF pack and in inspection files",
      "Photo confirmation shown against each instruction in the memo",
      "The Dashboard opens any step of the last inspection",
      "A user guide and a features and limitations document, here in About, opening in the app with a Back button",
    ],
  },
  {
    version: "0.1.0",
    date: "5 October 2026",
    items: [
      "Projects and inspections, with a Dashboard and an Inspections list",
      "Drawings as one continuous document, with a Pages view to duplicate, hide and reorder pages",
      "Lettered instruction and observation pins, with arrows, copy pins and a notes box on each page",
      "Photos from the camera or library, with captions and saving to the iPad",
      "The Site Instruction Memo, with prefilled messages, recipients, signature and a live preview",
      "The PDF pack: memo, marked-up drawings and photo appendix",
      "Inspection files for backup and moving between devices; works offline",
    ],
  },
];
