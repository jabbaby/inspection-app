import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { InspectionsPage } from "../features/inspections/InspectionsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { Shell } from "./Shell";

// Hash routing: GitHub Pages has no SPA fallback, and every route is served
// by the one precached index.html.
const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <InspectionsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
