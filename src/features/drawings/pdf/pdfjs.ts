import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Rendering runs in a worker so the UI stays responsive on large sheets.
GlobalWorkerOptions.workerSrc = workerUrl;

// Runtime data emitted by pdfjs-assets.plugin.ts and precached.
const data = `${import.meta.env.BASE_URL}pdfjs/`;

/** Opens a PDF from bytes. Works offline: nothing is fetched from a CDN. */
export function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({
    data: bytes,
    cMapUrl: `${data}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${data}standard_fonts/`,
    iccUrl: `${data}iccs/`,
    wasmUrl: `${data}wasm/`,
  }).promise;
}

export type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
