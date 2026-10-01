import { expect, test, type Page } from "@playwright/test";

/** Waits until the service worker controls the page (reloading once if needed). */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}

test("loads the shell with Inspections and Settings only", async ({ page }) => {
  await page.goto("./");

  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link")).toHaveText(["Inspections", "Settings"]);
  await expect(page.getByText("No inspections yet")).toBeVisible();
  await expect(page.getByText(/^Version \d+\.\d+\.\d+ \(.+\)$/)).toBeVisible();
  await expect(page.getByTestId("net-status")).toHaveText("Online");
});

test("Settings shows storage and the 8 starter snippets", async ({ page }) => {
  await page.goto("./#/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByTestId("snippet-count")).toHaveText(
    "8 snippets (4 body, 2 condition, 2 heading)",
  );
  await expect(page.getByTestId("storage-used")).not.toHaveText("Checking…");
  await expect(
    page.getByRole("button", { name: "Back up now" }),
  ).toBeDisabled();
});

// Tagged @offline: runs in the Chromium project only (see playwright.config.ts).
test(
  "still loads after going offline and reloading",
  { tag: "@offline" },
  async ({ page, context }) => {
    await page.goto("./");
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText("No inspections yet")).toBeVisible();
    await expect(page.getByTestId("net-status")).toHaveText("Offline");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByTestId("snippet-count")).toHaveText(
      "8 snippets (4 body, 2 condition, 2 heading)",
    );

    await context.setOffline(false);
    await expect(page.getByTestId("net-status")).toHaveText("Online");
  },
);

test("makes no requests to other origins", async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== appOrigin) {
      external.push(request.url());
    }
  });

  await page.goto("./");
  await expect(page.getByText("No inspections yet")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByTestId("snippet-count")).toContainText("8 snippets");
  await page.waitForLoadState("networkidle");

  expect(external).toEqual([]);
});
