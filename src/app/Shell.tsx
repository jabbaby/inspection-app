import { Link, NavLink, Outlet, useLocation } from "react-router";
import { UpdatePrompt } from "./UpdatePrompt";
import { useOnlineStatus } from "./useOnlineStatus";

export function Shell() {
  const online = useOnlineStatus();
  const { pathname } = useLocation();
  const inInspections = pathname === "/" || pathname.startsWith("/inspections");

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-title">Site Inspection Companion</span>
        <nav className="shell-nav">
          <Link
            to="/"
            className={inInspections ? "active" : undefined}
            aria-current={inInspections ? "page" : undefined}
          >
            Inspections
          </Link>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <span
          className={`net-status ${online ? "online" : "offline"}`}
          role="status"
          data-testid="net-status"
        >
          {online ? "Online" : "Offline"}
        </span>
      </header>
      <UpdatePrompt />
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
