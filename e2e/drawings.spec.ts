import { expect, test, type Page } from "@playwright/test";
import {
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing";
import {
  centre,
  flick,
  pinch,
  scrollDocument,
  stageBox,
  touchTap,
  waitForServiceWorker,
} from "./helpers";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });
// The notes box shows everything in capitals.
const HEADER =
  "NORTHROP INSPECTION | LEVEL 3 SLAB REINFORCEMENT | T. ENGINEER | 01/10/2026";

/** New inspection with the fields the observations box header uses. */
async function setupInspection(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "New inspection" }).click();
  await field(page, "Job number").fill("SY000001");
  await field(page, "Job name").fill("Example Apartments");
  await field(page, "Item inspected").fill("Level 3 slab reinforcement");
  await field(page, "Inspector").fill("Test Engineer");
  await field(page, "Date").fill("2026-10-01");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
}

async function uploadDrawings(
  page: Page,
  files: { name: string; buffer: Buffer }[],
) {
  await page
    .getByTestId("drawing-file-input")
    .setInputFiles(files.map((f) => ({ ...f, mimeType: "application/pdf" })));
  await expect(page.getByTestId("drawings-status")).toHaveCount(0, {
    timeout: 20_000,
  });
}

async function typicalPdf(name = "S-101 Level 3.pdf") {
  return {
    name,
    buffer: Buffer.from(await buildSyntheticDrawing(TYPICAL_DRAWING)),
  };
}

async function openDrawing(page: Page, name: string) {
  await page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({
    timeout: 20_000,
  });
}

/** Add pin, then tap at a fraction of a page. Returns the tap point. */
async function addPinAt(page: Page, fx: number, fy: number, pageIndex = 0) {
  const box = await stageBox(page, pageIndex);
  const before = await page.getByTestId("viewer-pin").count();
  await page.getByRole("button", { name: "Add pin" }).click();
  const at = { x: box.x + box.width * fx, y: box.y + box.height * fy };
  await page.mouse.click(at.x, at.y);
  // Wait for the new pin's own sheet (a previous sheet may still be open).
  await expect(page.getByTestId("viewer-pin")).toHaveCount(before + 1);
  await expect(
    page.getByTestId("item-sheet").getByRole("textbox"),
  ).toBeFocused();
  return at;
}

const sheet = (page: Page) => page.getByTestId("item-sheet");
const pinByLetter = (page: Page, letter: string) =>
  page.locator(`[data-testid="viewer-pin"][data-letter="${letter}"]`);

async function typeItem(page: Page, text: string) {
  await sheet(page).getByRole("textbox").fill(text);
  await expect(page.getByTestId("item-save-state")).toHaveText("Saved");
}

async function deleteOpenItem(page: Page) {
  await sheet(page)
    .getByRole("button", { name: /^Delete item/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(sheet(page)).toHaveCount(0);
}

test("adds drawings from Files, rejects non-PDFs and opens them", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [
    await typicalPdf("S-101 Level 3.pdf"),
    { name: "notes.pdf", buffer: Buffer.from("this is not a pdf") },
  ]);
  const card = page.getByRole("listitem").filter({ hasText: "S-101 Level 3" });
  await expect(card).toContainText("3 pages · 0 items");
  await expect(page.getByRole("alert")).toContainText(
    "notes.pdf couldn't be opened as a PDF.",
  );

  await openDrawing(page, "S-101 Level 3");
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 1 of 3",
  );
});

test("a pin becomes a saved instruction exactly where tapped", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");

  const at = await addPinAt(page, 0.25, 0.4);
  await expect(sheet(page).getByRole("heading")).toHaveText("Item A");
  await expect(
    sheet(page).getByRole("button", { name: "Instruction" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(sheet(page).getByRole("textbox")).toBeFocused();
  await typeItem(page, "Add N12 bar at grid C/4");
  await sheet(page)
    .getByLabel("Photo confirmation required before proceeding")
    .check();

  const pin = pinByLetter(page, "A");
  expect(Number(await pin.getAttribute("data-x"))).toBeCloseTo(0.25, 2);
  expect(Number(await pin.getAttribute("data-y"))).toBeCloseTo(0.4, 2);
  // The pin sits on the tapped page spot (the view may pan when the sheet
  // opens, so compare against the page where it is now).
  expect(at.x).toBeGreaterThan(0);
  const stage = await stageBox(page);
  const placed = await centre(pin);
  const n = {
    x: Number(await pin.getAttribute("data-x")),
    y: Number(await pin.getAttribute("data-y")),
  };
  expect(Math.abs(placed.x - (stage.x + stage.width * n.x))).toBeLessThan(1);
  expect(Math.abs(placed.y - (stage.y + stage.height * n.y))).toBeLessThan(1);

  // The page's notes box shows the header and the instruction.
  const obsBox = page.getByTestId("observation-box");
  await expect(obsBox).toContainText(HEADER);
  await expect(obsBox).toContainText("INSTRUCTIONS:");
  await expect(obsBox).toContainText("A. ADD N12 BAR AT GRID C/4");
  await expect(obsBox).not.toContainText("NOTED FOR INFORMATION:");

  await page.reload();
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible();
  await expect(sheet(page).getByRole("textbox")).toHaveValue(
    "Add N12 bar at grid C/4",
  );
  await expect(
    sheet(page).getByLabel("Photo confirmation required before proceeding"),
  ).toBeChecked();
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // Tapping the pin reopens its sheet.
  const c = await centre(pin);
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("heading")).toHaveText("Item A");
});

test("the notes box lists observations, then instructions", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");

  await addPinAt(page, 0.3, 0.5);
  await typeItem(page, "Add bar");
  await addPinAt(page, 0.5, 0.6);
  await sheet(page).getByRole("button", { name: "Observation" }).click();
  await expect(pinByLetter(page, "B")).toHaveAttribute(
    "data-kind",
    "observation",
  );
  await expect(
    sheet(page).getByLabel("Photo confirmation required before proceeding"),
  ).toHaveCount(0);
  await typeItem(page, "Existing crack noted at grid 4");

  const obsBox = page.getByTestId("observation-box");
  await expect(obsBox).toContainText(HEADER);
  await expect(obsBox).toContainText(
    "NOTED FOR INFORMATION:B. EXISTING CRACK NOTED AT GRID 4INSTRUCTIONS:A. ADD BAR",
  );

  await sheet(page).getByRole("button", { name: "Instruction" }).click();
  await expect(obsBox).toContainText(
    "INSTRUCTIONS:A. ADD BARB. EXISTING CRACK NOTED AT GRID 4",
  );
  await expect(obsBox).not.toContainText("NOTED FOR INFORMATION:");
});

