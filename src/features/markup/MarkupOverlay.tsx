import { memo, useMemo } from "react";
import { useViewerCoords } from "../drawings/viewer/viewerCoords";
import { markPath, markStyle } from "./markGeometry";
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
      marks.map((mark) => ({
        mark,
        d: markPath(mark, { width, height }),
        style: markStyle(mark, { width, height }),
      })),
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
      {paths.map(({ mark, d, style }) => {
        return (
          <path
            key={mark.id}
            data-testid="mark"
            data-tool={mark.tool}
            d={d}
            fill="none"
            stroke={style.colour}
            strokeOpacity={style.opacity}
            strokeWidth={style.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
});
