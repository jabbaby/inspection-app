import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { InspectionHome } from "../features/inspections/InspectionHome";
import { InspectionsPage } from "../features/inspections/InspectionsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { DrawingPage } from "../features/drawings/DrawingPage";
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
      { path: "inspections/:id/drawings/:drawingId", element: <DrawingPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