test("deleting an item re-letters the rest, and the box goes with the last pin", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");

  for (const fx of [0.2, 0.3, 0.4]) {
    await addPinAt(page, fx, 0.5);
    await typeItem(page, `Pin at ${fx}`);
  }
  await sheet(page).getByRole("button", { name: "Done" }).click();

  // Delete B: the pin that was C becomes B.
  let c = await centre(pinByLetter(page, "B"));
  await page.mouse.click(c.x, c.y);
  await deleteOpenItem(page);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(2);
  c = await centre(pinByLetter(page, "B"));
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("textbox")).toHaveValue("Pin at 0.4");
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await addPinAt(page, 0.5, 0.5);
  await expect(sheet(page).getByRole("heading")).toHaveText("Item C");
  await sheet(page).getByRole("button", { name: "Done" }).click();

  // Deleting A each time re-letters the rest down to A.
  for (let i = 0; i < 3; i++) {
    const letter = "A";
    c = await centre(pinByLetter(page, letter));
    await page.mouse.click(c.x, c.y);
    await expect(sheet(page).getByRole("heading")).toHaveText(`Item ${letter}`);
    await deleteOpenItem(page);
  }
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);
  await expect(page.getByTestId("observation-box")).toHaveCount(0);
});

test("dragged pins and boxes keep their new positions", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.5, 0.5);
  await sheet(page).getByRole("button", { name: "Done" }).click();

  const stage = await stageBox(page);
  const pin = pinByLetter(page, "A");
  const start = await centre(pin);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + stage.width * 0.1, start.y, { steps: 5 });
  await page.mouse.up();

  const obsBox = page.getByTestId("observation-box");
  const b = (await obsBox.boundingBox())!;
  await page.mouse.move(b.x + 10, b.y + 5);
  await page.mouse.down();
  await page.mouse.move(stage.x + 20, stage.y + stage.height * 0.8, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(sheet(page)).toHaveCount(0);
  // Let the moves save before reloading.
  await expect
    .poll(async () => Number(await obsBox.getAttribute("data-x")))
    .toBeLessThan(0.05);
  await page.waitForTimeout(300);

  await page.reload();
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await pin.getAttribute("data-x")))
    .toBeCloseTo(0.6, 2);
  expect(Number(await obsBox.getAttribute("data-x"))).toBeLessThan(0.05);
  expect(Number(await obsBox.getAttribute("data-y"))).toBeGreaterThan(0.7);
});

test("pins stay on their spot through a pinch zoom", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.25, 0.4);
  await sheet(page).getByRole("button", { name: "Done" }).click();

  let box = await stageBox(page);
  await pinch(
    page,
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
    60,
    240,
  );
  await expect
    .poll(async () => (await stageBox(page)).width)
    .toBeGreaterThan(box.width * 3);

  box = await stageBox(page);
  const pin = pinByLetter(page, "A");
  const n = {
    x: Number(await pin.getAttribute("data-x")),
    y: Number(await pin.getAttribute("data-y")),
  };
  const after = await centre(pin);
  expect(Math.abs(after.x - (box.x + box.width * n.x))).toBeLessThan(1);
  expect(Math.abs(after.y - (box.y + box.height * n.y))).toBeLessThan(1);
});

