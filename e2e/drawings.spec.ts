import { expect, test, type Page } from "@playwright/test";
import {
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing";
import {
  centre,
  pinch,
  scrollDocument,
  openTab,
  stageBox,
  startInspection,
  touchTap,
  waitForServiceWorker,
} from "./helpers";
import { syntheticJpeg } from "./photoFixtures";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });
// The notes box shows everything in capitals.
const HEADER =
  "NORTHROP INSPECTION | LEVEL 3 SLAB REINFORCEMENT | T. ENGINEER | 01/10/2026";

/** New inspection with the fields the observations box header uses. */
async function setupInspection(page: Page) {
  await page.goto("./");
  await startInspection(page, {
    jobNumber: "SY000001",
    jobName: "Example Apartments",
  });
  await field(page, "Item inspected").fill("Level 3 slab reinforcement");
  await field(page, "Inspector").fill("Test Engineer");
  await field(page, "Date").fill("2026-10-01");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await openTab(page, "Inspection");
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

/**
 * Shows a drawing in the Inspection step: from the drawings list if it is
 * showing (e.g. after a failed upload), else from the Drawings panel.
 */
async function openDrawing(page: Page, name: string) {
  const pattern = new RegExp(`^${name}`);
  const inList = page
    .locator(".drawings-empty")
    .getByRole("button", { name: pattern });
  if (await inList.isVisible()) await inList.click();
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({
    timeout: 20_000,
  });
  const indicator = page.getByTestId("page-indicator");
  await expect(indicator).not.toHaveText("");
  if (pattern.test((await indicator.textContent()) ?? "")) return;
  const toggle = page.getByRole("button", { name: "Drawings", exact: true });
  await toggle.click();
  await page
    .getByRole("complementary", { name: "Drawings" })
    .getByRole("button", { name: pattern })
    .click();
  await toggle.click();
  await expect(indicator).toHaveText(pattern);
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

test("the Inspection step opens straight into the drawings", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({ timeout: 20_000 });
  const tabs = page.getByRole("navigation", { name: "Inspection sections" });
  await expect(
    tabs.getByRole("link", { name: "Inspection", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("page-indicator")).toHaveText(
    "S-101 Level 3 · page 1 of 3",
  );

  await openTab(page, "Site memo");
  await expect(page).toHaveURL(/\/memo$/);
  await openTab(page, "Inspection");
  await expect(page).toHaveURL(/\/inspection$/);
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({ timeout: 20_000 });

  // Drawings are managed from the Drawings panel.
  await page.getByRole("button", { name: "Drawings", exact: true }).click();
  await expect(
    page
      .getByRole("complementary", { name: "Drawings" })
      .getByRole("button", { name: "Rename S-101 Level 3" }),
  ).toBeVisible();
});

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

test("pins on a later page are lettered per kind", async ({ page }) => {
  await setupInspection(page);
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
  await expect(sheet(page).getByRole("heading")).toHaveText("Observation A");
  await expect(pinByLetter(page, "A", "observation")).toBeVisible();
  await expect(pinByLetter(page, "A")).toHaveCount(1);
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

test("tapping the drawing closes the item editor and keeps the text", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  await sheet(page).getByRole("textbox").fill("Typed then tapped away");

  const box = await stageBox(page);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);

  const c = await centre(pinByLetter(page, "A"));
  await page.mouse.click(c.x, c.y);
  await expect(sheet(page).getByRole("textbox")).toHaveValue(
    "Typed then tapped away",
  );
});

test("a lost finger-up doesn't stop Add pin working", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  const viewer = page.getByTestId("drawing-viewer");
  const at = await centre(viewer);

  // A finger goes down, but its "up" never reaches the viewer (as when the
  // element under it is removed or redrawn mid-touch), nor does touchend.
  await viewer.evaluate((el, at) => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 40,
        pointerType: "touch",
        clientX: at.x,
        clientY: at.y,
        bubbles: true,
        cancelable: true,
        isPrimary: true,
      }),
    );
    const start = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperty(start, "touches", {
      value: [
        { clientX: at.x - 40, clientY: at.y },
        { clientX: at.x + 40, clientY: at.y },
      ],
    });
    el.dispatchEvent(start);
  }, at);
  // The lift lands elsewhere in the page.
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 40,
        pointerType: "touch",
        bubbles: true,
      }),
    );
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "touches", { value: [] });
    document.body.dispatchEvent(end);
  });

  await page.getByRole("button", { name: "Add pin" }).click();
  await touchTap(page, at);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(1);
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

  // Opening a drawing from the Drawings panel scrolls straight to it.
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

