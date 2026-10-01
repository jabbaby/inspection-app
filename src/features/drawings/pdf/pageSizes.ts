import type { PDFDocumentProxy } from "./pdfjs";

/** Each page's [width, height] in points, as displayed (rotation applied). */
export async function measurePageSizes(
  pdf: PDFDocumentProxy,
): Promise<[number, number][]> {
  const sizes: [number, number][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    sizes.push([width, height]);
    page.cleanup();
  }
  return sizes;
}
