import type { MarkKind } from "../../db/types";

/** The markup toolbar's tools (SPEC section 5a); null means none is on. */
export type ViewerTool =
  "pin" | "pen" | "highlighter" | "shapes" | "text" | "eraser";

/** Tools that draw or erase with the Pencil (or a finger, with the toggle). */
export function isInkTool(tool: ViewerTool | null): boolean {
  return (
    tool === "pen" ||
    tool === "highlighter" ||
    tool === "shapes" ||
    tool === "eraser"
  );
}

/** A saved mark as the viewer shows it (SPEC section 5a). */
export interface DocMark {
  id: string;
  /** documentLayout's page key (drawing and position). */
  pageKey: string;
  tool: MarkKind;
  /** Closed shapes: false once the fill was taken off (default filled). */
  fill?: boolean;
  /** Text callouts: what they say. */
  text?: string;
  /** Text callouts: the box was resized by hand (its width stays). */
  fixedWidth?: boolean;
  /** Normalised points, flat: x0, y0, x1, y1... */
  points: number[];
  colour: string;
  /** Fraction of the sheet's short side. */
  weight: number;
}
