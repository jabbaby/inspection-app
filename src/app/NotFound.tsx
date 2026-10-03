import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { AppBar, BackLink, BarTitle } from "./AppBar";

/** Something linked to (an inspection, project or memo) isn't on this device. */
export function NotFound({ what }: { what: string }) {
  return (
    <section className="empty-state">
      <AppBar
        left={
          <>
            <BackLink to="/" label="Back to inspections" />
            <BarTitle heading={`${what} not found`} />
          </>
        }
      />
      <span className="empty-state-icon">
        <SearchX aria-hidden="true" />
      </span>
      <h1>{what} not found</h1>
      <p className="muted">It may have been deleted on this device.</p>
      <Link to="/" className="button-link primary">
        Go to Inspections
      </Link>
    </section>
  );
}
