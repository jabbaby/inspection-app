/**
 * Job details form values <-> records. Shared by the Pre-inspection tab
 * and the memo editor, which edit the same job details: the project's
 * (job number and name, client, address) and the inspection's own (item
 * inspected, date, inspector).
 */
import type { JobPatch } from "../../db/projects";
import type { JobInspection } from "../../db/types";
import type { JobDetailsValues, ProjectField } from "./JobDetailsForm";

export { mergeJobPatches as mergePatches } from "../../db/projects";

/** The project's fields (shared by its inspections), in form order. */
export const PROJECT_FIELDS: readonly ProjectField[] = [
  "jobNumber",
  "jobName",
  "clientName",
  "clientCompany",
  "address1",
  "address2",
];

/** The inspection's own fields. */
export const INSPECTION_FIELDS: readonly (keyof JobDetailsValues)[] = [
  "itemInspected",
  "date",
  "inspector",
];

export function toValues(i: JobInspection): JobDetailsValues {
  return {
    jobNumber: i.jobNumber,
    jobName: i.jobName,
    itemInspected: i.itemInspected,
    clientName: i.client.name,
    clientCompany: i.client.company,
    address1: i.client.address1,
    address2: i.client.address2,
    date: i.date,
    inspector: i.inspector,
  };
}

export function toPatch(key: keyof JobDetailsValues, value: string): JobPatch {
  switch (key) {
    case "clientName":
      return { project: { client: { name: value } } };
    case "clientCompany":
      return { project: { client: { company: value } } };
    case "address1":
      return { project: { client: { address1: value } } };
    case "address2":
      return { project: { client: { address2: value } } };
    case "jobNumber":
    case "jobName":
      return { project: { [key]: value } };
    default:
      return { inspection: { [key]: value } };
  }
}

/** The inspection with form values applied (for a live memo preview). */
export function withValues(
  inspection: JobInspection,
  v: JobDetailsValues,
): JobInspection {
  return {
    ...inspection,
    jobNumber: v.jobNumber,
    jobName: v.jobName,
    itemInspected: v.itemInspected,
    date: v.date,
    inspector: v.inspector,
    client: {
      name: v.clientName,
      company: v.clientCompany,
      address1: v.address1,
      address2: v.address2,
    },
  };
}
