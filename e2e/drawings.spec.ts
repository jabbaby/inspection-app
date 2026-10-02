import { expect, test, type Page } from "@playwright/test";
import {
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing";
import {
  centre,
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
const pinByLetter = (
  page: Page,
  letter: string,
  kind: "instruction" | "observation" = "instruction",
) =>
  page.locator(
    `[data-testid="viewer-pin"][data-kind="${kind}"][data-letter="${letter}"]`,
  );

async function typeItem(page: Page, text: string) {
  await sheet(page).getByRole("textbox").fill(text);
  await expect(page.getByTestId("item-save-state")).toHaveText("Saved");
}

async function deleteOpenItem(page: Page) {
  await sheet(page)
    .getByRole("button", { name: /^Delete (instruction|observation) / })
    .click();
  // No confirm: it goes at once (Undo brings it back).
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(sheet(page)).toHaveCount(0);
}

/** Drags with the mouse from one point to another in small steps. */
async function mouseDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const panelRows = (page: Page) => page.getByTestId("items-panel-row");

/** Opens the Items tab with three instructions on page 1: A, B, C. */
async function threeItemsInPanel(page: Page) {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  for (const [i, fx] of [0.2, 0.4, 0.6].entries()) {
    await addPinAt(page, fx, 0.5);
    await typeItem(page, `Item ${i + 1}`);
  }
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  await page.getByRole("button", { name: "Items", exact: true }).click();
  await expect(panelRows(page)).toHaveCount(3);
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
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");
  await expect(
    sheet(page).getByRole("button", { name: "Instruction", exact: true }),
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
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  await expect(sheet(page)).toHaveCount(0);

  // Tapping the pin reopens its sheet.
  const c = await centre(pin);
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");
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
  await sheet(page)
    .getByRole("button", { name: "Observation", exact: true })
    .click();
  // It becomes observation A, beside instruction A.
  await expect(pinByLetter(page, "A", "observation")).toHaveCount(1);
  await expect(pinByLetter(page, "A")).toHaveCount(1);
  await expect(sheet(page).getByRole("heading")).toHaveText("Observation A");
  await expect(
    sheet(page).getByLabel("Photo confirmation required before proceeding"),
  ).toHaveCount(0);
  await typeItem(page, "Existing crack noted at grid 4");

  const obsBox = page.getByTestId("observation-box");
  await expect(obsBox).toContainText(HEADER);
  await expect(obsBox).toContainText(
    "NOTED FOR INFORMATION:A. EXISTING CRACK NOTED AT GRID 4INSTRUCTIONS:A. ADD BAR",
  );

  await sheet(page)
    .getByRole("button", { name: "Instruction", exact: true })
    .click();
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
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  // Delete B: the pin that was C becomes B.
  let c = await centre(pinByLetter(page, "B"));
  await page.mouse.click(c.x, c.y);
  await deleteOpenItem(page);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(2);
  c = await centre(pinByLetter(page, "B"));
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("textbox")).toHaveValue("Pin at 0.4");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  await addPinAt(page, 0.5, 0.5);
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction C");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  // Deleting A each time re-letters the rest down to A.
  for (let i = 0; i < 3; i++) {
    const letter = "A";
    c = await centre(pinByLetter(page, letter));
    await page.mouse.click(c.x, c.y);
    await expect(sheet(page).getByRole("heading")).toHaveText(
      `Instruction ${letter}`,
    );
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
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

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

test("a pinch previews as a picture and lays out once, around the fingers", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.4, 0.4);
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  const pin = pinByLetter(page, "A");
  const at = await centre(pin);

  // Fingers down and apart, but not lifted yet.
  const mid = await page.evaluate(async (at) => {
    const el = document.querySelector<HTMLElement>(
      '[data-testid="drawing-viewer"]',
    )!;
    const fire = (type: string, d: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", {
        value: [
          { clientX: at.x - d / 2, clientY: at.y },
          { clientX: at.x + d / 2, clientY: at.y },
        ],
      });
      el.dispatchEvent(event);
    };
    const stage = el.querySelector<HTMLElement>(".doc-stage")!;
    const before = { scrollTop: el.scrollTop, stage: stage.style.transform };
    fire("touchstart", 100);
    for (let d = 110; d <= 200; d += 10) fire("touchmove", d);
    // The preview updates once per frame.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const sizer = el.querySelector<HTMLElement>(".doc-sizer")!;
    return {
      unchanged:
        el.scrollTop === before.scrollTop &&
        stage.style.transform === before.stage,
      previewing: sizer.style.transform.includes("scale(2)"),
    };
  }, at);
  expect(mid).toEqual({ unchanged: true, previewing: true });
  // The point between the fingers stays put while previewing...
  let now = await centre(pin);
  expect(Math.abs(now.x - at.x)).toBeLessThan(3);
  expect(Math.abs(now.y - at.y)).toBeLessThan(3);

  // ...and after the fingers lift and the zoom is laid out.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="drawing-viewer"]')!;
    const event = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [] });
    el.dispatchEvent(event);
  });
  await expect(page.locator(".doc-sizer")).not.toHaveAttribute(
    "style",
    /scale/,
  );
  now = await centre(pin);
  expect(Math.abs(now.x - at.x)).toBeLessThan(3);
  expect(Math.abs(now.y - at.y)).toBeLessThan(3);
});

