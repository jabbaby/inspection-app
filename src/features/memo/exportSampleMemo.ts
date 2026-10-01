// Spike A only: builds the synthetic sample memo. Loaded on demand so pdf-lib
// stays out of the start-up bundle. Replaced by the memo editor in step 7.
import { memoFilename } from "./memoFilename";
import { loadMemoAssets } from "./pdf/loadMemoAssets";
import { renderMemoPdf } from "./pdf/renderMemoPdf";
import { sampleMemo } from "./sampleMemo";

export async function buildSampleMemoPdf(): Promise<File> {
  const bytes = await renderMemoPdf(sampleMemo, await loadMemoAssets());
  const { jobNumber, itemInspected } = sampleMemo.fields;
  const name = memoFilename(jobNumber, sampleMemo.reference, itemInspected);
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}
