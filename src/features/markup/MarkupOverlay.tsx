import { useViewerCoords } from "../drawings/viewer/viewerCoords";
import { markPath, markStyle } from "./markGeometry";
import type { DocMark } from "./tools";

/**
 * A page's pen and highlighter marks, drawn in page units so they zoom
 * with the drawing and match the exported PDF (markGeometry.ts). Under the
 * arrows, notes box and pins.
 */
export function MarkupOverlay({ marks }: { marks: DocMark[] }) {
  const { pageSize } = useViewerCoords();
  const { width, height } = pageSize;
  if (marks.length === 0) return null;
  return (
    <svg
      className="markup-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {marks.map((mark) => {
        const style = markStyle(mark, pageSize);
        return (
          <path
            key={mark.id}
            data-testid="mark"
            data-tool={mark.tool}
            d={markPath(mark, pageSize)}
            fill="none"
            stroke={style.colour}
            strokeOpacity={style.opacity}
            strokeWidth={style.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              mark.tool === "highlighter" ? "mark-highlight" : undefined
            }
          />
        );
      })}
    </svg>
  );
}
