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
 * Two-finger pinch from synthetic touch pointer events (Playwright cannot
 * drive multi-touch). Fingers start `from` px apart and end `to` px apart.
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

/**
 * One-finger flick from synthetic touch pointer events, with real time
 * between moves so the viewer sees a release speed. The finger moves by
 * (dx, dy) over about 160 ms and lifts without pausing.
 */
export async function flick(
  page: Page,
  at: { x: number; y: number },
  dx: number,
  dy: number,
) {
  await page.evaluate(
    async ({ at, dx, dy }) => {
      const el = document.querySelector('[data-testid="drawing-viewer"]')!;
      const fire = (type: string, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            isPrimary: true,
          }),
        );
      fire("pointerdown", at.x, at.y);
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, 16));
        fire("pointermove", at.x + (dx * i) / steps, at.y + (dy * i) / steps);
      }
      fire("pointerup", at.x + dx, at.y + dy);
    },
    { at, dx, dy },
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

/** Waits until the first page stops moving and returns its box. */
export async function waitForStill(page: Page) {
  let last = await stageBox(page);
  await expect
    .poll(
      async () => {
        const now = await stageBox(page);
        const still = now.y === last.y && now.x === last.x;
        last = now;
        return still;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  return last;
}
