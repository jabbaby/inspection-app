import { ChevronLeft, CloudCheck, CloudOff } from "lucide-react";
import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { AppBarSlot } from "./appBarSlot";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * The top bar: context on the left (wordmark, or back and a title), the
 * screen's sections in the centre, status on the right. Rendered into the
 * shell's bar so it stays put while the screen scrolls.
 */
export function AppBar({
  left,
  centre,
  right,
}: {
  left?: ReactNode;
  centre?: ReactNode;
  right?: ReactNode;
}) {
  const slot = useContext(AppBarSlot);
  if (!slot) return null;
  return createPortal(
    <>
      <div className="app-bar-left">{left}</div>
      <div className="app-bar-centre">{centre}</div>
      <div className="app-bar-right">
        {right}
        <NetStatus />
      </div>
    </>,
    slot,
  );
}

/** Back to where this screen was opened from. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="app-bar-back" aria-label={label} title={label}>
      <ChevronLeft aria-hidden="true" />
    </Link>
  );
}

/** A title in the bar: an optional small line above a bold one. */
export function BarTitle({
  kicker,
  heading,
}: {
  kicker?: ReactNode;
  heading: ReactNode;
}) {
  return (
    <div className="app-bar-title">
      {kicker && <span className="app-bar-kicker">{kicker}</span>}
      <span className="app-bar-heading">{heading}</span>
    </div>
  );
}

/** Online is a quiet icon; offline is spelled out. */
function NetStatus() {
  const online = useOnlineStatus();
  return (
    <span
      className={`net-status ${online ? "online" : "offline"}`}
      role="status"
      data-testid="net-status"
      title={online ? "Online" : "Offline: everything still saves on this iPad"}
    >
      {online ? (
        <CloudCheck aria-hidden="true" />
      ) : (
        <CloudOff aria-hidden="true" />
      )}
      <span className={online ? "sr-only" : undefined}>
        {online ? "Online" : "Offline"}
      </span>
    </span>
  );
}
