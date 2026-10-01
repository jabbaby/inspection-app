import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { InspectionHome } from "../features/inspections/InspectionHome";
import { InspectionsPage } from "../features/inspections/InspectionsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { ViewerSpikePage } from "../features/drawings/spike/ViewerSpikePage";
import { Shell } from "./Shell";

// Hash routing: GitHub Pages has no SPA fallback, and every route is served
// by the one precached index.html.
const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <InspectionsPage /> },
      { path: "inspections/:id", element: <InspectionHome /> },
      { path: "settings", element: <SettingsPage /> },
      // Spike B, temporary until build step 5.
      { path: "spike/viewer", element: <ViewerSpikePage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
