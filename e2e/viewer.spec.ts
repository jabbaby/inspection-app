import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing";
import { waitForServiceWorker } from "./helpers";

async function openTypical(page: Page) {
  await page.getByRole("button", { name: "Typical drawing" }).click();
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({
    timeout: 20_000,
  });
}

async function stageBox(page: Page) {
  const box = await page.getByTestId("viewer-stage").boundingBox();
  if (!box) throw new Error("No stage");
  return box;
}

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Two-finger pinch from synthetic touch pointer events (Playwright cannot
 * drive multi-touch). Fingers start `from` px apart and end `to` px apart.
 */
async function pinch(
  page: Page,
  at: { x: number; y: number },
  from: number,
  to: number,
) {
  await page.evaluate(
    ({ at, from, to }) => {
      const el = document.querySelector('[data-testid="drawing-viewer"]')!;
      const fire = (type: string, id: number, x: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            clientX: x,
            clientY: at.y,
            bubbles: true,
            cancelable: true,
            isPrimary: id === 1,
          }),
        );
      fire("pointerdown", 1, at.x - from / 2);
      fire("pointerdown", 2, at.x + from / 2);
      for (let i = 1; i <= 10; i++) {
        const d = from + ((to - from) * i) / 10;
        fire("pointermove", 1, at.x - d / 2);
        fire("pointermove", 2, at.x + d / 2);
      }
      fire("pointerup", 1, at.x - to / 2);
      fire("pointerup", 2, at.x + to / 2);
    },
    { at, from, to },
  );
}

async function darkPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>("canvas.viewer-base")!;
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4 * 16) {
      if (data[i] < 128 && data[i + 3] > 0) dark++;
    }
    return dark;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("./#/spike/viewer");
});

test("renders the drawing and places a pin exactly where tapped", async ({
  page,
}) => {
  await openTypical(page);
  expect(await darkPixels(page)).toBeGreaterThan(500);
  await expect(page.getByTestId("page-indicator")).toHaveText("1 / 3");

  // Taps do nothing until Add pin is on.
  let box = await stageBox(page);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);

  await page.getByRole("button", { name: "Add pin" }).click();
  const target = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.4 };
  await page.mouse.click(target.x, target.y);

  const pin = page.getByTestId("viewer-pin");
  await expect(pin).toHaveCount(1);
  await expect(pin).toHaveAttribute("data-letter", "A");
  expect(Number(await pin.getAttribute("data-x"))).toBeCloseTo(0.25, 2);
  expect(Number(await pin.getAttribute("data-y"))).toBeCloseTo(0.4, 2);
  const placed = await centre(pin);
  // The drawing must not have moved when the pin was added.
  expect(await stageBox(page)).toEqual(box);
  expect(placed.x).toBeCloseTo(target.x, 0);
  expect(placed.y).toBeCloseTo(target.y, 0);
  // Add pin switches itself off after one pin.
  await expect(page.getByRole("button", { name: "Add pin" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Pinch-zoom 4x around another point: the pin must stay on the same page spot.
  await pinch(
    page,
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
    60,
    240,
  );
  await expect(page.getByTestId("viewer-hud")).toContainText(
    /zoom (1[3-9]\d|[2-9]\d\d|\d{4})%/,
  );
  await expect(page.getByTestId("viewer-hud")).toContainText(
    /sharp render \d+ ms/,
  );

  box = await stageBox(page);
  // Compare with the stored position (the tap itself is rounded to a whole
  // pixel, which zooming magnifies).
  const after = await centre(pin);
  const n = {
    x: Number(await pin.getAttribute("data-x")),
    y: Number(await pin.getAttribute("data-y")),
  };
  expect(Math.abs(after.x - (box.x + box.width * n.x))).toBeLessThan(1);
  expect(Math.abs(after.y - (box.y + box.height * n.y))).toBeLessThan(1);
});

test("pans with a drag and moves a pin by dragging it", async ({ page }) => {
  await openTypical(page);
  const before = await stageBox(page);
  await page.mouse.move(before.x + 200, before.y + 200);
  await page.mouse.down();
  await page.mouse.move(before.x + 260, before.y + 230, { steps: 5 });
  await page.mouse.up();
  const panned = await stageBox(page);
  expect(panned.x - before.x).toBeCloseTo(60, 0);
  expect(panned.y - before.y).toBeCloseTo(30, 0);

  await page.getByRole("button", { name: "Add pin" }).click();
  await page.mouse.click(
    panned.x + panned.width * 0.5,
    panned.y + panned.height * 0.5,
  );
  const pin = page.getByTestId("viewer-pin");
  const start = await centre(pin);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + panned.width * 0.1, start.y, { steps: 5 });
  await page.mouse.up();
  expect(Number(await pin.getAttribute("data-x"))).toBeCloseTo(0.6, 2);
  expect(Number(await pin.getAttribute("data-y"))).toBeCloseTo(0.5, 2);
});

test("changes page and keeps letters running across pages", async ({
  page,
}) => {
  await openTypical(page);
  const addPinAt = async (fx: number, fy: number) => {
    const box = await stageBox(page);
    await page.getByRole("button", { name: "Add pin" }).click();
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  await addPinAt(0.3, 0.3);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("page-indicator")).toHaveText("2 / 3");
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible();
  await expect(page.getByTestId("viewer-pin")).toHaveCount(0);
  await addPinAt(0.5, 0.5);
  await expect(page.getByTestId("viewer-pin")).toHaveAttribute(
    "data-letter",
    "B",
  );
});

test("opens a PDF chosen from Files", async ({ page }) => {
  const bytes = await buildSyntheticDrawing(TYPICAL_DRAWING.slice(2));
  await page.locator('input[type="file"]').setInputFiles({
    name: "chosen.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.locator('[data-testid="drawing-viewer"][data-ready="true"]'),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("page-indicator")).toHaveText("1 / 1");
  await expect(page.getByTestId("viewer-hud")).toContainText("chosen.pdf");
  await expect(page.getByTestId("viewer-hud")).toContainText("sheet A4");
});

// Tagged @offline: runs in the Chromium project only (see playwright.config.ts).
test(
  "opens and renders a drawing offline",
  { tag: "@offline" },
  async ({ page, context }) => {
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();
    await openTypical(page);
    expect(await darkPixels(page)).toBeGreaterThan(500);
  },
);
