import { ClipboardList, LayoutGrid, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { northrop } from "../brand/northrop";
import { NetStatus } from "./AppBar";
import { AppBarSlot } from "./appBarSlot";
import { readPlace, writePlace } from "./sessionPlace";
import { UpdatePrompt } from "./UpdatePrompt";

/**
 * The app frame: a charcoal rail on the left (the Northrop roundel,
 * Dashboard, Inspections and Settings, online status) and, beside it, the
 * screen's header (filled by the screen: back, title, its sections) above
 * the screen itself.
 */
export function Shell() {
  const { pathname, search } = useLocation();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const inInspections =
    pathname.startsWith("/inspections") || pathname.startsWith("/projects");
  // Inspections remembers where you were in it (an inspection's step, a
  // project): from another tab it goes back there; tapped while already
  // in Inspections, it goes to the list.
  useEffect(() => {
    if (inInspections) writePlace("inspections-tab", pathname + search);
  }, [inInspections, pathname, search]);
  const inspectionsTo = inInspections
    ? "/inspections"
    : (readPlace("inspections-tab") ?? "/inspections");
  // The drawings fill the window edge to edge.
  const flush = /^\/inspections\/[^/]+\/(inspection|document)$/.test(pathname);

  return (
    <AppBarSlot.Provider value={slot}>
      <div className="shell">
        <aside className="rail">
          <img
            className="rail-logo"
            src={northrop.assets.icon}
            alt={northrop.name}
          />
          <nav className="rail-nav" aria-label="Main">
            <NavLink to="/" end>
              <LayoutGrid aria-hidden="true" />
              <span className="rail-label">Dashboard</span>
            </NavLink>
            <Link
              to={inspectionsTo}
              aria-current={inInspections ? "page" : undefined}
            >
              <ClipboardList aria-hidden="true" />
              <span className="rail-label">Inspections</span>
            </Link>
            <NavLink to="/settings">
              <Settings aria-hidden="true" />
              <span className="rail-label">Settings</span>
            </NavLink>
          </nav>
          <NetStatus />
        </aside>
        <div className="shell-body">
          <header className="app-bar" ref={setSlot} />
          <UpdatePrompt />
          <main className={flush ? "shell-main flush" : "shell-main"}>
            <Outlet />
          </main>
        </div>
      </div>
    </AppBarSlot.Provider>
  );
}