test("arrows point from a pin to spots on its page", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  await typeItem(page, "Lap at grid C");
  const arrows = page.getByTestId("arrow");
  const handles = page.getByTestId("arrow-handle");
  const box = await stageBox(page);

  // Add arrow, then tap the drawing: an arrow and its tip handle appear.
  await sheet(page).getByRole("button", { name: "Add arrow" }).click();
  await expect(sheet(page).getByRole("status").last()).toHaveText(
    "Tap the drawing where the arrow should point.",
  );
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);
  await expect(arrows).toHaveCount(1);
  await expect(handles).toHaveCount(1);
  await expect(handles.first()).toHaveAttribute("data-x", /^0\.(59|60)/);

  // A second arrow from the same pin.
  await sheet(page).getByRole("button", { name: "Add arrow" }).click();
  // The sheet grew, so measure the page again.
  const box2 = await stageBox(page);
  await page.mouse.click(box2.x + box2.width * 0.5, box2.y + box2.height * 0.6);
  await expect(arrows).toHaveCount(2);
  await expect(sheet(page)).toContainText("Arrows (2)");

  // Drag the first tip somewhere else; Undo puts it back.
  const tip = await centre(handles.first());
  await page.mouse.move(tip.x, tip.y);
  await page.mouse.down();
  await page.mouse.move(tip.x - 100, tip.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(handles.first()).not.toHaveAttribute("data-x", /^0\.(59|60)/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  // Undo closes the sheet; reopen the item to see its handles.
  const pin = await centre(pinByLetter(page, "A"));
  await page.mouse.click(pin.x, pin.y);
  await expect(handles.first()).toHaveAttribute("data-x", /^0\.(59|60)/);

  // Select a tip and remove it.
  await handles.first().click();
  await expect(handles.first()).toHaveAttribute("aria-pressed", "true");
  await sheet(page).getByRole("button", { name: "Remove arrow" }).click();
  await expect(arrows).toHaveCount(1);
  await expect(handles.first()).not.toHaveAttribute("data-x", /^0\.(59|60)/);
});

test("an arrow must point to a spot on its pin's page", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.3);
  await sheet(page).getByRole("button", { name: "Add arrow" }).click();

  // Tap page 2: it keeps waiting, with a hint.
  const viewer = (await page.getByTestId("drawing-viewer").boundingBox())!;
  const second = await stageBox(page, 1);
  await scrollDocument(page, second.y - viewer.y - 20);
  const two = await stageBox(page, 1);
  await page.mouse.click(two.x + two.width / 2, two.y + two.height / 2);
  await expect(sheet(page)).toContainText(
    "Tap on page 1 of this drawing, where the pin is.",
  );
  await expect(page.getByTestId("arrow")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(
    sheet(page).getByRole("button", { name: "Add arrow" }),
  ).toBeVisible();
});

test("deleting a drawing removes its items", async ({ page }) => {
  await setupInspection(page);
  const home = page.url();
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.3);
  await page.goto(home);
  await page.getByRole("button", { name: "Drawings", exact: true }).click();

  await page.getByRole("button", { name: "Delete S-101 Level 3" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete drawing?" });
  await expect(dialog).toContainText(
    "S-101 Level 3 and its 1 item will be removed",
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No drawings yet.")).toBeVisible();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);
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

    // No project yet: drawings and pins work all the same.
    await startInspection(page, null);
    await openTab(page, "Inspection");
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

// --- photos (step 6) ---------------------------------------------------------

const photoSection = (page: Page) =>
  sheet(page).getByRole("group", { name: "Photos" });

async function addPhotos(
  page: Page,
  input: "photo-camera-input" | "photo-library-input",
  files: Buffer[],
) {
  await page.getByTestId(input).setInputFiles(
    files.map((buffer, i) => ({
      name: `image-${i}.jpg`,
      mimeType: "image/jpeg",
      buffer,
    })),
  );
  await expect(page.getByTestId("photos-status")).toHaveCount(0, {
    timeout: 20_000,
  });
}

async function viewerImageSize(page: Page) {
  const img = page.getByTestId("photo-viewer-image");
  await expect(img).toBeVisible();
  return img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    return { width: el.naturalWidth, height: el.naturalHeight };
  });
}

test("a camera photo is shrunk to 1600 px and kept with the item", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);

  await addPhotos(page, "photo-camera-input", [
    await syntheticJpeg(page, 4000, 3000),
  ]);
  await expect(photoSection(page)).toContainText("Photos (1)");
  await page.getByTestId("photo-thumb").click();
  expect(await viewerImageSize(page)).toEqual({ width: 1600, height: 1200 });
});

