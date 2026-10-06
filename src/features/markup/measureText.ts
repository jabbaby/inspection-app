/**
 * Text widths in Arial for callouts on screen and in the pinch snapshot
 * (Helvetica, used in the PDF, has the same widths).
 */
let ctx: CanvasRenderingContext2D | null | undefined;

/** Width of `text` at `size` (any unit: it scales with the size). */
export function measureArial(text: string, size: number): number {
  if (ctx === undefined)
    ctx = document.createElement("canvas").getContext("2d");
  // No canvas (tests): an average capital's width.
  if (!ctx) return text.length * size * 0.67;
  // Measured at 100 px and scaled: tiny sizes measure poorly.
  ctx.font = "100px Arial, Helvetica, sans-serif";
  return (ctx.measureText(text).width * size) / 100;
}
