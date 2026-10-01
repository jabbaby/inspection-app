/**
 * Northrop brand values for the POC (SPEC 4a). All brand values live here so
 * a later swap only touches this module. Logo, office block, disclaimer and
 * strapline are added in Spike A (memo export).
 */
export const northrop = {
  name: "Northrop",
  colours: {
    red: "#DA1A32",
    cream: "#FFF2DF",
    maroon: "#580B07",
    grey: "#3B3B3B",
  },
  font: {
    family: "Figtree",
  },
  /** A4 portrait in PDF points. */
  page: {
    width: 595,
    height: 842,
  },
} as const;
