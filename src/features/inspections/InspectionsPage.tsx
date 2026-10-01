import { appCommit, appVersion } from "../../app/version";

export function InspectionsPage() {
  return (
    <section>
      <h1>Inspections</h1>
      <p className="empty-state">No inspections yet</p>
      <p className="app-version">
        Version {appVersion} ({appCommit})
      </p>
    </section>
  );
}
