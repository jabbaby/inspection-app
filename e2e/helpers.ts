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

export async function stageBox(page: Page) {
  const box = await page.getByTestId("viewer-stage").boundingBox();
  if (!box) throw new Error("No stage");
  return box;
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