test("the items list opens the right drawing page and item", async ({
  page,
}) => {
  await setupInspection(page);
  const home = page.url();
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.3);
  await typeItem(page, "First");
  await sheet(page).getByRole("button", { name: "Done" }).click();
  // Scroll down to page 2 of the document.
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const second = await stageBox(page, 1);
  await scrollDocument(page, second.y - viewer.y - 20);
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 2 of 3",
  );
  await expect(
    page.locator(
      '[data-testid="doc-page"][data-key$=":2"][data-rendered="true"]',
    ),
  ).toBeVisible();
  await addPinAt(page, 0.4, 0.4, 1);
  await sheet(page).getByRole("button", { name: "Observation" }).click();
  await typeItem(page, "Second on page two");

  await page.goto(home);
  const items = page.getByRole("list", { name: "Items" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("A. First");
  await expect(items.nth(1)).toContainText(
    "Observation · S-101 Level 3, page 2",
  );

  await items.nth(1).getByRole("link").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 2 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Item B");
});

test("a finger flick keeps rolling, straight down the document", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const start = await stageBox(page);

  // Finger moves up 300 px with a little sideways drift, then lifts.
  await flick(
    page,
    { x: viewer.x + 6, y: viewer.y + viewer.height * 0.75 },
    15,
    -300,
  );
  const released = await stageBox(page);
  // It keeps going after the finger lifts (however slow the machine's
  // frames are), and never moves sideways.
  await expect
    .poll(async () => (await stageBox(page)).y, { timeout: 10_000 })
    .toBeLessThan(released.y - 100);
  expect((await stageBox(page)).x).toBeCloseTo(start.x, 0);
});

test("a touch stops a roll and doesn't place a pin", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  await page.getByRole("button", { name: "Add pin" }).click();
  const at = {
    x: viewer.x + viewer.width / 2,
    y: viewer.y + viewer.height / 2,
  };

  await flick(
    page,
    { x: viewer.x + 6, y: viewer.y + viewer.height * 0.75 },
    0,
    -300,
  );
  await touchTap(page, at);
  const stopped = await stageBox(page);
  await page.waitForTimeout(300);
  expect((await stageBox(page)).y).toBe(stopped.y);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);

  // The next tap places the pin as usual.
  await touchTap(page, at);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);
});

test("all drawings scroll as one document", async ({ page }) => {
  await setupInspection(page);
  const home = page.url();
  await uploadDrawings(page, [
    await typicalPdf("S-101 Level 3.pdf"),
    await typicalPdf("S-102 Level 4.pdf"),
  ]);
  await openDrawing(page, "S-101 Level 3");
  await expect(page.getByTestId("doc-page")).toHaveCount(6);
  await expect(page.locator(".doc-label")).toHaveText([
    "S-101 Level 3",
    "S-102 Level 4",
  ]);

  // Scroll to the second drawing's first page.
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const fourth = await stageBox(page, 3);
  await scrollDocument(page, fourth.y - viewer.y - 20);
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
  await addPinAt(page, 0.5, 0.5, 3);
  await expect(sheet(page).getByRole("heading")).toHaveText("Item A");

  // Opening a drawing from the inspection scrolls straight to it.
  await page.goto(home);
  await openDrawing(page, "S-102 Level 4");
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
});

test("the Items tab lists items and jumps to them", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [
    await typicalPdf("S-101 Level 3.pdf"),
    await typicalPdf("S-102 Level 4.pdf"),
  ]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.3);
  await typeItem(page, "On the first drawing");
  await sheet(page).getByRole("button", { name: "Done" }).click();

  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const fourth = await stageBox(page, 3);
  await scrollDocument(page, fourth.y - viewer.y - 20);
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
  await addPinAt(page, 0.5, 0.5, 3);
  await sheet(page).getByRole("button", { name: "Observation" }).click();
  await typeItem(page, "On the second drawing");
  await sheet(page).getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Items", exact: true }).click();
  const panel = page.getByTestId("items-panel");
  const rows = panel.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText(
    "Observation · S-102 Level 4, page 1",
  );

  // Jump back up to item A on the first drawing.
  await rows.nth(0).getByRole("button").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 1 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Item A");
  await sheet(page).getByRole("button", { name: "‹ Items" }).click();
  await expect(panel).toBeVisible();

  await rows.nth(1).getByRole("button").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Item B");
});

test("deleting a drawing removes its items", async ({ page }) => {
  await setupInspection(page);
  const home = page.url();
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.3);
  await page.goto(home);

  await page.getByRole("button", { name: "Delete S-101 Level 3" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete drawing?" });
  await expect(dialog).toContainText(
    "S-101 Level 3 and its 1 item will be removed",
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No drawings yet.")).toBeVisible();
  await expect(page.getByText("No items yet.")).toBeVisible();
});

// Tagged @offline: runs in the Chromium project only (see playwright.config.ts).
test(
  "adds a drawing and pins offline",
  { tag: "@offline" },
  async ({ page, context }) => {
    await page.goto("./");
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();

    await page.getByRole("button", { name: "New inspection" }).click();
    await page
      .getByRole("button", { name: "Add synthetic test drawing" })
      .click();
    await openDrawing(page, "Synthetic test drawing");
    await addPinAt(page, 0.3, 0.3);
    await typeItem(page, "Offline item");
    await page.reload();
    await expect(sheet(page).getByRole("textbox")).toHaveValue("Offline item");
  },
);
