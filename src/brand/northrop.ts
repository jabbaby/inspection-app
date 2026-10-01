/**
 * Northrop brand values for the POC (SPEC 4a). All brand values live here so
 * a later swap only touches this module. Layout code (memo PDF, app CSS)
 * reads from here and never embeds brand values itself.
 *
 * Fixed text is copied verbatim from docs/reference/Northrop_sample_report.docx.
 * Do not reword it.
 */

const asset = (path: string) => new URL(path, import.meta.url).href;

export const northrop = {
  name: "Northrop",
  colours: {
    red: "#DA1A32",
    cream: "#FFF2DF",
    maroon: "#580B07",
    grey: "#3B3B3B",
    /** Table rules in the memo. */
    rule: "#B0B0B0",
    /** Disclaimer text in the memo. */
    muted: "#898989",
  },
  font: {
    family: "Figtree",
  },
  /** A4 portrait in PDF points. */
  page: {
    width: 595.28,
    height: 841.89,
  },
  memoTitle: "SITE INSTRUCTION MEMO",
  officeBlock: [
    "Level 10, 400 George St",
    "Sydney NSW 2000",
    "02 9241 4188",
    "sydney@northrop.com.au",
    "ABN 81 094 433 100",
  ],
  /** First sentence is bold in the memo; the rest follows in italic. */
  disclaimer: {
    lead: "Site safety remains the responsibility of the builder.",
    body: "Any inspection carried out by Northrop Consulting Engineers Pty Ltd does not relieve the Contractor of their responsibility to construct the structure in accordance with the drawings and specifications. Statements set out here do not relieve the Contractor of his obligations to obtain approvals from authorities having jurisdiction over the works. This does not constitute authorisation for a contract variation unless stated in the instruction. No claim will be accepted unless approval of variation is obtained before any work proceeds.",
  },
  strapline: ["REAL PEOPLE", "REAL PARTNERSHIPS", "REAL IMPACT"],
  /** Asset URLs (bundled by Vite, precached for offline use). */
  assets: {
    /** Cream wordmark for the red sidebar (sample image1.png). */
    wordmarkCream: asset("./assets/northrop-wordmark-cream.png"),
    /** Red "N" roundel for the footer (sample image3.png). */
    icon: asset("./assets/northrop-icon.png"),
    /** Static Figtree TTFs for PDF embedding (SIL OFL, see assets/fonts/OFL.txt). */
    fonts: {
      regular: asset("./assets/fonts/Figtree-Regular.ttf"),
      italic: asset("./assets/fonts/Figtree-Italic.ttf"),
      semiBold: asset("./assets/fonts/Figtree-SemiBold.ttf"),
      bold: asset("./assets/fonts/Figtree-Bold.ttf"),
      boldItalic: asset("./assets/fonts/Figtree-BoldItalic.ttf"),
    },
  },
} as const;
