/**
 * Signature images: drawn on the signing pad or uploaded (a PNG, or a photo
 * of a signature on paper). Stored as a PNG with a see-through background,
 * cropped to the ink, so it sits cleanly on the memo.
 */
import { fitWithin } from "../photos/processPhoto";

/** Uploaded signatures are scaled down to this long edge (plenty for print). */
export const SIGNATURE_LONG_EDGE = 1200;

/** Blank space kept around the ink when cropping, in pixels. */
const PADDING = 8;

/** Pixels fainter than this (0-255 alpha) don't count as ink when cropping. */
const MIN_INK_ALPHA = 16;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The smallest box holding all the ink, plus padding; null if blank. */
export function inkBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  padding = PADDING,
): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] < MIN_INK_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + padding) - x,
    height: Math.min(height, maxY + 1 + padding) - y,
  };
}

/** True when the image already has a see-through background. */
export function hasTransparency(rgba: Uint8ClampedArray): boolean {
  let clear = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) clear++;
  // A few soft edge pixels don't count; a real cut-out has many.
  return clear > rgba.length / 4 / 100;
}

const luminance = (rgba: Uint8ClampedArray, i: number) =>
  0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];

/**
 * Makes the paper see-through, in place: pixels as light as the paper
 * vanish, darker ones (the ink) keep their colour and become more opaque
 * the darker they are. The paper's shade is measured from the image (the
 * 90th-percentile brightness), so grey-looking paper in a photo works too.
 */
export function removePaper(rgba: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256);
  const pixels = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4)
    histogram[Math.round(luminance(rgba, i))]++;
  let paper = 255;
  for (let level = 0, seen = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen >= pixels * 0.9) {
      paper = level;
      break;
    }
  }
  // Fully clear just below the paper's shade; fully opaque well below it.
  const clearAt = paper * 0.9;
  const solidAt = paper * 0.55;
  for (let i = 0; i < rgba.length; i += 4) {
    const l = luminance(rgba, i);
    const ink = Math.min(1, Math.max(0, (clearAt - l) / (clearAt - solidAt)));
    rgba[i + 3] = Math.round(rgba[i + 3] * ink);
  }
}

async function encodePng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode signature"))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** Crops a canvas to its ink and encodes it; null if nothing is drawn. */
export async function cropToPng(
  source: HTMLCanvasElement,
  rgba?: ImageData,
): Promise<Uint8Array | null> {
  const ctx = source.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const data = rgba ?? ctx.getImageData(0, 0, source.width, source.height);
  const box = inkBounds(data.data, data.width, data.height);
  if (!box) return null;
  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas unavailable");
  outCtx.putImageData(data, -box.x, -box.y);
  try {
    return await encodePng(out);
  } finally {
    // Release canvas memory straight away (iPad Safari limits it).
    out.width = 0;
    out.height = 0;
  }
}

/**
 * An uploaded image as a signature: upright (the browser applies EXIF
 * orientation when decoding), scaled down, the paper made see-through
 * unless it already has a transparent background, then cropped.
 * Null if no ink is found.
 */
export async function imageToSignaturePng(
  file: Blob,
): Promise<Uint8Array | null> {
  const url = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = fitWithin(
      img.naturalWidth,
      img.naturalHeight,
      SIGNATURE_LONG_EDGE,
    );
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const data = ctx.getImageData(0, 0, size.width, size.height);
    if (!hasTransparency(data.data)) removePaper(data.data);
    return await cropToPng(canvas, data);
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
