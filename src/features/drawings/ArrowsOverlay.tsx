import { northrop } from "../../brand/northrop";
import type { ItemArrow, ItemKind } from "../../db/types";
import { arrowMetrics, arrowShape } from "./arrows";
import { useViewerCoords } from "./viewer/viewerCoords";

interface ArrowItem {
  id: string;
  kind: ItemKind;
  /** Pin position, normalised on the page. */
  x: number;
  y: number;
  arrows: ItemArrow[];
}

/**
 * Arrows from each pin on a page to the spots it refers to, drawn in page
 * units so they zoom with the drawing and match the exported PDF. The pin
 * covers the start of the line; the head sits on the spot.
 */
export function ArrowsOverlay({ items }: { items: ArrowItem[] }) {
  const { pageSize } = useViewerCoords();
  const { width, height } = pageSize;
  const m = arrowMetrics(pageSize);
  return (
    <svg
      className="arrows-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {items.flatMap((item) =>
        item.arrows.map((arrow) => {
          const shape = arrowShape(
            { x: item.x * width, y: item.y * height },
            { x: arrow.x * width, y: arrow.y * height },
            pageSize,
          );
          if (!shape) return null;
          const colour =
            item.kind === "instruction"
              ? northrop.colours.red
              : northrop.markup.blue;
          const [a, b] = shape.line;
          return (
            <g key={`${item.id}:${arrow.id}`} data-testid="arrow">
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={colour}
                strokeWidth={m.strokeWidth}
                strokeLinecap="round"
              />
              <polygon
                points={shape.head.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={colour}
              />
            </g>
          );
        }),
      )}
    </svg>
  );
}
