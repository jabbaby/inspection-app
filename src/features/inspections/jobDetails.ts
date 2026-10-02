/**
 * Job details form values <-> inspection records. Shared by the inspection
 * home and the memo editor, which edit the same job details.
 */
import type { InspectionPatch } from "../../db/inspections";
import type { Inspection } from "../../db/types";
import type { JobDetailsValues } from "./JobDetailsForm";

export function toValues(i: Inspection): JobDetailsValues {
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

export function toPatch(
  key: keyof JobDetailsValues,
  value: string,
): InspectionPatch {
  switch (key) {
    case "clientName":
      return { client: { name: value } };
    case "clientCompany":
      return { client: { company: value } };
    case "address1":
      return { client: { address1: value } };
    case "address2":
      return { client: { address2: value } };
    default:
      return { [key]: value };
  }
}

export function mergePatches(
  a: InspectionPatch,
  b: InspectionPatch,
): InspectionPatch {
  return { ...a, ...b, client: { ...a.client, ...b.client } };
}

/** The inspection with form values applied (for a live memo preview). */
export function withValues(
  inspection: Inspection,
  v: JobDetailsValues,
): Inspection {
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
