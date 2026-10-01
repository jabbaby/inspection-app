import { useRegisterSW } from "virtual:pwa-register/react";

/** Offers a new version instead of reloading mid-inspection. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="alert">
      <span>A new version is available.</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Update now
      </button>
      <button type="button" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}
