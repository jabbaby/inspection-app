import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { cropToPng } from "./signatureImage";

/** A point in pad units: the pad's width is 1, so strokes survive resizes. */
interface Point {
  x: number;
  y: number;
  /** 0..1; 0.5 for fingers and mice (no pressure). */
  pressure: number;
}

export interface SignaturePadHandle {
  /** The drawing cropped to the ink as a PNG; null if nothing is drawn. */
  toPng(): Promise<Uint8Array | null>;
  clear(): void;
}

const INK = "#000";
/** Line width at normal pressure, as a share of the pad's width. */
const LINE = 0.0042;

/**
 * A signing pad for Apple Pencil, finger or mouse. Every sample the device
 * reports is drawn as it arrives: the pointer events Safari coalesces
 * between frames (Apple Pencil reports at 240 Hz) are unpacked with
 * getCoalescedEvents() and drawn straight onto the canvas in the event
 * handler, so the line keeps up with the pen at ProMotion's 120 Hz. Pencil
 * pressure varies the line width. Once the Pencil has been used, finger
 * touches are ignored so a resting palm doesn't draw.
 */
export function SignaturePad({
  ref,
  onChange,
}: {
  ref?: Ref<SignaturePadHandle>;
  /** Called with whether anything is drawn. */
  onChange?: (hasInk: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const active = useRef<{ id: number; stroke: Point[] } | null>(null);
  const penUsed = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const changed = (ink: boolean) => {
    setHasInk(ink);
    onChange?.(ink);
  };

  useImperativeHandle(ref, () => ({
    toPng: async () => {
      const canvas = canvasRef.current;
      return canvas && strokes.current.length ? cropToPng(canvas) : null;
    },
    clear: () => {
      strokes.current = [];
      active.current = null;
      redraw();
      changed(false);
    },
  }));

  function context() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  /** Draws a stroke's piece ending at point n (smoothed through midpoints). */
  function drawTail(stroke: Point[], n = stroke.length) {
    const ctx = context();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const p = stroke[n - 1];
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = w * LINE * (0.5 + p.pressure);
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * w, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const a = stroke[n - 2];
    const before = n > 2 ? stroke[n - 3] : a;
    const start = { x: (before.x + a.x) / 2, y: (before.y + a.y) / 2 };
    const end = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(start.x * w, start.y * w);
    ctx.quadraticCurveTo(a.x * w, a.y * w, end.x * w, end.y * w);
    ctx.stroke();
  }

  function redraw() {
    const ctx = context();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.current)
      for (let n = 1; n <= stroke.length; n++) drawTail(stroke, n);
  }

  // Size the canvas to its box at the screen's resolution, and again when
  // it changes (rotation); strokes are kept in pad units and redrawn.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (width === canvas.width && height === canvas.height) return;
      canvas.width = width;
      canvas.height = height;
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    // Stop iOS treating a finger on the pad as a scroll or text selection.
    const stop = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchstart", stop, { passive: false });
    return () => {
      observer.disconnect();
      canvas.removeEventListener("touchstart", stop);
      canvas.width = 0;
      canvas.height = 0;
    };
    // redraw reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A finger-up lost outside the pad must still end the stroke.
  useEffect(() => {
    const end = (e: PointerEvent) => {
      if (active.current?.id === e.pointerId) active.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function point(e: PointerEvent, rect: DOMRect): Point {
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.width,
      pressure: e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        aria-label="Signing pad"
        data-testid="signature-pad"
        data-ink={hasInk}
        onPointerDown={(e) => {
          if (e.pointerType === "pen") penUsed.current = true;
          else if (e.pointerType === "touch" && penUsed.current) return;
          if (active.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const stroke = [
            point(e.nativeEvent, e.currentTarget.getBoundingClientRect()),
          ];
          strokes.current.push(stroke);
          active.current = { id: e.pointerId, stroke };
          drawTail(stroke);
          if (!hasInk) changed(true);
        }}
        onPointerMove={(e) => {
          const current = active.current;
          if (!current || current.id !== e.pointerId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
          for (const sample of samples.length ? samples : [e.nativeEvent]) {
            current.stroke.push(point(sample, rect));
            drawTail(current.stroke);
          }
        }}
        onPointerUp={(e) => {
          if (active.current?.id === e.pointerId) active.current = null;
        }}
        onPointerCancel={(e) => {
          if (active.current?.id === e.pointerId) active.current = null;
        }}
      />
      <span className="signature-pad-line" aria-hidden="true" />
    </div>
  );
}
