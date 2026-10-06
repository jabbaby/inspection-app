import { memo, useMemo } from "react";
import { useViewerCoords } from "../drawings/viewer/viewerCoords";
import {
  SHAPE_FILL_OPACITY,
  drawMark,
  isFilled,
  markStyle,
} from "./markGeometry";
import type { DocMark } from "./tools";

/**
 * A page's pen and highlighter marks, drawn in page units so they zoom
 * with the drawing and match the exported PDF (markGeometry.ts). Under the
 * arrows, notes box and pins. Highlights are see-through on screen (the PDF
 * also multiplies them; a blend mode here would make Safari blend the whole
 * page on every frame). Paths are worked out once per set of marks.
 */
export const MarkupOverlay = memo(function MarkupOverlay({
  marks,
}: {
  marks: DocMark[];
}) {
  const { pageSize } = useViewerCoords();
  const { width, height } = pageSize;
  const paths = useMemo(
    () =>
      marks.map((mark) => {
        const drawing = drawMark(mark, { width, height });
        return {
          mark,
          drawing,
          filled: isFilled(mark, drawing),
          style: markStyle(mark, { width, height }),
        };
      }),
    [marks, width, height],
  );
  if (marks.length === 0) return null;
  return (
    <svg
      className="markup-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {paths.map(({ mark, drawing, filled, style }) => (
        <g
          key={mark.id}
          data-testid="mark"
          data-tool={mark.tool}
          data-colour={mark.colour}
          data-filled={filled}
        >
          <path
            d={drawing.d}
            fill={filled ? style.colour : "none"}
            fillOpacity={SHAPE_FILL_OPACITY}
            stroke={style.colour}
            strokeOpacity={style.opacity}
            strokeWidth={style.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {drawing.head && <path d={drawing.head} fill={style.colour} />}
        </g>
      ))}
    </svg>
  );
});
