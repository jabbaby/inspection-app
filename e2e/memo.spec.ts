import { expect, test, type Page } from "@playwright/test";
import { waitForServiceWorker } from "./helpers";

async function generateSampleMemo(page: Page) {
  await page.getByRole("button", { name: "Generate sample memo" }).click();
  const link = page.getByTestId("sample-memo-link");
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("sample-memo-status")).toContainText(
    "SY000001_SIM-001_Level-3-slab-reinforcement.pdf",
  );

  const href = await link.getAttribute("href");
  const pdf = await page.evaluate(async (url) => {
    const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer());
    return {
      header: String.fromCharCode(...bytes.slice(0, 5)),
      size: bytes.length,
    };
  }, href);
  expect(pdf.header).toBe("%PDF-");
  expect(pdf.size).toBeGreaterThan(20_000);
}

test("generates the sample memo PDF", async ({ page }) => {
  await page.goto("./#/settings");
  await generateSampleMemo(page);
});

// Tagged @offline: runs in the Chromium project only (see playwright.config.ts).
test(
  "generates the sample memo PDF offline",
  { tag: "@offline" },
  async ({ page, context }) => {
    await page.goto("./");
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();

    await page.getByRole("link", { name: "Settings" }).click();
    await generateSampleMemo(page);
  },
);