test("pins stay on their spot through a pinch zoom", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.25, 0.4);
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

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

test("letters follow the pins' order in the document", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");

  // A pin on page 2 first is A...
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const second = await stageBox(page, 1);
  await scrollDocument(page, second.y - viewer.y - 20);
  await expect(
    page.locator(
      '[data-testid="doc-page"][data-key$=":2"][data-rendered="true"]',
    ),
  ).toBeVisible();
  await addPinAt(page, 0.5, 0.5, 1);
  await typeItem(page, "On page two");
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  // ...until a pin goes on page 1: that becomes A and page 2's becomes B.
  const first = await stageBox(page, 0);
  await scrollDocument(page, first.y - viewer.y - 20);
  await addPinAt(page, 0.3, 0.3, 0);
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  await expect(
    page.locator('[data-testid="viewer-pin"][data-letter="B"]'),
  ).toHaveAttribute("data-page", /:2$/);
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
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
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
  await sheet(page)
    .getByRole("button", { name: "Observation", exact: true })
    .click();
  await typeItem(page, "Second on page two");

  await page.goto(home);
  // Observations first, under headings, each kind lettered from A.
  const section = page.locator('[aria-labelledby="items-heading"]');
  await expect(section.getByRole("heading", { level: 3 })).toHaveText([
    "Observations",
    "Instructions",
  ]);
  const items = section.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("A. Second on page two");
  await expect(items.nth(0)).toContainText(
    "Observation · S-101 Level 3, page 2",
  );
  await expect(items.nth(1)).toContainText("A. First");

  await items.nth(0).getByRole("link").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 2 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Observation A");
});

test("at fit width the document only scrolls up and down", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const viewer = page.getByTestId("drawing-viewer");
  const start = await stageBox(page);

  // Nothing to scroll sideways, and a sideways drag doesn't move it.
  expect(
    await viewer.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(0);
  const box = (await viewer.boundingBox())!;
  await page.mouse.move(box.x + 6, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 100, { steps: 6 });
  await page.mouse.up();
  expect((await stageBox(page)).x).toBeCloseTo(start.x, 0);

  // The browser's own scrolling moves the document.
  await viewer.evaluate((el) => el.scrollBy(0, 400));
  await expect
    .poll(async () => Math.round((await stageBox(page)).y))
    .toBe(Math.round(start.y - 400));

  // Zoomed in, it can scroll sideways too.
  await pinch(page, await centre(viewer), 100, 250);
  await expect
    .poll(() => viewer.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeGreaterThan(0);
});

test("a touch while the document scrolls doesn't place a pin", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const viewer = page.getByTestId("drawing-viewer");
  await page.getByRole("button", { name: "Add pin" }).click();
  const at = await centre(viewer);

  // The tap lands straight after a scroll (as when stopping momentum).
  await viewer.evaluate(async (el) => {
    el.scrollBy(0, 200);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
  await touchTap(page, at);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);

  // Once it's still, a tap places the pin.
  await page.waitForTimeout(300);
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
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");

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
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const fourth = await stageBox(page, 3);
  await scrollDocument(page, fourth.y - viewer.y - 20);
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
  await addPinAt(page, 0.5, 0.5, 3);
  await sheet(page)
    .getByRole("button", { name: "Observation", exact: true })
    .click();
  await typeItem(page, "On the second drawing");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  await page.getByRole("button", { name: "Items", exact: true }).click();
  const panel = page.getByTestId("items-panel");
  const rows = panel.getByRole("listitem");
  // Observations first, each under its page.
  await expect(rows).toHaveCount(2);
  await expect(panel.getByRole("heading", { level: 4 })).toHaveText([
    "S-102 Level 4 · page 1",
    "S-101 Level 3 · page 1",
  ]);
  await expect(rows.nth(0)).not.toContainText("S-102");

  // Jump back up to instruction A on the first drawing.
  await rows.nth(1).getByRole("button").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 1 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Instruction A");
  await sheet(page).getByRole("button", { name: "‹ Items" }).click();
  await expect(panel).toBeVisible();

  await rows.nth(0).getByRole("button").click();
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-102 Level 4 · page 1 of 3",
  );
  await expect(sheet(page).getByRole("heading")).toHaveText("Observation A");
});

