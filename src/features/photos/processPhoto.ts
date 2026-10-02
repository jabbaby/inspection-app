/**
 * Turns a camera or library image into what the app stores (SPEC section
 * 6): a JPEG working copy about 1600 px on the long edge at quality 0.8,
 * the right way up, plus (for camera shots) the original file untouched so
 * it can be saved to the iPad at native resolution.
 */
import type { NewPhoto } from "../../db/photos";
import type { Photo } from "../../db/types";

export const PHOTO_LONG_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;

/** Scales a size down (never up) so its long edge is at most `longEdge`. */
export function fitWithin(
  width: number,
  height: number,
  longEdge = PHOTO_LONG_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Decodes an image the right way up and re-encodes it as the working copy.
 * The camera records which way up a photo was taken as an EXIF flag rather
 * than rotating the pixels; Safari and Chrome apply that flag when decoding
 * an <img> (CSS image-orientation: from-image is the default), so its
 * natural size and drawImage() are already upright. The canvas JPEG has no
 * EXIF, so the copy can never be rotated twice.
 */
async function workingCopy(
  file: Blob,
): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode photo"))),
        "image/jpeg",
        PHOTO_QUALITY,
      ),
    );
    // Release the canvas memory straight away (iPad Safari limits it).
    canvas.width = 0;
    canvas.height = 0;
    return { data: await jpeg.arrayBuffer(), ...size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processPhoto(
  file: File,
  source: Photo["source"],
): Promise<NewPhoto> {
  const copy = await workingCopy(file);
  return {
    ...copy,
    type: "image/jpeg",
    takenAt: file.lastModified || Date.now(),
    source,
    // Library picks are already in Photos at full size.
    ...(source === "camera"
      ? {
          original: {
            data: await file.arrayBuffer(),
            type: file.type || "image/jpeg",
          },
        }
      : {}),
  };
}
