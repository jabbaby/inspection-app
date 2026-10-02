export type InspectionTab = "details" | "inspection" | "memo";

/** Where each inspection tab lives; the drawings viewer belongs to "inspection". */
export function tabPath(inspectionId: string, tab: InspectionTab): string {
  return `/inspections/${inspectionId}/${tab}`;
}
