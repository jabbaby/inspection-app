/** Building inspection files for Back up now and Back up all. */
import { appCommit, appVersion } from "../../app/version";
import { collectInspection, markBackedUp } from "../../db/backup";
import { db } from "../../db/db";
import { loadJobInspection } from "../../db/projects";
import { todayIso } from "../../lib/dates";
import {
  FILE_TYPE,
  inspectionFilename,
  packInspection,
} from "./inspectionFile";

/** One inspection's file, ready to share. */
export async function buildBackupFile(
  inspectionId: string,
  includeOriginals: boolean,
): Promise<File> {
  const inspection = await loadJobInspection(db, inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  const collected = await collectInspection(db, inspectionId, {
    includeOriginals,
    app: `${appVersion} (${appCommit})`,
  });
  return new File(
    [packInspection(collected).slice().buffer],
    inspectionFilename(
      inspection.jobNumber,
      inspection.itemInspected,
      todayIso(),
    ),
    { type: FILE_TYPE },
  );
}

/** Marks inspections backed up once their files were saved or shared. */
export async function recordBackups(
  inspectionIds: string[],
  at = Date.now(),
): Promise<void> {
  for (const id of inspectionIds) await markBackedUp(db, id, at);
}
