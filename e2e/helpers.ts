import { expect, type Locator, type Page } from "@playwright/test";

/** Waits until the service worker controls the page (reloading once if needed). */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}

/** Screen box of a page in the inspection document (0 = first page). */
export async function stageBox(page: Page, index = 0) {
  const box = await page.getByTestId("doc-page").nth(index).boundingBox();
  if (!box) throw new Error("No page");
  return box;
}

/** Scrolls the document by dragging with the mouse (positive dy = down). */
export async function scrollDocument(page: Page, dy: number) {
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  // Start in the margin beside the pages so no pin or box is grabbed.
  const x = viewer.x + 6;
  const y = viewer.y + viewer.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - dy, { steps: 8 });
  await page.mouse.up();
}

export async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Two-finger pinch from synthetic touch events. Playwright's WebKit can't
 * construct Touch objects, so the events carry plain { clientX, clientY }
 * lists, which is all the viewer reads. Fingers start `from` px apart and
 * end `to` px apart.
 */
export async function pinch(
  page: Page,
  at: { x: number; y: number },
  from: number,
  to: number,
) {
  await page.evaluate(
    ({ at, from, to }) => {
      const el = document.querySelector('[data-testid="drawing-viewer"]')!;
      const fire = (type: string, d: number | null) => {
        const touches =
          d === null
            ? []
            : [
                { clientX: at.x - d / 2, clientY: at.y },
                { clientX: at.x + d / 2, clientY: at.y },
              ];
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "touches", { value: touches });
        el.dispatchEvent(event);
      };
      fire("touchstart", from);
      for (let i = 1; i <= 10; i++)
        fire("touchmove", from + ((to - from) * i) / 10);
      fire("touchend", null);
    },
    { at, from, to },
  );
}

/** A quick one-finger tap from synthetic touch pointer events. */
export async function touchTap(page: Page, at: { x: number; y: number }) {
  await page.evaluate((at) => {
    const target = document.elementFromPoint(at.x, at.y)!;
    for (const type of ["pointerdown", "pointerup"])
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 8,
          pointerType: "touch",
          clientX: at.x,
          clientY: at.y,
          bubbles: true,
          cancelable: true,
          isPrimary: true,
        }),
      );
  }, at);
}

/** The Inspections tab (Recent and Projects), from the rail. */
export async function openInspectionsList(page: Page) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Inspections" })
    .click();
  await expect(page).toHaveURL(/#\/inspections$/);
}

/** Opens an inspection tab: Pre-inspection, Inspection or Site memo. */
export async function openTab(
  page: Page,
  name: "Pre-inspection" | "Inspection" | "Site memo",
) {
  await page
    .getByRole("navigation", { name: "Inspection sections" })
    .getByRole("link", { name, exact: true })
    .click();
}

/**
 * New inspection from the Inspections page: in a new project (or, with
 * `existing`, the project that already has that job number), or with
 * none (null: Skip for now). Ends on its Pre-inspection tab.
 */
export async function startInspection(
  page: Page,
  project: { jobNumber: string; jobName: string; existing?: boolean } | null,
) {
  await page.getByRole("button", { name: "New inspection" }).click();
  const dialog = page.getByRole("dialog", { name: "New inspection" });
  if (!project) {
    await dialog.getByRole("button", { name: "Skip for now" }).click();
  } else {
    const form = dialog.getByRole("form", { name: "New project" });
    await form
      .getByLabel("Job number", { exact: true })
      .fill(project.jobNumber);
    await form.getByLabel("Job name", { exact: true }).fill(project.jobName);
    await dialog
      .getByRole("button", {
        name: project.existing ? "Use that project" : "Create project",
      })
      .click();
  }
  await expect(page).toHaveURL(/\/details$/);
}
