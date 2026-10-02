import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ConfirmDialog } from "../../app/ConfirmDialog";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { createInspection } from "../../db/inspections";
import {
  deleteProject,
  jobInspection,
  projectsWithJobNumber,
  updateProject,
  type ProjectPatch,
} from "../../db/projects";
import type { Contact, Project } from "../../db/types";
import { InspectionCard } from "../inspections/InspectionsPage";
import { inspectionTitle } from "../inspections/inspectionTitle";
import {
  JobDetailsForm,
  type JobDetailsValues,
} from "../inspections/JobDetailsForm";
import { PROJECT_FIELDS, toPatch } from "../inspections/jobDetails";
import { tabPath } from "../inspections/tabPath";

const BACK = "/?view=projects";

/**
 * A project (SPEC section 12): its details (shared by all its
 * inspections), contacts offered for memo recipients, its inspections,
 * and Delete project.
 */
export function ProjectPage() {
  const { id = "" } = useParams();
  const [project, setProject] = useState<Project | null | undefined>();
  useEffect(() => {
    let current = true;
    void db.projects.get(id).then((p) => current && setProject(p ?? null));
    return () => {
      current = false;
    };
  }, [id]);
  if (project === undefined) return null;
  if (project === null)
    return (
      <section>
        <p>
          <Link to={BACK}>‹ Projects</Link>
        </p>
        <h1>Project not found</h1>
      </section>
    );
  return <ProjectFor key={id} initial={project} />;
}

function ProjectFor({ initial }: { initial: Project }) {
  const navigate = useNavigate();
  const id = initial.id;
  // Loaded once: the form then owns its values, so typing is never overwritten.
  const [values, setValues] = useState<JobDetailsValues>(() => ({
    jobNumber: initial.jobNumber,
    jobName: initial.jobName,
    clientName: initial.client.name,
    clientCompany: initial.client.company,
    address1: initial.client.address1,
    address2: initial.client.address2,
    // Not shown: they belong to each inspection.
    itemInspected: "",
    date: "",
    inspector: "",
  }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const autosave = useAutosave<ProjectPatch>(
    (patch) => updateProject(db, id, patch),
    (a, b) => ({ ...a, ...b, client: { ...a.client, ...b.client } }),
  );
  const live = useLiveQuery(async () => {
    const [project, inspections] = await Promise.all([
      db.projects.get(id),
      db.inspections.where("projectId").equals(id).toArray(),
    ]);
    inspections.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      contacts: project?.contacts ?? [],
      inspections: inspections.map((i) => jobInspection(i, project)),
    };
  }, [id]);
  const duplicates =
    useLiveQuery(
      async () =>
        (await projectsWithJobNumber(db, values.jobNumber)).filter(
          (p) => p.id !== id,
        ),
      [values.jobNumber, id],
    ) ?? [];

  const inspections = live?.inspections ?? [];
  const title = inspectionTitle(values);

  async function setContacts(contacts: Contact[]) {
    await updateProject(db, id, {
      contacts: contacts.filter((c) => c.company.trim() || c.attn.trim()),
    });
  }

  return (
    <section className="project-page">
      <p>
        <Link to={BACK}>‹ Projects</Link>
      </p>
      <div className="page-heading">
        <h1 data-testid="project-title">{title}</h1>
        <span className="save-state" role="status" data-testid="save-state">
          {saveStateLabel(autosave.state)}
        </span>
      </div>

      <h2>Project details</h2>
      <p className="muted">
        Shared by every inspection in this project and their memos.
      </p>
      <JobDetailsForm
        label="Project details"
        only={PROJECT_FIELDS}
        values={values}
        onChange={(key, value) => {
          setValues((v) => ({ ...v, [key]: value }));
          autosave.queue(toPatch(key, value).project ?? {});
        }}
        onBlur={() => void autosave.flush()}
      />
      {duplicates.length > 0 && (
        <p className="notice" data-testid="duplicate-job">
          Another project also has job number {duplicates[0].jobNumber}:{" "}
          <Link to={`/projects/${duplicates[0].id}`}>
            {inspectionTitle(duplicates[0])}
          </Link>
          .
        </p>
      )}

      <div className="later-section">
        <div className="page-heading">
          <h2>Inspections</h2>
          <button
            type="button"
            className="primary"
            onClick={async () => {
              const inspection = await createInspection(db, new Date(), id);
              navigate(tabPath(inspection.id, "details"));
            }}
          >
            New inspection
          </button>
        </div>
        {!live ? null : inspections.length === 0 ? (
          <p className="muted">No inspections in this project yet.</p>
        ) : (
          <ul className="inspection-list" aria-label="Project inspections">
            {inspections.map((i) => (
              <InspectionCard key={i.id} inspection={i} />
            ))}
          </ul>
        )}
      </div>

      <div className="later-section" aria-labelledby="contacts-heading">
        <h2 id="contacts-heading">Contacts</h2>
        <p className="muted">
          Offered when adding memo recipients. Recipients typed into a memo are
          added here.
        </p>
        {live && (
          <ContactsEditor initial={live.contacts} onSave={setContacts} />
        )}
      </div>

      <div className="later-section">
        <button
          type="button"
          className="danger-outline"
          onClick={() => setConfirmDelete(true)}
        >
          Delete project
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete project?"
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          autosave.cancel();
          setConfirmDelete(false);
          void deleteProject(db, id).then(() => navigate(BACK));
        }}
      >
        <p>
          <strong>{title}</strong>
          {inspections.length > 0 ? (
            <>
              {" "}
              and its{" "}
              <strong>
                {inspections.length} inspection
                {inspections.length === 1 ? "" : "s"}
              </strong>{" "}
              (with their drawings, items, photos and memos) will be removed
              from this device.
            </>
          ) : (
            " will be removed from this device."
          )}
        </p>
        <p>This can&rsquo;t be undone. Backups arrive in a later build.</p>
      </ConfirmDialog>
    </section>
  );
}

/** Contacts, loaded once and saved as you type (like the other fields). */
function ContactsEditor({
  initial,
  onSave,
}: {
  initial: Contact[];
  onSave: (contacts: Contact[]) => Promise<void>;
}) {
  const [rows, setRows] = useState(initial);
  const autosave = useAutosave<Contact[]>(onSave, (_, later) => later);
  const update = (next: Contact[]) => {
    setRows(next);
    autosave.queue(next);
  };
  const change = (i: number, patch: Partial<Contact>) =>
    update(rows.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <>
      {rows.length === 0 ? (
        <p className="muted">No contacts yet.</p>
      ) : (
        <table className="memo-recipients" aria-label="Contacts">
          <thead>
            <tr>
              <th>Company</th>
              <th>Attn</th>
              <th>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <input
                    aria-label={`Contact ${i + 1} company`}
                    value={c.company}
                    autoCapitalize="words"
                    onChange={(e) => change(i, { company: e.target.value })}
                    onBlur={() => void autosave.flush()}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Contact ${i + 1} attention`}
                    value={c.attn}
                    autoCapitalize="words"
                    onChange={(e) => change(i, { attn: e.target.value })}
                    onBlur={() => void autosave.flush()}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    aria-label={`Remove contact ${i + 1}`}
                    onClick={() => update(rows.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="button-row">
        <button
          type="button"
          onClick={() =>
            setRows([
              ...rows,
              { id: crypto.randomUUID(), company: "", attn: "" },
            ])
          }
        >
          Add contact
        </button>
      </p>
    </>
  );
}
