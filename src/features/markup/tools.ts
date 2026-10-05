/** The markup toolbar's tools (SPEC section 5a); null means none is on. */
export type ViewerTool = "pin" | "pen" | "highlighter" | "eraser";

/** Tools that draw or erase with the Pencil (or a finger, with the toggle). */
export function isInkTool(tool: ViewerTool | null): boolean {
  return tool === "pen" || tool === "highlighter" || tool === "eraser";
}

/** A saved mark as the viewer shows it (SPEC section 5a). */
export interface DocMark {
  id: string;
  /** documentLayout's page key (drawing and position). */
  pageKey: string;
  tool: "pen" | "highlighter";
  /** Normalised points, flat: x0, y0, x1, y1... */
  points: number[];
  colour: string;
  /** Fraction of the sheet's short side. */
  weight: number;
}
