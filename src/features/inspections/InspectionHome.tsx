import { useLiveQuery } from "dexie-react-hooks";
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
import { InspectionHeader } from "./InspectionTabs";
import { inspectionTitle } from "./inspectionTitle";
import { JobDetailsForm, type JobDetailsValues } from "./JobDetailsForm";
import { mergePatches, toPatch, toValues } from "./jobDetails";

type Load =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; inspection: Inspection };

function NotFound() {
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

/** Pre-inspection tab: the job details (autosaved) and Delete inspection. */
export function PreInspectionScreen() {
  const { id = "" } = useParams();
  return <PreInspectionFor key={id} id={id} />;
}

function PreInspectionFor({ id }: { id: string }) {
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
  if (load.status === "missing" || !values) return <NotFound />;

  const missing = missingJobFields({
    ...load.inspection,
    jobNumber: values.jobNumber,
    jobName: values.jobName,
  });

  return (
    <section className="inspection-home">
      <InspectionHeader
        inspectionId={id}
        title={inspectionTitle(values)}
        current="details"
        status={
          <span className="save-state" role="status" data-testid="save-state">
            {saveStateLabel(autosave.state)}
          </span>
        }
      />

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

/** Inspection tab: Open markup, then drawings, items and general photos. */
export function InspectionScreen() {
  const { id = "" } = useParams();
  const data = useLiveQuery(
    async () => ({
      inspection: (await db.inspections.get(id)) ?? null,
      drawingCount: await db.drawings.where("inspectionId").equals(id).count(),
    }),
    [id],
  );
  if (!data) return null;
  const { inspection, drawingCount } = data;
  if (!inspection) return <NotFound />;

  return (
    <section className="inspection-home">
      <InspectionHeader
        inspectionId={id}
        title={inspectionTitle(inspection)}
        current="inspection"
      />
      <p className="button-row">
        {drawingCount > 0 ? (
          <Link
            className="button-link primary"
            to={`/inspections/${id}/document`}
          >
            Open markup
          </Link>
        ) : (
          <span className="muted">
            Add a drawing below, then open it to mark it up.
          </span>
        )}
      </p>
      <DrawingsSection inspectionId={id} />
      <ItemsSection inspectionId={id} />
      <PhotosSection inspectionId={id} jobNumber={inspection.jobNumber} />
    </section>
  );
}
