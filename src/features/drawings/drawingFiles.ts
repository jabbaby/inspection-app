/** Adding drawing PDFs (the Drawings card and the Pages view share it). */
import { db } from "../../db/db";
import { addDrawing } from "../../db/drawings";

/** Opens the PDF to check it and count its pages, then stores it. */
export async function storePdf(
  inspectionId: string,
  name: string,
  bytes: Uint8Array,
) {
  const { loadPdf } = await import("./pdf/pdfjs");
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await loadPdf(bytes.slice());
  const pageCount = pdf.numPages;
  const { measurePageSizes } = await import("./pdf/pageSizes");
  const pageSizes = await measurePageSizes(pdf);
  await pdf.loadingTask.destroy();
  await addDrawing(db, inspectionId, {
    name,
    pdf: bytes,
    pageCount,
    pageSizes,
  });
}