test("Undo brings back a deleted item with its letter", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();

  await addPinAt(page, 0.3, 0.5);
  await typeItem(page, "First");
  await addPinAt(page, 0.5, 0.5);
  await typeItem(page, "Second");
  await deleteOpenItem(page);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);

  await undo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(2);
  const c = await centre(pinByLetter(page, "B"));
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("textbox")).toHaveValue("Second");

  // Redo deletes it again; Undo brings it back again.
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await redo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(2);

  // Then the two pins themselves: undo the adds, newest first.
  await undo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);
  await undo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);
  await expect(page.getByTestId("observation-box")).toHaveCount(0);
  await expect(undo).toBeDisabled();

  // Redo puts the first back, with its text and notes box.
  await redo.click();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);
  await expect(page.getByTestId("observation-box")).toContainText("A. FIRST");
});

test("the Items tab highlights items whose pins are on screen", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  await typeItem(page, "On page one");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const third = await stageBox(page, 2);
  await scrollDocument(page, third.y - viewer.y - 20);
  await addPinAt(page, 0.5, 0.3, 2);
  await typeItem(page, "On page three");
  await sheet(page).getByRole("button", { name: "Done" }).first().click();

  await page.getByRole("button", { name: "Items", exact: true }).click();
  const row = (text: string) => panelRows(page).filter({ hasText: text });
  await expect(row("On page three")).toHaveAttribute("data-in-view", "true");
  await expect(row("On page one")).toHaveAttribute("data-in-view", "false");

  // Scroll back to page 1: the highlight follows.
  const first = await stageBox(page, 0);
  await scrollDocument(page, first.y - viewer.y - 20);
  await expect(row("On page one")).toHaveAttribute("data-in-view", "true");
  await expect(row("On page three")).toHaveAttribute("data-in-view", "false");
});

test("the item sheet's Done button closes it", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  await sheet(page).getByRole("textbox").fill("Typed then done");
  // The Done button sits just above Delete.
  await sheet(page).getByRole("button", { name: "Done" }).last().click();
  await expect(sheet(page)).toHaveCount(0);
  const c = await centre(pinByLetter(page, "A"));
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("textbox")).toHaveValue("Typed then done");
});

test("swiping an item left in the Items tab deletes it", async ({ page }) => {
  await threeItemsInPanel(page);
  const row = panelRows(page).nth(1);
  const box = (await row.boundingBox())!;
  await mouseDrag(
    page,
    { x: box.x + box.width - 60, y: box.y + box.height / 2 },
    { x: box.x + box.width - 200, y: box.y + box.height / 2 },
  );
  await row.getByRole("button", { name: "Delete instruction B" }).click();

  await expect(panelRows(page)).toHaveCount(2);
  await expect(panelRows(page).nth(1)).toContainText("B. Item 3");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(panelRows(page)).toHaveCount(3);
  await expect(panelRows(page).nth(1)).toContainText("B. Item 2");
});

test("dragging the handle reorders items on a page", async ({ page }) => {
  await threeItemsInPanel(page);
  const handle = page.getByRole("button", { name: "Reorder instruction C" });
  const first = (await panelRows(page).nth(0).boundingBox())!;
  await mouseDrag(page, await centre(handle), {
    x: (await centre(handle)).x,
    y: first.y + 4,
  });

  // C moved to the top: it's now A, and the box follows.
  await expect(panelRows(page).nth(0)).toContainText("A. Item 3");
  await expect(panelRows(page).nth(1)).toContainText("B. Item 1");
  await expect(page.getByTestId("observation-box")).toContainText(
    "INSTRUCTIONS:A. ITEM 3B. ITEM 1C. ITEM 2",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(panelRows(page).nth(0)).toContainText("A. Item 1");
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
