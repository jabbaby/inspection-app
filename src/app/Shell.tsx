import { ClipboardList, Settings } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { northrop } from "../brand/northrop";
import { AppBar } from "./AppBar";
import { AppBarSlot } from "./appBarSlot";
import { UpdatePrompt } from "./UpdatePrompt";

/**
 * The app frame: the top bar and the screen below it. Top-level screens
 * (Inspections, Settings) show the wordmark and the main sections; screens
 * inside an inspection or project fill the bar themselves (back, title,
 * their own sections).
 */
export function Shell() {
  const { pathname } = useLocation();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const inner = /^\/(inspections|projects)\//.test(pathname);

  return (
    <AppBarSlot.Provider value={slot}>
      <div className="shell">
        <header className="app-bar" ref={setSlot} />
        {!inner && <MainBar inInspections={pathname === "/"} />}
        <UpdatePrompt />
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </AppBarSlot.Provider>
  );
}

function MainBar({ inInspections }: { inInspections: boolean }) {
  return (
    <AppBar
      left={
        <Link to="/" className="app-bar-wordmark">
          <img src={northrop.assets.wordmarkRed} alt={northrop.name} />
        </Link>
      }
      centre={
        <nav className="bar-segments" aria-label="Main">
          <Link to="/" aria-current={inInspections ? "page" : undefined}>
            <ClipboardList aria-hidden="true" />
            Inspections
          </Link>
          <NavLink to="/settings">
            <Settings aria-hidden="true" />
            Settings
          </NavLink>
        </nav>
      }
    />
  );
}
