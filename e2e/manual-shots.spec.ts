// Screenshots for the user guide and the features document (docs/manual),
// on the synthetic test drawing with made-up job details. Not part of the
// normal suite: run with `npm run docs:shots`, then `npm run docs:build`.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing";
import { openTab, pinToolOn, stageBox } from "./helpers";

const OUT = "docs/manual/shots";

/**
 * A screenshot (CSS pixels) of the page or one part: a small JPEG, or a PNG
 * for the few that pdf-lib can't read as WebKit writes them.
 */
async function shot(target: Page | Locator, name: string, png = false) {
  await (target as Page).screenshot({
    path: `${OUT}/${name}.${png ? "png" : "jpg"}`,
    ...(png ? { type: "png" } : { type: "jpeg", quality: 72 }),
    scale: "css",
  });
}

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });

async function drag(
  page: Page,
  points: [number, number][],
  { hold = 0, steps = 10, holdEnd = 0 } = {},
) {
  const box = await stageBox(page);
  const at = ([fx, fy]: [number, number]) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  await page.mouse.move(at(points[0]).x, at(points[0]).y);
  await page.mouse.down();
  if (hold) await page.waitForTimeout(hold);
  for (const p of points.slice(1))
    await page.mouse.move(at(p).x, at(p).y, { steps });
  if (holdEnd) await page.waitForTimeout(holdEnd);
  await page.mouse.up();
}

async function pin(
  page: Page,
  fx: number,
  fy: number,
  text: string,
  { observation = false, arrowTo = null as [number, number] | null } = {},
) {
  await pinToolOn(page);
  const sheet = page.getByTestId("item-sheet");
  // The last item's editor closes first (a tap would only close it).
  if (await sheet.count()) {
    await sheet.getByRole("button", { name: "Done" }).first().click();
    await expect(sheet).toHaveCount(0);
  }
  // Hold at the arrow's spot, then drag the pin out to its place.
  if (arrowTo) await drag(page, [arrowTo, [fx, fy]], { hold: 700 });
  else {
    const box = await stageBox(page);
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  }
  await expect(sheet.getByRole("textbox")).toBeFocused();
  if (observation)
    await sheet
      .getByRole("button", { name: "Observation", exact: true })
      .click();
  await sheet.getByRole("textbox").fill(text);
  await expect(page.getByTestId("item-save-state")).toHaveText("Saved");
}

