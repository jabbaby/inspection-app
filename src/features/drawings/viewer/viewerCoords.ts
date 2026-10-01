import { createContext, useContext } from "react";
import type { Point, Size } from "./viewTransform";

export interface ViewerCoords {
  /** Page size in page units (PDF points). */
  pageSize: Size;
  /** Normalised page position under a client (viewport) point; may be outside 0..1. */
  clientToNormalised: (clientX: number, clientY: number) => Point;
}

/** Lets overlay content (e.g. the observations box) convert pointer positions. */
export const ViewerCoordsContext = createContext<ViewerCoords | null>(null);

export function useViewerCoords(): ViewerCoords {
  const coords = useContext(ViewerCoordsContext);
  if (!coords)
    throw new Error("useViewerCoords must be used inside DrawingViewer");
  return coords;
}
