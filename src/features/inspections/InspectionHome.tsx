import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import {
  deleteInspection,
  missingJobFields,
  updateInspection,
  type InspectionPatch,
} from "../../db/inspections";
import type { Inspection } from "../../db/types";
import { DrawingsSection } from "../drawings/DrawingsSection";
import { ItemsSection } from "../items/ItemsSection";
import { PhotosSection } from "../photos/PhotosSection";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import { inspectionTitle } from "./inspectionTitle";
import { JobDetailsForm, type JobDetailsValues } from "./JobDetailsForm";

function toValues(i: Inspection): JobDetailsValues {
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

function toPatch(key: keyof JobDetailsValues, value: string): InspectionPatch {
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

function mergePatches(a: InspectionPatch, b: InspectionPatch): InspectionPatch {
  return { ...a, ...b, client: { ...a.client, ...b.client } };
}

const LATER_SECTIONS = [
  {
    title: "Memo",
    step: 7,
    text: "Site Instruction Memo, editable before export.",
  },
  {
    title: "Export",
    step: 8,
    text: "One PDF pack: memo, marked-up drawings and photos.",
  },
];

type Load =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; inspection: Inspection };

export function InspectionHome() {
  const { id = "" } = useParams();
  return <InspectionHomeFor key={id} id={id} />;
}

function InspectionHomeFor({ id }: { id: string }) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<JobDetailsValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const autosave = useAutosave<InspectionPatch>(
    (patch) => updateInspection(db, id, patch),
    mergePatches,
  );

  // Load once: the form then owns the values, so typing is never overwritten.
  useEffect(() => {
    let current = true;
    void db.inspections.get(id).then((inspection) => {
      if (!current) return;
      if (!inspection) {
        setLoad({ status: "missing" });
        return;
      }
      setLoad({ status: "ready", inspection });
      setValues(toValues(inspection));
    });
    return () => {
      current = false;
    };
  }, [id]);

  if (load.status === "loading") return null;
  if (load.status === "missing" || !values) {
    return (
      <section>
        <p>
          <Link to="/">‹ Inspections</Link>
        </p>
        <h1>Inspection not found</h1>
        <p>It may have been deleted on this device.</p>
      </section>
    );
  }

  const missing = missingJobFields({
    ...load.inspection,
    jobNumber: values.jobNumber,
    jobName: values.jobName,
  });

  return (
    <section className="inspection-home">
      <p>
        <Link to="/">‹ Inspections</Link>
      </p>
      <div className="page-heading">
        <h1 data-testid="inspection-title">{inspectionTitle(values)}</h1>
        <span className="save-state" role="status" data-testid="save-state">
          {saveStateLabel(autosave.state)}
        </span>
      </div>

      <h2>Job details</h2>
      {missing.length > 0 && (
        <p className="notice" data-testid="missing-fields">
          {missing.length === 2
            ? "Job number and job name are"
            : missing[0] === "jobNumber"
              ? "Job number is"
              : "Job name is"}{" "}
          needed before a memo can be created.
        </p>
      )}
      <JobDetailsForm
        values={values}
        onChange={(key, value) => {
          setValues((v) => (v ? { ...v, [key]: value } : v));
          autosave.queue(toPatch(key, value));
        }}
        onBlur={() => void autosave.flush()}
      />

      <DrawingsSection inspectionId={id} />
      <ItemsSection inspectionId={id} />
      <PhotosSection inspectionId={id} jobNumber={values.jobNumber} />

      {LATER_SECTIONS.map((section) => (
        <div key={section.title} className="later-section">
          <h2>{section.title}</h2>
          <p className="muted">
            {section.text} Coming in build step {section.step}.
          </p>
        </div>
      ))}

      <div className="later-section">
        <button
          type="button"
          className="danger-outline"
          onClick={() => setConfirmDelete(true)}
        >
          Delete inspection
        </button>
      </div>

      <DeleteInspectionDialog
        inspection={
          confirmDelete
            ? {
                ...load.inspection,
                jobNumber: values.jobNumber,
                jobName: values.jobName,
              }
            : null
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          autosave.cancel();
          setConfirmDelete(false);
          void deleteInspection(db, id).then(() => navigate("/"));
        }}
      />
    </section>
  );
}