test("manual screenshots @shots", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto("./");

  // My details, so new inspections and memos are signed.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await field(page, "Inspector name").fill("Test Engineer");
  await field(page, "Title").fill("Structural Engineer");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Dashboard" })
    .click();

  // New inspection: choosing or starting a project.
  await page.getByRole("button", { name: "New inspection" }).click();
  const dialog = page.getByRole("dialog", { name: "New inspection" });
  const form = dialog.getByRole("form", { name: "New project" });
  await form.getByLabel("Job number", { exact: true }).fill("SY000001");
  await form.getByLabel("Job name", { exact: true }).fill("Example Apartments");
  await shot(page, "new-inspection", true);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/details$/);

  // Pre-inspection: job details and the drawings.
  await field(page, "Item inspected").fill("Level 3 slab reinforcement");
  await field(page, "Client name").fill("Alex Example");
  await field(page, "Client company").fill("Example Builders Pty Ltd");
  await field(page, "Date").fill("2026-10-07");
  await page.getByTestId("drawing-file-input").setInputFiles({
    name: "S-101 Level 3.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await buildSyntheticDrawing(TYPICAL_DRAWING)),
  });
  await expect(page.getByTestId("drawings-status")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.waitForTimeout(500);
  await shot(page, "pre-inspection");

  // Inspection: pins, arrows, the notes box.
  await openTab(page, "Inspection");
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({ timeout: 20_000 });
  await pin(page, 0.3, 0.35, "Add N12 bar at grid C/4", {
    arrowTo: [0.22, 0.48],
  });
  await page
    .getByTestId("item-sheet")
    .getByLabel("Photo confirmation required before proceeding")
    .check();
  await page.waitForTimeout(600);
  await shot(page, "item-sheet");
  await pin(page, 0.52, 0.42, "Increase cover to 40 mm at slab edge");
  await pin(page, 0.68, 0.6, "Existing crack noted at grid 4", {
    observation: true,
  });
  await page
    .getByTestId("item-sheet")
    .getByRole("button", { name: "Done" })
    .first()
    .click();
  await page.waitForTimeout(600);
  await shot(page, "pins");

  // Markup: a cloud, a highlight, a held rectangle and a callout.
  const toolbar = page.getByRole("toolbar", { name: "Markup tools" });
  const tool = (name: string) =>
    toolbar.getByRole("button", { name, exact: true });
  await tool("Revision cloud").click();
  await drag(page, [
    [0.15, 0.62],
    [0.32, 0.78],
  ]);
  await tool("Highlighter").click();
  await drag(page, [
    [0.4, 0.71],
    [0.6, 0.71],
  ]);
  await tool("Pen").click();
  await drag(
    page,
    [
      [0.45, 0.18],
      [0.6, 0.18],
      [0.6, 0.28],
      [0.45, 0.28],
      [0.451, 0.183],
    ],
    { steps: 8, holdEnd: 800 },
  );
  await tool("Text").click();
  await drag(
    page,
    [
      [0.3, 0.74],
      [0.38, 0.86],
    ],
    { hold: 700 },
  );
  await page
    .getByRole("textbox", { name: "Callout text" })
    .pressSequentially("Lap 600 min");
  await tool("Text").click();
  await page.waitForTimeout(500);
  await shot(page, "markup");

  // Select: a loop round two marks and the floating bar.
  await tool("Select").click();
  await drag(
    page,
    [
      [0.12, 0.58],
      [0.64, 0.58],
      [0.64, 0.8],
      [0.12, 0.8],
      [0.12, 0.6],
    ],
    { steps: 6 },
  );
  await page.waitForTimeout(400);
  await shot(page, "select");
  await tool("Select").click();

  // A general note, then the Items panel and the Pages view.
  await page.getByRole("button", { name: "Items", exact: true }).click();
  await page.getByRole("button", { name: "Add general note" }).click();
  await page
    .getByTestId("item-sheet")
    .getByRole("textbox")
    .fill("Inspection limited to the level 3 slab, grids 1-4 / A-D");
  await expect(page.getByTestId("item-save-state")).toHaveText("Saved");
  await page
    .getByTestId("item-sheet")
    .getByRole("button", { name: "Done" })
    .first()
    .click();
  if (!(await page.getByTestId("items-panel").isVisible()))
    await page.getByRole("button", { name: "Items", exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, "items");
  await page.getByRole("button", { name: "Items", exact: true }).click();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Pages" })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, "pages");
  await page.keyboard.press("Escape");

  // Site memo: the editor beside its live preview, then the export.
  await openTab(page, "Site memo");
  await page.getByRole("button", { name: "Create memo" }).click();
  await page.waitForTimeout(2500);
  await shot(page, "memo");
  const card = page.getByTestId("export-card");
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Export PDF" }).click();
  await expect(card.getByTestId("export-file")).toBeVisible({
    timeout: 30_000,
  });
  await shot(card, "export", true);

  // Backup on Pre-inspection.
  await openTab(page, "Pre-inspection");
  const backup = page.getByTestId("backup-card");
  await backup.scrollIntoViewIfNeeded();
  await shot(backup, "backup", true);

  // Settings.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await page.waitForTimeout(500);
  await shot(page, "settings");

  // The Dashboard last, with everything above on it.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Dashboard" })
    .click();
  await page.waitForTimeout(2500);
  await shot(page, "dashboard");
});