test("a photo taken on its side comes out upright", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);

  // Stored landscape with "rotate 90°" in its EXIF, like a portrait shot.
  await addPhotos(page, "photo-library-input", [
    await syntheticJpeg(page, 400, 200, 6),
  ]);
  await page.getByTestId("photo-thumb").click();
  expect(await viewerImageSize(page)).toEqual({ width: 200, height: 400 });
});

test("photos: choose several, caption, delete and undo", async ({ page }) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);

  await addPhotos(page, "photo-library-input", [
    await syntheticJpeg(page, 800, 600),
    await syntheticJpeg(page, 600, 800),
  ]);
  await expect(page.getByTestId("photo-thumb")).toHaveCount(2);

  // Caption the second photo; it's kept after closing.
  await page.getByTestId("photo-thumb").nth(1).click();
  const viewer = page.getByTestId("photo-viewer");
  await expect(viewer).toContainText("photo 2 of 2");
  await viewer.getByLabel(/Caption/).fill("Lap at grid C");

  // Swipe right for the previous photo, then back with the arrow key.
  const area = (await page.getByTestId("photo-viewer-swipe").boundingBox())!;
  const y = area.y + area.height / 2;
  await page.mouse.move(area.x + area.width * 0.3, y);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width * 0.7, y, { steps: 8 });
  await page.mouse.up();
  await expect(viewer).toContainText("photo 1 of 2");
  // The arrow keys work too (when not typing a caption).
  await viewer.getByRole("button", { name: "Close" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(viewer).toContainText("photo 2 of 2");
  await expect(viewer.getByLabel(/Caption/)).toHaveValue("Lap at grid C");

  // Save closes the viewer; the caption is kept.
  await viewer.getByLabel(/Caption/).fill("Lap at grid C/4");
  await viewer.getByRole("button", { name: "Save" }).click();
  await expect(viewer).toHaveCount(0);
  await page.getByTestId("photo-thumb").nth(1).click();
  await expect(viewer.getByLabel(/Caption/)).toHaveValue("Lap at grid C/4");

  // Delete it, then Undo brings it back.
  await viewer.getByRole("button", { name: "Delete photo" }).click();
  await expect(page.getByTestId("photo-thumb")).toHaveCount(1);
  await viewer.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const pin = await centre(pinByLetter(page, "A"));
  await page.mouse.click(pin.x, pin.y);
  await expect(page.getByTestId("photo-thumb")).toHaveCount(2);
});

/** Replaces the Share sheet with a stand-in that records what was shared. */
async function stubShareSheet(page: Page) {
  await page.addInitScript(() => {
    const shared: { name: string; size: number }[][] = [];
    Object.assign(window, { sharedBatches: shared });
    Object.defineProperty(navigator, "canShare", {
      value: (data: { files?: File[] }) => !!data.files?.length,
    });
    Object.defineProperty(navigator, "share", {
      value: async (data: { files: File[] }) => {
        shared.push(data.files.map((f) => ({ name: f.name, size: f.size })));
      },
    });
  });
}

const sharedBatches = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          sharedBatches: { name: string; size: number }[][];
        }
      ).sharedBatches,
  );

test("saving photos shares camera shots at full size, named by job and item", async ({
  page,
}) => {
  await stubShareSheet(page);
  await setupInspection(page);
  const home = page.url();
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  const original = await syntheticJpeg(page, 4000, 3000);
  await addPhotos(page, "photo-camera-input", [original]);
  await addPhotos(page, "photo-library-input", [
    await syntheticJpeg(page, 800, 600),
  ]);

  // From the item.
  await photoSection(page)
    .getByRole("button", { name: "Save to iPad" })
    .click();
  const dialog = page.getByTestId("save-photos-dialog");
  await dialog.getByRole("button", { name: "Save 2 photos" }).click();
  await expect(dialog).toContainText("All 2 photos have been saved.");
  let shared = await sharedBatches(page);
  expect(shared[0].map((f) => f.name)).toEqual([
    "SY000001 Instruction A 1.jpg",
    "SY000001 Instruction A 2.jpg",
  ]);
  // The camera shot is the untouched original.
  expect(shared[0][0].size).toBe(original.length);
  await dialog.getByRole("button", { name: "Done" }).click();

  // From the Site memo step, then free the full-size copy.
  await page.goto(home);
  await openTab(page, "Site memo");
  const section = page.locator('[aria-labelledby="photos-heading"]');
  await expect(page.getByTestId("photos-summary")).toContainText(
    "2 photos · 1 full-size camera copy kept",
  );
  await section.getByRole("button", { name: "Save photos to iPad" }).click();
  await dialog.getByRole("button", { name: "Save 2 photos" }).click();
  await expect(dialog).toContainText("All 2 photos have been saved.");
  await dialog.getByRole("button", { name: "Done" }).click();
  await section.getByRole("button", { name: "Free up space" }).click();
  await page
    .getByRole("dialog", { name: "Free up space?" })
    .getByRole("button", { name: "Free up space" })
    .click();
  await expect(page.getByTestId("photos-summary")).toHaveText("2 photos");
  await expect(section).toContainText("Freed");

  // Saving again now shares the 1600 px copy.
  await section.getByRole("button", { name: "Save photos to iPad" }).click();
  await dialog.getByRole("button", { name: "Save 2 photos" }).click();
  shared = await sharedBatches(page);
  expect(shared[2][0].size).toBeLessThan(original.length);
});

