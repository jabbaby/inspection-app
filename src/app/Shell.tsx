import { NavLink, Outlet } from "react-router";
import { UpdatePrompt } from "./UpdatePrompt";
import { useOnlineStatus } from "./useOnlineStatus";

export function Shell() {
  const online = useOnlineStatus();

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-title">Site Inspection Companion</span>
        <nav className="shell-nav">
          <NavLink to="/" end>
            Inspections
          </NavLink>
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
