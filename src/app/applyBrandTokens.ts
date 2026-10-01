import { northrop } from "../brand/northrop";

/** Expose brand values as CSS custom properties so CSS never hard-codes them. */
export function applyBrandTokens(root: HTMLElement = document.documentElement) {
  const { colours, font, markup } = northrop;
  root.style.setProperty("--brand-red", colours.red);
  root.style.setProperty("--brand-cream", colours.cream);
  root.style.setProperty("--brand-maroon", colours.maroon);
  root.style.setProperty("--brand-grey", colours.grey);
  root.style.setProperty("--brand-font", `"${font.family}"`);
  root.style.setProperty("--markup-blue", markup.blue);
  root.style.setProperty("--markup-header", markup.header);
  root.style.setProperty("--notes-font", `"${markup.notesFont}"`);
}
