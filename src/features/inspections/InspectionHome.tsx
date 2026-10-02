import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { deleteInspection, missingJobFields } from "../../db/inspections";
import {
  assignInspection,
  createProject,
  loadJobInspection,
  saveJob,
  startProjectFor,
  type JobPatch,
} from "../../db/projects";
import type { JobInspection } from "../../db/types";
import { DrawingsSection } from "../drawings/DrawingsSection";
import { ItemsSection } from "../items/ItemsSection";
import { PhotosSection } from "../photos/PhotosSection";
import { ProjectPicker } from "../projects/ProjectPicker";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import { InspectionHeader } from "./InspectionTabs";
import { inspectionTitle } from "./inspectionTitle";
import { JobDetailsForm, type JobDetailsValues } from "./JobDetailsForm";
import {
  INSPECTION_FIELDS,
  PROJECT_FIELDS,
  mergePatches,
  toPatch,
  toValues,
  withValues,
} from "./jobDetails";

type Load =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; inspection: JobInspection };

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

/**
 * Pre-inspection tab: the inspection's project (shared job details,
 * Change project) or, without one, the Needs a project flag; its own
 * details; and Delete inspection. Everything autosaves.
 */
export function PreInspectionScreen() {
  const { id = "" } = useParams();
  return <PreInspectionFor key={id} id={id} />;
}

function PreInspectionFor({ id }: { id: string }) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<JobDetailsValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState<"change" | "new" | "assign" | null>(
    null,
  );
  const autosave = useAutosave<JobPatch>(
    (patch) => saveJob(db, id, patch),
    mergePatches,
  );

  // Load once (and again after the project changes): the form then owns
  // the values, so typing is never overwritten.
  const show = useCallback((inspection: JobInspection | undefined) => {
    if (!inspection) return setLoad({ status: "missing" });
    setLoad({ status: "ready", inspection });
    setValues(toValues(inspection));
  }, []);
  const reload = async () => show(await loadJobInspection(db, id));
  useEffect(() => {
    let current = true;
    void loadJobInspection(db, id).then((found) => current && show(found));
    return () => {
      current = false;
    };
  }, [id, show]);

  if (load.status === "loading") return null;
  if (load.status === "missing" || !values) return <NotFound />;

  const { inspection } = load;
  const hasProject = inspection.projectId !== null;
  const missing = missingJobFields(values);

  function change(key: keyof JobDetailsValues, value: string) {
    setValues((v) => (v ? { ...v, [key]: value } : v));
    autosave.queue(toPatch(key, value));
  }

  async function choose(projectId: string) {
    setPicking(null);
    await autosave.flush();
    await assignInspection(db, id, projectId);
    await reload();
  }

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

      <h2>Project</h2>
      {hasProject ? (
        <>
          <p className="button-row">
            <Link
              to={`/projects/${inspection.projectId}`}
              data-testid="project-link"
            >
              {inspectionTitle(values)}
            </Link>
            <button type="button" onClick={() => setPicking("change")}>
              Change project
            </button>
          </p>
          <p className="muted">
            The project&rsquo;s details are shared by every inspection in it:
            changing them here changes them there too.
          </p>
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
            label="Project details"
            only={PROJECT_FIELDS}
            values={values}
            onChange={change}
            onBlur={() => void autosave.flush()}
          />
        </>
      ) : (
        <div className="notice needs-project" data-testid="needs-project">
          <p>
            <span className="flag">Needs a project</span> This inspection
            isn&rsquo;t in a project yet. A memo needs one (for the job number
            and client).
          </p>
          <p className="button-row">
            <button
              type="button"
              className="primary"
              onClick={() => setPicking("new")}
            >
              Create new project
            </button>
            <button type="button" onClick={() => setPicking("assign")}>
              Assign to project
            </button>
          </p>
        </div>
      )}

      <h2>Inspection details</h2>
      <JobDetailsForm
        label="Inspection details"
        only={INSPECTION_FIELDS}
        values={values}
        onChange={change}
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

      <ProjectPicker
        open={picking !== null}
        title={
          picking === "new"
            ? "Create new project"
            : picking === "assign"
              ? "Assign to project"
              : "Change project"
        }
        mode={
          picking === "new" ? "new" : picking === "assign" ? "pick" : "both"
        }
        initial={{ jobName: inspection.unsorted?.jobName ?? "" }}
        excludeProjectId={inspection.projectId}
        onPick={(projectId) => void choose(projectId)}
        onCreate={async (details) => {
          if (hasProject) {
            const project = await createProject(db, details);
            await choose(project.id);
          } else {
            // Starts from the client and address it had.
            setPicking(null);
            await autosave.flush();
            await startProjectFor(db, id, details);
            await reload();
          }
        }}
        onCancel={() => setPicking(null)}
      />

      <DeleteInspectionDialog
        inspection={confirmDelete ? withValues(inspection, values) : null}
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
      inspection: (await loadJobInspection(db, id)) ?? null,
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