test("more than 20 photos save in batches", async ({ page }) => {
  await stubShareSheet(page);
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  const small = await syntheticJpeg(page, 120, 90);
  await addPhotos(
    page,
    "photo-library-input",
    Array.from({ length: 21 }, () => small),
  );
  await expect(photoSection(page)).toContainText("Photos (21)");

  await photoSection(page)
    .getByRole("button", { name: "Save to iPad" })
    .click();
  const dialog = page.getByTestId("save-photos-dialog");
  await expect(dialog).toContainText("Batch 1 of 2: photos 1–20 of 21.");
  await dialog.getByRole("button", { name: "Save 20 photos" }).click();
  await expect(dialog).toContainText("Batch 2 of 2: photos 21–21 of 21.");
  await dialog.getByRole("button", { name: "Save 1 photo" }).click();
  await expect(dialog).toContainText("All 21 photos have been saved.");
  expect((await sharedBatches(page)).map((b) => b.length)).toEqual([20, 1]);
});

test("photo viewer: a quick flick changes photo; neighbours are preloaded", async ({
  page,
}) => {
  await setupInspection(page);
  await uploadDrawings(page, [await typicalPdf()]);
  await openDrawing(page, "S-101 Level 3");
  await addPinAt(page, 0.3, 0.5);
  await addPhotos(page, "photo-library-input", [
    await syntheticJpeg(page, 800, 600),
    await syntheticJpeg(page, 600, 800),
  ]);
  await page.getByTestId("photo-thumb").first().click();
  const viewer = page.getByTestId("photo-viewer");
  // The next photo is already in the strip, ready to slide in.
  await expect(viewer.locator(".photo-slide img")).toHaveCount(2);

  // A short, fast flick (well under a quarter of the width).
  const area = (await page.getByTestId("photo-viewer-swipe").boundingBox())!;
  const y = area.y + area.height / 2;
  const x = area.x + area.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y, { steps: 2 });
  await page.mouse.up();
  await expect(viewer).toContainText("photo 2 of 2");
});

test("general photos on the Site memo step save as General and delete with a confirm", async ({
  page,
}) => {
  await stubShareSheet(page);
  await setupInspection(page);
  await openTab(page, "Site memo");
  const section = page.locator('[aria-labelledby="photos-heading"]');
  const general = section.getByRole("group", { name: "General photos" });
  await addPhotos(page, "photo-library-input", [
    await syntheticJpeg(page, 800, 600),
    await syntheticJpeg(page, 600, 800),
  ]);
  await expect(general).toContainText("General photos (2)");

  await general.getByRole("button", { name: "Save to iPad" }).click();
  const dialog = page.getByTestId("save-photos-dialog");
  await dialog.getByRole("button", { name: "Save 2 photos" }).click();
  await expect(dialog).toContainText("All 2 photos have been saved.");
  expect((await sharedBatches(page))[0].map((f) => f.name)).toEqual([
    "SY000001 General 1.jpg",
    "SY000001 General 2.jpg",
  ]);
  await dialog.getByRole("button", { name: "Done" }).click();

  // The viewer names them General; deleting asks first (no Undo here).
  await general.getByTestId("photo-thumb").first().click();
  const viewer = page.getByTestId("photo-viewer");
  await expect(viewer).toContainText("General · photo 1 of 2");
  await viewer.getByRole("button", { name: "Delete photo" }).click();
  await page
    .getByRole("dialog", { name: "Delete this photo?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(general).toContainText("General photos (1)");
});
